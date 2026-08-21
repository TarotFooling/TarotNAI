
import { randomInt, createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import {
  parseResolution,
  positionToCenter,
  usesCoords,
  DEFAULT_PRECISE_STRENGTH,
  DEFAULT_PRECISE_FIDELITY,
  PRECISE_MODES,
} from '../shared/params.js';
import { V5_CURATED_MODEL, V5_FULL_MODEL } from '../shared/modelIds.js';
import { composePrompts, UC_PRESETS } from '../shared/presets.js';
import { vibeParameters, vibeCacheKey } from '../shared/vibe.js';

const IMAGE_API = 'https://image.novelai.net';

const MASK_CELL = 8;

const SUGGEST_TIMEOUT_MS = 6_000;

const PRECISE_REF_SIZES = [
  { width: 1024, height: 1536 },
  { width: 1472, height: 1472 },
  { width: 1536, height: 1024 },
];

async function conformReference(imageB64) {
  const { default: sharp } = await import('sharp');
  const input = Buffer.from(imageB64, 'base64');
  const { width = 0, height = 0 } = await sharp(input).metadata();
  if (!width || !height) throw new Error('reference has no dimensions');

  const ratio = width / height;
  const target = PRECISE_REF_SIZES.reduce((best, size) => {
    const d = Math.abs(Math.log(ratio / (size.width / size.height)));
    return d < best.d ? { size, d } : best;
  }, { size: PRECISE_REF_SIZES[0], d: Infinity }).size;

  if (width === target.width && height === target.height) return imageB64;

  const out = await sharp(input)
    .resize(target.width, target.height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    })
    .png()
    .toBuffer();
  return out.toString('base64');
}


async function conformImage(imageB64, width, height) {
  const { default: sharp } = await import('sharp');
  const input = Buffer.from(imageB64, 'base64');
  const meta = await sharp(input).metadata();
  if (meta.width === width && meta.height === height) return imageB64;

  const out = await sharp(input)
    .resize(width, height, { fit: 'fill' })
    .png()
    .toBuffer();
  return out.toString('base64');
}

async function conformMask(maskB64, width, height) {
  const { default: sharp } = await import('sharp');
  const src = await sharp(Buffer.from(maskB64, 'base64'))
    .resize(width, height, { fit: 'fill', kernel: 'nearest' })
    .extractChannel('red')
    .raw()
    .toBuffer();

  const out = Buffer.alloc(width * height * 3);
  for (let cy = 0; cy < height; cy += MASK_CELL) {
    for (let cx = 0; cx < width; cx += MASK_CELL) {
      let lit = false;
      const yEnd = Math.min(cy + MASK_CELL, height);
      const xEnd = Math.min(cx + MASK_CELL, width);
      for (let y = cy; y < yEnd && !lit; y += 1) {
        for (let x = cx; x < xEnd; x += 1) {
          if (src[y * width + x] > 127) { lit = true; break; }
        }
      }
      if (!lit) continue;
      for (let y = cy; y < yEnd; y += 1) {
        for (let x = cx; x < xEnd; x += 1) {
          const i = (y * width + x) * 3;
          out[i] = 255;
          out[i + 1] = 255;
          out[i + 2] = 255;
        }
      }
    }
  }

  const png = await sharp(out, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
  return png.toString('base64');
}

const V4_MODELS = new Set([
  'nai-diffusion-4-curated',
  'nai-diffusion-4-full',
  'nai-diffusion-4-5-curated',
  'nai-diffusion-4-5-full',
  V5_CURATED_MODEL,
  V5_FULL_MODEL,
]);

export class NaiError extends Error {
  constructor(message, { status = 0, code = 'nai_error', retryable = false } = {}) {
    super(message);
    this.name = 'NaiError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

function errorForStatus(status, body) {
  const detail = typeof body === 'string' ? body.slice(0, 200) : '';
  switch (status) {
    case 400:
      if (detail.includes('encoding v4 director references')) {
        return new NaiError(
          'NovelAI could not read that Precise Reference image. Try a different one.',
          { status, code: 'precise_reference_rejected' },
        );
      }
      return new NaiError(`NovelAI rejected the request. ${detail}`, {
        status,
        code: 'bad_request',
      });
    case 401:
      return new NaiError('NovelAI key is invalid or expired.', {
        status,
        code: 'unauthorized',
      });
    case 402:
      return new NaiError('This generation needs Anlas and the account has none.', {
        status,
        code: 'payment_required',
      });
    case 429:
      return new NaiError('NovelAI is rate limiting you. Try again shortly.', {
        status,
        code: 'rate_limited',
        retryable: true,
      });
    case 500:
    case 502:
    case 503:
    case 504:
      return new NaiError('NovelAI is having trouble right now. Try again shortly.', {
        status,
        code: 'upstream_error',
        retryable: true,
      });
    default:
      return new NaiError(`NovelAI request failed (${status}). ${detail}`, {
        status,
        code: 'nai_error',
      });
  }
}

function cachedImage(imageB64) {
  const key = createHash('sha256').update(imageB64).digest('hex');
  return { cache_secret_key: key, data: imageB64 };
}

function buildRequestBody(body) {
  const form = new FormData();
  const partFor = new Map();
  let uploads = 0;

  const attach = (dataB64, name) => {
    const existing = partFor.get(dataB64);
    if (existing) return existing;
    form.append(name, new Blob([Buffer.from(dataB64, 'base64')], { type: 'image/png' }), 'blob');
    partFor.set(dataB64, name);
    uploads += 1;
    return name;
  };

  const cached = body.parameters?.director_reference_images_cached;
  if (Array.isArray(cached)) {
    for (const [i, entry] of cached.entries()) {
      if (entry?.data) entry.data = attach(entry.data, `director_ref_${i}`);
    }
  }

  if (uploads === 0) {
    return { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } };
  }

  form.append('request', new Blob([JSON.stringify(body)], { type: 'application/json' }), 'blob');

  return { body: form, headers: {} };
}

function preciseDescription(mode) {
  return {
    caption: { base_caption: mode || PRECISE_MODES[0], char_captions: [] },
    legacy_uc: false,
  };
}

export function buildParameters({
  prompt,
  negativePrompt,
  width,
  height,
  steps,
  guidance,
  seed,
  sampler = 'k_euler_ancestral',
  model,
  qualityToggle = true,
  ucPreset = 'heavy',
  characters = [],
  image,
  mask,
  strength = 0.7,
  noise = 0,
  inpaintStrength = 0.7,
  addOriginalImage = true,
  vibes = [],
  normalizeVibes = true,
  precise = null,
  imageCount = 1,
  infill = Boolean(image && mask),
}) {
  const parameters = {
    params_version: 3,
    width,
    height,
    scale: guidance,
    uncond_scale: 0,
    sampler,
    steps,
    n_samples: imageCount,
    ucPreset: UC_PRESETS[ucPreset] ?? UC_PRESETS.heavy,
    qualityToggle,
    dynamic_thresholding: false,
    controlnet_strength: 1,
    legacy: false,
    add_original_image: addOriginalImage,
    cfg_rescale: 0,
    noise_schedule: 'karras',
    legacy_v3_extend: false,
    skip_cfg_above_sigma: null,
    prefer_brownian: true,
    deliberate_euler_ancestral_bug: false,
    negative_prompt: negativePrompt,
    seed,
    sm: false,
    sm_dyn: false,
  };

  if (V4_MODELS.has(model)) {
    const useCoords = usesCoords(characters);

    parameters.use_coords = useCoords;
    parameters.characterPrompts = [];
    parameters.v4_prompt = {
      caption: { base_caption: prompt, char_captions: [] },
      use_coords: useCoords,
      use_order: true,
      legacy_uc: false,
    };
    parameters.v4_negative_prompt = {
      caption: { base_caption: negativePrompt, char_captions: [] },
      use_coords: useCoords,
      use_order: false,
      legacy_uc: false,
    };

    for (const character of characters) {
      const center = positionToCenter(character.position);
      const uc = character.uc ?? '';
      parameters.characterPrompts.push({ center, prompt: character.prompt, uc });
      parameters.v4_prompt.caption.char_captions.push({
        centers: [center],
        char_caption: character.prompt,
      });
      parameters.v4_negative_prompt.caption.char_captions.push({
        centers: [center],
        char_caption: uc,
      });
    }
  }

  if (image) {
    parameters.image = image;
    parameters.strength = strength;
    parameters.noise = noise;

    if (mask && infill) {
      parameters.mask = mask;
      parameters.inpaintImg2ImgStrength = inpaintStrength;

      if (inpaintStrength < 1) {
        parameters.img2img = { strength: inpaintStrength, color_correct: true };
      }
      parameters.extra_noise_seed = seed;
      parameters.image_format = 'png';
    }
  }

  if (V4_MODELS.has(model) && !infill) {
    Object.assign(parameters, vibeParameters(vibes, { normalize: normalizeVibes }));
  }

  if (V4_MODELS.has(model) && !infill && precise?.image) {
    parameters.director_reference_images_cached = [cachedImage(precise.image)];
    parameters.director_reference_descriptions = [preciseDescription(precise.mode)];
    parameters.director_reference_information_extracted = [1];
    parameters.director_reference_strength_values = [
      precise.strength ?? DEFAULT_PRECISE_STRENGTH,
    ];
    const fidelity = precise.fidelity ?? DEFAULT_PRECISE_FIDELITY;
    parameters.director_reference_secondary_strength_values = [1 - fidelity];
  }

  return parameters;
}

export function inpaintingModel(model) {
  const INPAINTING_MODELS = {
    'nai-diffusion-3': 'nai-diffusion-3-inpainting',
    'nai-diffusion-furry-3': 'nai-diffusion-furry-3-inpainting',
    'nai-diffusion-4-curated': 'nai-diffusion-4-curated-inpainting',
    'nai-diffusion-4-full': 'nai-diffusion-4-full-inpainting',
    'nai-diffusion-4-5-curated': 'nai-diffusion-4-5-curated-inpainting',
    'nai-diffusion-4-5-full': 'nai-diffusion-4-5-full-inpainting',
    [V5_CURATED_MODEL]: `${V5_CURATED_MODEL}-inpainting`,
    [V5_FULL_MODEL]: `${V5_FULL_MODEL}-inpainting`,
  };
  return INPAINTING_MODELS[model] ?? null;
}

function readCentralDirectory(buffer) {
  const entries = new Map();

  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0 && i >= buffer.length - 66_000; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return entries;

  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);

  for (let i = 0; i < count; i++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) break;

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);

    entries.set(localOffset, { compressedSize, method });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

export function unzip(buffer) {
  const files = [];
  const central = readCentralDirectory(buffer);

  let offset = 0;
  while (offset < buffer.length - 4) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) break;

    const flags = buffer.readUInt16LE(offset + 6);
    const method = buffer.readUInt16LE(offset + 8);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);

    const nameStart = offset + 30;
    const name = buffer.toString('utf8', nameStart, nameStart + nameLength);
    const dataStart = nameStart + nameLength + extraLength;

    const streamed = Boolean(flags & 0x08);
    const localSize = buffer.readUInt32LE(offset + 18);
    const fromCentral = central.get(offset)?.compressedSize;

    let compressedSize = streamed ? (fromCentral ?? 0) : (localSize || fromCentral || 0);

    if (!compressedSize) {
      const next = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x07, 0x08]), dataStart);
      const nextLocal = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), dataStart);
      const nextCentral = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), dataStart);
      const end = [next, nextLocal, nextCentral].filter((n) => n > 0).sort((a, b) => a - b)[0];
      compressedSize = (end ?? buffer.length) - dataStart;
    }

    const data = buffer.subarray(dataStart, dataStart + compressedSize);

    if (method === 0) {
      files.push({ name, bytes: Buffer.from(data) });
    } else if (method === 8) {
      files.push({ name, bytes: inflateRawSync(data) });
    } else {
      throw new NaiError(`Unsupported ZIP compression method ${method}`, {
        code: 'bad_response',
      });
    }

    let cursor = dataStart + compressedSize;
    if (streamed && buffer.readUInt32LE(cursor) === 0x08074b50) cursor += 16;
    else if (streamed) cursor += 12;
    offset = cursor;
  }

  if (files.length === 0) {
    throw new NaiError('NovelAI returned an archive with no images in it.', {
      code: 'bad_response',
    });
  }
  return files;
}

export function readPngMetadata(png) {
  const chunks = {};
  let offset = 8;

  while (offset + 8 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;

    if (type === 'tEXt') {
      const data = png.subarray(dataStart, dataStart + length);
      const nul = data.indexOf(0);
      if (nul !== -1) {
        chunks[data.toString('latin1', 0, nul)] = data.toString('latin1', nul + 1);
      }
    } else if (type === 'iTXt') {
      const data = png.subarray(dataStart, dataStart + length);
      const nul = data.indexOf(0);
      if (nul !== -1) {
        const keyword = data.toString('latin1', 0, nul);
        let p = nul + 3;
        p = data.indexOf(0, p) + 1;
        p = data.indexOf(0, p) + 1;
        if (p > 0) chunks[keyword] = data.toString('utf8', p);
      }
    }

    if (type === 'IEND') break;
    offset = dataStart + length + 4;
  }

  return chunks;
}

export function randomSeed() {
  return randomInt(1, 4294967296);
}

export function seedFromMetadata(metadata) {
  const comment = metadata.Comment;
  if (!comment) return null;
  try {
    const parsed = JSON.parse(comment);
    return Number.isInteger(parsed.seed) ? parsed.seed : null;
  } catch {
    return null;
  }
}

export function stripSignedHash(comment) {
  try {
    const parsed = JSON.parse(comment);
    if (!('signed_hash' in parsed)) return comment;
    delete parsed.signed_hash;
    return JSON.stringify(parsed);
  } catch {
    return comment;
  }
}

function logRequest({ params, body }) {
  const q = params.qualityToggle ? 'on' : 'off';

  console.log(`  → NAI ${body.action} ${body.model}`);
  console.log(`      quality tags: ${q}   uc preset: ${params.ucPreset} (${body.parameters.ucPreset})`);

  const line = (label, before, after) => {
    console.log(`      ${label}:`);
    console.log(`        typed: ${JSON.stringify(before ?? '')}`);
    console.log(
      after === before
        ? '        sent : → unchanged'
        : `        sent : ${JSON.stringify(after)}`,
    );
  };

  line('prompt', params.prompt, body.input);
  line('undesired', params.negativePrompt, body.parameters.negative_prompt);

  console.log('      parameters:');
  for (const key of Object.keys(body.parameters).sort()) {
    const value = body.parameters[key];

    if (key === 'image' || key === 'mask') {
      console.log(`        ${key}: <${Math.round((value.length * 3) / 4 / 1024)}kb base64>`);
    } else if (key === 'director_reference_images') {
      const sizes = value.map((v) => `${Math.round((v.length * 3) / 4 / 1024)}kb`);
      console.log(`        ${key}: [${sizes.join(', ')}] (${value.length})`);
    } else if (key === 'negative_prompt' || key === 'v4_prompt' || key === 'v4_negative_prompt') {
      continue;
    } else {
      console.log(`        ${key}: ${JSON.stringify(value)}`);
    }
  }

  if (body.parameters.v4_prompt) {
    const v4 = body.parameters.v4_prompt;
    const v4n = body.parameters.v4_negative_prompt;
    const matches = v4.caption.base_caption === body.input;
    console.log(`      v4_prompt: use_coords=${v4.use_coords} use_order=${v4.use_order}`);
    console.log(`        base_caption: ${matches ? '→ matches input' : JSON.stringify(v4.caption.base_caption)}`);
    console.log(
      `        neg base_caption: ${
        v4n.caption.base_caption === body.parameters.negative_prompt
          ? '→ matches negative_prompt'
          : JSON.stringify(v4n.caption.base_caption)
      }`,
    );

    for (const [i, c] of v4.caption.char_captions.entries()) {
      const nc = v4n.caption.char_captions[i];
      console.log(
        `        char ${i}: ${JSON.stringify(c.char_caption)} @ ` +
          `${JSON.stringify(c.centers)} uc=${JSON.stringify(nc?.char_caption ?? '')}`,
      );
    }
  }
}

export class NaiClient {
  #token;
  #fetch;
  #timeoutMs;
  #log;

  constructor({ token, fetch: fetchImpl = fetch, timeoutMs = 120_000, log = false }) {
    if (!token) throw new Error('NaiClient: token is required');
    this.#token = token;
    this.#fetch = fetchImpl;
    this.#timeoutMs = timeoutMs;
    this.#log = log;
  }

  async generate(params, signal, overrides = {}) {
    const { width, height } = params.width && params.height
      ? params
      : parseResolution(params.resolution);

    const inpainting = Boolean(params.image && params.mask);
    const infillModel = inpainting ? inpaintingModel(params.model) : null;

    let maskB64 = params.mask;
    let imageB64 = params.image;
    if (inpainting) {
      try {
        maskB64 = await conformMask(params.mask, width, height);
      } catch {
      }
    }
    if (params.image) {
      try {
        imageB64 = await conformImage(params.image, width, height);
      } catch {
      }
    }

    let preciseParam = params.precise;
    if (preciseParam?.image) {
      try {
        preciseParam = { ...preciseParam, image: await conformReference(preciseParam.image) };
      } catch {
      }
    }

    let action = 'generate';
    if (infillModel) action = 'infill';
    else if (params.image) action = 'img2img';

    const { prompt, negativePrompt, characters } = composePrompts({
      prompt: params.prompt,
      negativePrompt: params.negativePrompt,
      model: params.model,
      qualityToggle: params.qualityToggle,
      transparentBg: params.transparentBg,
      ucPreset: params.ucPreset,
      characters: params.characters ?? [],
    });

    const seed = overrides.seed ?? (params.seed || randomSeed());

    const imageCount = inpainting
      ? 1
      : (overrides.imageCount ?? params.imageCount ?? 1);

    const body = {
      input: prompt,
      model: infillModel ?? params.model,
      action,
      parameters: buildParameters({
        ...params,
        image: imageB64,
        mask: maskB64,
        precise: preciseParam,
        prompt,
        negativePrompt,
        characters,
        width,
        height,
        seed,
        imageCount,
        infill: Boolean(infillModel),
      }),
    };

    if (this.#log) logRequest({ params, body });

    const request = buildRequestBody(body);

    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);

    let res;
    try {
      res = await this.#fetch(`${IMAGE_API}/ai/generate-image`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.#token}`,
          ...request.headers,
        },
        body: request.body,
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted && !signal?.aborted) {
        throw new NaiError('NovelAI took too long to respond.', {
          code: 'timeout',
          retryable: true,
        });
      }
      throw new NaiError(`Could not reach NovelAI: ${err.message}`, {
        code: 'network',
        retryable: true,
      });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }

    if (!res.ok) {
      let detail = '';
      try {
        detail = await res.text();
      } catch {
      }
      if (this.#log) console.log(`      ✗ ${res.status} ${detail.slice(0, 160)}`);
      throw errorForStatus(res.status, detail);
    }

    const archive = Buffer.from(await res.arrayBuffer());
    const files = unzip(archive);

    const images = files.map((file) => {
      const metadata = readPngMetadata(file.bytes);
      return {
        bytes: file.bytes,
        seed: seedFromMetadata(metadata) || seed,
        metadata,
      };
    });

    if (this.#log) {
      const kb = Math.round(images.reduce((n, i) => n + i.bytes.length, 0) / 1024);
      const seeds = images.map((i) => i.seed).join(', ');
      console.log(`      ✓ ${kb}kb  ${images.length} image(s)  seed ${seeds}`);
    }

    return {
      images,
      bytes: images[0].bytes,
      seed: images[0].seed,
      metadata: images[0].metadata,
    };
  }

  async balance(signal) {
    const res = await this.#fetch(`${IMAGE_API}/user/subscription`, {
      headers: { Authorization: `Bearer ${this.#token}` },
      signal,
    });
    if (!res.ok) throw errorForStatus(res.status, await res.text().catch(() => ''));

    const body = await res.json();
    const steps = body?.trainingStepsLeft ?? {};

    const usage = body?.usage;
    const opus =
      usage && typeof usage.percent === 'number'
        ? {
            percent: Math.max(0, Math.min(100, usage.percent)),
            secondsPerPercent: Number(usage.timeUntilNextPercent ?? 0),
          }
        : null;

    return {
      anlas: Number(steps.purchasedTrainingSteps ?? 0),
      subscriptionAnlas: Number(steps.fixedTrainingStepsLeft ?? 0),
      tier: body?.tier ?? null,
      active: body?.active === true,
      opus,
    };
  }

  async encodeVibe({ image, model, informationExtracted }, signal) {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);

    if (this.#log) {
      console.log(`   → encode-vibe  ${model}  info ${informationExtracted}`);
    }

    let res;
    try {
      res = await this.#fetch(`${IMAGE_API}/ai/encode-vibe`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.#token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image, model, informationExtracted }),
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted && !signal?.aborted) {
        throw new NaiError('NovelAI took too long to encode that vibe.', {
          code: 'timeout',
          retryable: true,
        });
      }
      throw new NaiError(`Could not reach NovelAI: ${err.message}`, {
        code: 'network',
        retryable: true,
      });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }

    if (!res.ok) {
      let detail = '';
      try {
        detail = await res.text();
      } catch {
      }
      if (this.#log) console.log(`      ✗ ${res.status} ${detail.slice(0, 160)}`);

      if (res.status === 500) {
        throw new NaiError(
          'NovelAI could not encode that image. Very small images are rejected - '
          + 'try one at least a few hundred pixels on a side.',
          { status: 500, code: 'encode_rejected' },
        );
      }
      if (res.status === 404) {
        throw new NaiError(
          'The vibe encoding endpoint was not found. This is a bug in TarotNAI, not '
          + 'something to retry.',
          { status: 404, code: 'encode_endpoint_missing' },
        );
      }
      throw errorForStatus(res.status, detail);
    }

    const encoding = Buffer.from(await res.arrayBuffer()).toString('base64');
    if (this.#log) console.log(`      ✓ encoded ${Math.round(encoding.length / 1024)}kb`);
    return encoding;
  }

  async suggestTags({ model, prompt }, signal) {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), SUGGEST_TIMEOUT_MS);

    const url = `${IMAGE_API}/ai/generate-image/suggest-tags`
      + `?model=${encodeURIComponent(model)}&prompt=${encodeURIComponent(prompt)}`;

    let res;
    try {
      res = await this.#fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.#token}` },
        signal: controller.signal,
      });
    } catch (err) {
      if (signal?.aborted) throw err;
      if (controller.signal.aborted) {
        throw new NaiError('Tag suggestions timed out.', {
          code: 'timeout',
          retryable: true,
        });
      }
      throw new NaiError(`Could not reach NovelAI: ${err.message}`, {
        code: 'network',
        retryable: true,
      });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }

    if (!res.ok) {
      let detail = '';
      try {
        detail = await res.text();
      } catch {
      }
      throw errorForStatus(res.status, detail);
    }

    const body = await res.json().catch(() => null);
    const tags = Array.isArray(body?.tags) ? body.tags : [];

    return tags
      .filter((t) => typeof t?.tag === 'string' && t.tag)
      .map((t) => ({
        tag: t.tag,
        count: Number.isFinite(t.count) ? t.count : 0,
        confidence: Number.isFinite(t.confidence) ? t.confidence : 0,
      }));
  }
}

export function createVibeEncoder(token, { fetch: fetchImpl, log = false } = {}) {
  if (!token) {
    return async () => {
      throw Object.assign(new Error('No NAI key configured. See .env.example.'), {
        code: 'no_keys',
      });
    };
  }

  const client = new NaiClient({ token, fetch: fetchImpl, log });

  const cache = new Map();

  return async function encodeVibe({ image, model, informationExtracted }, signal, onBilled) {
    const key = vibeCacheKey({ image, model, informationExtracted });

    const hit = cache.get(key);
    if (hit) return hit;

    onBilled?.();

    const pending = client
      .encodeVibe({ image, model, informationExtracted }, signal)
      .catch((err) => {
        cache.delete(key);
        throw err;
      });

    cache.set(key, pending);
    return pending;
  };
}

const SUGGEST_CACHE_MAX = 500;

export function createTagSuggester(token, { fetch: fetchImpl, log = false } = {}) {
  if (!token) {
    return async () => {
      throw Object.assign(new Error('No NAI key configured. See .env.example.'), {
        code: 'no_keys',
      });
    };
  }

  const client = new NaiClient({ token, fetch: fetchImpl, log });

  const cache = new Map();

  return async function suggestTags({ model, prompt }, signal) {
    const key = `${model} ${prompt}`;

    if (cache.has(key)) {
      const hit = cache.get(key);
      cache.delete(key);
      cache.set(key, hit);
      return hit;
    }

    const tags = await client.suggestTags({ model, prompt }, signal);

    cache.set(key, tags);
    if (cache.size > SUGGEST_CACHE_MAX) {
      cache.delete(cache.keys().next().value);
    }
    return tags;
  };
}

export function createGenerator(token, { fetch: fetchImpl, log = false } = {}) {
  const client = new NaiClient({ token, fetch: fetchImpl, log });

  return async (job, { signal }) => client.generate(job.params, signal);
}

export function createBalanceReader(
  token,
  { fetch: fetchImpl, log = false, ttlMs = 30_000, timeoutMs } = {},
) {
  if (!token) return null;

  const client = new NaiClient({
    token,
    fetch: fetchImpl,
    log,
    ...(timeoutMs ? { timeoutMs } : {}),
  });
  let cached = null;
  let inFlight = null;

  const fetchFresh = () => {
    inFlight ??= client
      .balance()
      .then((value) => {
        cached = { at: Date.now(), value };
        return value;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };

  return async function readBalance({ force = false } = {}) {
    if (force) return fetchFresh();
    if (!cached) return fetchFresh();

    if (Date.now() - cached.at >= ttlMs) fetchFresh().catch(() => {});
    return cached.value;
  };
}
