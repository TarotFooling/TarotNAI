const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPng(bytes) {
  if (!bytes || bytes.length < 8) return false;
  return PNG_MAGIC.every((b, i) => bytes[i] === b);
}

function eachChunk(bytes, visit) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(
      bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7],
    );
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > bytes.length) return;
    if (visit(type, bytes.subarray(start, end)) === false) return;
    if (type === 'IEND') return;
    offset = end + 4;
  }
}

const latin1 = (bytes) => {
  let out = '';
  for (const b of bytes) out += String.fromCharCode(b);
  return out;
};

const utf8 = (bytes) => new TextDecoder('utf-8').decode(bytes);

async function readTextChunks(bytes) {
  const text = {};
  const compressed = [];

  eachChunk(bytes, (type, data) => {
    if (type === 'IDAT') return false;

    if (type === 'tEXt') {
      const nul = data.indexOf(0);
      if (nul > 0) text[latin1(data.subarray(0, nul))] = latin1(data.subarray(nul + 1));
      return;
    }

    if (type === 'zTXt') {
      const nul = data.indexOf(0);
      if (nul <= 0) return;
      if (data[nul + 1] !== 0) return;
      compressed.push({
        key: latin1(data.subarray(0, nul)),
        data: data.subarray(nul + 2),
        utf8: false,
      });
      return;
    }

    if (type === 'iTXt') {
      const nul = data.indexOf(0);
      if (nul <= 0) return;
      const key = latin1(data.subarray(0, nul));
      const flag = data[nul + 1];
      const method = data[nul + 2];
      let p = nul + 3;
      for (let skipped = 0; skipped < 2 && p < data.length; skipped++) {
        const next = data.indexOf(0, p);
        if (next < 0) return;
        p = next + 1;
      }
      if (p > data.length) return;
      const payload = data.subarray(p);
      if (flag === 0) text[key] = utf8(payload);
      else if (method === 0) compressed.push({ key, data: payload, utf8: true });
      return;
    }
  });

  for (const job of compressed) {
    const raw = await inflate(job.data, 'deflate').catch(() => null);
    if (raw) text[job.key] = job.utf8 ? utf8(raw) : latin1(raw);
  }

  return text;
}

async function inflate(bytes, format) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const STEALTH_MAGICS = Object.freeze({
  stealth_pngcomp: { gzip: true },
  stealth_pnginfo: { gzip: false },
});

const MAGIC_LENGTH = 15;

function readAlphaBits(alpha, width, height, bitCount) {
  const out = new Uint8Array(Math.ceil(bitCount / 8));
  for (let i = 0; i < bitCount; i++) {
    const col = Math.floor(i / height);
    const row = i % height;
    const bit = alpha[row * width + col] & 1;
    if (bit) out[i >> 3] |= 0x80 >> (i & 7);
  }
  return out;
}

async function decodeStealthAlpha(alpha, width, height) {
  const total = width * height;
  if (total < (MAGIC_LENGTH + 4) * 8) return null;

  const magic = latin1(readAlphaBits(alpha, width, height, MAGIC_LENGTH * 8));
  const variant = STEALTH_MAGICS[magic];
  if (!variant) return null;

  const header = readAlphaBits(alpha, width, height, (MAGIC_LENGTH + 4) * 8);
  const lengthBytes = header.subarray(MAGIC_LENGTH, MAGIC_LENGTH + 4);
  const bitLength =
    (lengthBytes[0] << 24) | (lengthBytes[1] << 16) | (lengthBytes[2] << 8) | lengthBytes[3];

  const headerBits = (MAGIC_LENGTH + 4) * 8;
  if (bitLength <= 0 || headerBits + bitLength > total) return null;

  const all = readAlphaBits(alpha, width, height, headerBits + bitLength);
  const body = all.subarray(MAGIC_LENGTH + 4, MAGIC_LENGTH + 4 + Math.ceil(bitLength / 8));

  let json;
  if (variant.gzip) {
    const raw = await inflate(body, 'gzip').catch(() => null);
    if (!raw) return null;
    json = utf8(raw);
  } else {
    json = utf8(body);
  }

  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function undoFilters(raw, width, height, channels, bitDepth) {
  const bpp = Math.max(1, Math.ceil((channels * bitDepth) / 8));
  const rowBytes = Math.ceil((width * channels * bitDepth) / 8);
  const out = new Uint8Array(rowBytes * height);

  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = pos;
    pos += rowBytes;
    const cur = y * rowBytes;
    const prev = (y - 1) * rowBytes;

    for (let x = 0; x < rowBytes; x++) {
      const value = raw[line + x];
      const left = x >= bpp ? out[cur + x - bpp] : 0;
      const up = y > 0 ? out[prev + x] : 0;
      const upLeft = y > 0 && x >= bpp ? out[prev + x - bpp] : 0;

      let recon;
      switch (filter) {
        case 0: recon = value; break;
        case 1: recon = value + left; break;
        case 2: recon = value + up; break;
        case 3: recon = value + ((left + up) >> 1); break;
        case 4: {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - upLeft);
          recon = value + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
          break;
        }
        default: return null;
      }
      out[cur + x] = recon & 0xff;
    }
  }
  return { data: out, rowBytes, bpp };
}

async function decodeAlphaPlane(bytes) {
  let ihdr = null;
  const idat = [];

  eachChunk(bytes, (type, data) => {
    if (type === 'IHDR') {
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      ihdr = {
        width: view.getUint32(0),
        height: view.getUint32(4),
        bitDepth: data[8],
        colourType: data[9],
        interlace: data[12],
      };
      return;
    }
    if (type === 'IDAT') idat.push(data);
  });

  if (!ihdr || !idat.length) return null;
  if (ihdr.bitDepth !== 8 || ihdr.interlace !== 0) return null;

  const channels = ihdr.colourType === 6 ? 4 : ihdr.colourType === 4 ? 2 : 0;
  if (!channels) return null;

  const { width, height } = ihdr;
  if (width <= 0 || height <= 0 || width * height > 64e6) return null;

  const joined = new Uint8Array(idat.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const chunk of idat) { joined.set(chunk, at); at += chunk.length; }

  const raw = await inflate(joined, 'deflate').catch(() => null);
  if (!raw) return null;

  const expected = (Math.ceil((width * channels * ihdr.bitDepth) / 8) + 1) * height;
  if (raw.length < expected) return null;

  const filtered = undoFilters(raw, width, height, channels, ihdr.bitDepth);
  if (!filtered) return null;

  const alpha = new Uint8Array(width * height);
  const { data, rowBytes } = filtered;
  for (let y = 0; y < height; y++) {
    const row = y * rowBytes;
    const outRow = y * width;
    for (let x = 0; x < width; x++) {
      alpha[outRow + x] = data[row + x * channels + (channels - 1)];
    }
  }

  return { alpha, width, height };
}

function looksNovelAi(text, comment) {
  if (/NovelAI/i.test(text.Software ?? '')) return true;
  if (/NovelAI/i.test(text.Source ?? '')) return true;
  if (comment && /NovelAI/i.test(comment.Software ?? comment.Source ?? '')) return true;
  return false;
}

export async function readNaiMetadata(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (!isPng(bytes)) return null;

  const text = await readTextChunks(bytes).catch(() => ({}));
  let comment = null;
  if (text.Comment) {
    try { comment = JSON.parse(text.Comment); } catch { comment = null; }
  }

  if (comment && looksNovelAi(text, comment)) {
    return { source: 'chunks', comment, text };
  }

  const plane = await decodeAlphaPlane(bytes).catch(() => null);
  if (!plane) return null;

  const hidden = await decodeStealthAlpha(plane.alpha, plane.width, plane.height);
  if (!hidden) return null;

  let inner = hidden;
  if (typeof hidden.Comment === 'string') {
    try { inner = JSON.parse(hidden.Comment); } catch { inner = hidden; }
  } else if (hidden.Comment && typeof hidden.Comment === 'object') {
    inner = hidden.Comment;
  }

  const flatText = {};
  for (const [key, value] of Object.entries(hidden)) {
    if (typeof value === 'string') flatText[key] = value;
  }

  if (!looksNovelAi(flatText, hidden) && !inner?.prompt) return null;

  return { source: 'alpha', comment: inner, text: flatText };
}

const QUALITY_TAG_SETS = Object.freeze([
  'best quality, amazing quality, very aesthetic, absurdres',
  'rating:general, best quality, very aesthetic, absurdres',
  'no text, best quality, very aesthetic, absurdres',
  'very aesthetic, masterpiece, no text, -0.8::feet::, rating:general',
  'very aesthetic, masterpiece, no text',
  'very aesthetic, amazing quality, no text',
  'very aesthetic, location, masterpiece, no text, -0.8::feet::, rating:general',
  'very aesthetic, location, masterpiece, no text',
]);

const UC_PRESET_TEXTS = Object.freeze([
  ['heavy', 'blurry, lowres, upscaled, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, halftone, multiple views, logo, too many watermarks, negative space, blank page'],
  ['light', 'blurry, lowres, upscaled, artistic error, scan artifacts, jpeg artifacts, logo, too many watermarks, negative space, blank page'],
  ['human_focus', 'blurry, lowres, upscaled, artistic error, film grain, scan artifacts, bad anatomy, bad hands, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, halftone, multiple views, logo, too many watermarks, @_@, mismatched pupils, glowing eyes, negative space, blank page'],
  ['heavy', 'nsfw, lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page'],
  ['light', 'nsfw, lowres, artistic error, scan artifacts, worst quality, bad quality, jpeg artifacts, multiple views, very displeasing, too many watermarks, negative space, blank page'],
  ['human_focus', 'nsfw, lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page, @_@, mismatched pupils, glowing eyes, bad anatomy'],
  ['heavy', 'blurry, lowres, error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, logo, dated, signature, multiple views, gigantic breasts, white blank page, blank page'],
  ['light', 'blurry, lowres, error, worst quality, bad quality, jpeg artifacts, very displeasing, logo, dated, signature'],
  ['heavy', 'nsfw, blurry, lowres, error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, multiple views, logo, too many watermarks, white blank page, blank page'],
  ['light', 'nsfw, blurry, lowres, error, worst quality, bad quality, jpeg artifacts, very displeasing, white blank page, blank page'],
  ['heavy', 'nsfw, lowres, {bad}, error, fewer, extra, missing, worst quality, jpeg artifacts, bad quality, watermark, unfinished, displeasing, chromatic aberration, signature, extra digits, artistic error, username, scan, [abstract]'],
  ['light', 'nsfw, lowres, jpeg artifacts, worst quality, watermark, blurry, very displeasing'],
  ['heavy', 'nsfw, {{worst quality}}, [displeasing], {unusual pupils}, guide lines, {{unfinished}}, {bad}, url, artist name, {{tall image}}, mosaic, {sketch page}, comic panel, impact (font), [dated], {logo}, ych, {what}, {where is your god now}, {distorted text}, repeated text, {floating head}, {1994}, {widescreen}, absolutely everyone, sequence, {compression artifacts}, hard translated, {cropped}, {commissioner name}, unknown text, high contrast'],
  ['light', '{worst quality}, guide lines, unfinished, bad, url, tall image, widescreen, compression artifacts, unknown text'],
  ['light', 'lowres, bad hands, bad anatomy, artistic error, sepia, white haze, worst quality, very displeasing, jpeg artifacts, 0::ai-generated::'],
  ['furry_focus', '{worst quality}, distracting watermark, unfinished, bad quality, {widescreen}, upscale, {sequence}, {{grandfathered content}}, blurred foreground, chromatic aberration, sketch, everyone, [sketch background], simple, [flat colors], ych (character), outline, multiple scenes, [[horror (theme)]], comic'],
]);

function tokens(text) {
  return String(text ?? '')
    .split(',')
    .map((t) => t.trim().toLowerCase().replace(/\s+/g, ' '))
    .filter(Boolean);
}

function runMatches(list, needle, at) {
  if (at + needle.length > list.length) return false;
  return needle.every((token, i) => list[i + at] === token);
}

const QUALITY_TOKENS = new Set(QUALITY_TAG_SETS.flatMap((set) => tokens(set)));

const TEXT_FIELD = /(^|[\s,.])(text\s*:)/i;

function splitTextField(prompt) {
  const whole = String(prompt ?? '');
  const match = TEXT_FIELD.exec(whole);
  if (!match) return { head: whole, tail: '' };

  const at = match.index + match[1].length;
  return {
    head: whole.slice(0, at).replace(/[\s,.]+$/g, ''),
    tail: whole.slice(at),
  };
}

function rejoinTextField(head, tail) {
  if (!tail) return head;
  return head ? `${head}. ${tail}` : tail;
}

function stripQualityTags(prompt) {
  const { head, tail } = splitTextField(prompt);
  const parts = head.split(',').map((t) => t.trim()).filter(Boolean);
  let end = parts.length;
  while (end > 0 && QUALITY_TOKENS.has(parts[end - 1].toLowerCase())) end--;
  if (end === 0) return rejoinTextField(parts.join(', '), tail);
  return rejoinTextField(parts.slice(0, end).join(', '), tail);
}

function detectQualityTags(prompt) {
  const { head, tail } = splitTextField(prompt);
  const list = tokens(head);
  if (list.length === 0) return { prompt, qualityToggle: null };

  let longest = 0;
  for (const set of QUALITY_TAG_SETS) {
    const needle = tokens(set).filter((tag) => !(tail && tag === 'no text'));
    if (needle.length === 0 || needle.length <= longest) continue;
    if (runMatches(list, needle, list.length - needle.length)) longest = needle.length;
  }

  if (longest === 0) return { prompt, qualityToggle: false };
  if (longest === list.length && !tail) return { prompt, qualityToggle: null };

  const raw = head.split(',');
  return {
    prompt: rejoinTextField(
      raw.slice(0, raw.length - longest).map((t) => t.trim()).filter(Boolean).join(', '),
      tail,
    ),
    qualityToggle: true,
  };
}

function detectUcPreset(negativePrompt) {
  const list = tokens(negativePrompt);
  if (list.length === 0) return { negativePrompt, ucPreset: null };

  let best = { length: 0, preset: 'none' };
  for (const [preset, text] of UC_PRESET_TEXTS) {
    const needle = tokens(text);
    if (needle.length <= best.length) continue;
    if (runMatches(list, needle, 0)) best = { length: needle.length, preset };
  }

  if (best.length === 0) return { negativePrompt, ucPreset: 'none' };

  const raw = String(negativePrompt).split(',');
  return {
    negativePrompt: raw.slice(best.length).map((t) => t.trim()).filter(Boolean).join(', '),
    ucPreset: best.preset,
  };
}

function centerToPosition(center) {
  if (!center) return '';
  const clamp = (n) => Math.min(4, Math.max(0, n));
  const col = clamp(Math.round((Number(center.x) - 0.5) / 0.2) + 2);
  const row = clamp(Math.round((Number(center.y) - 0.5) / 0.2) + 2);
  return `${'ABCDE'[col]}${row + 1}`;
}

export function metadataToRail(comment, { clean = false } = {}) {
  const c = comment ?? {};
  const v4 = c.v4_prompt?.caption ?? null;
  const v4uc = c.v4_negative_prompt?.caption ?? null;

  const basePrompt = v4?.base_caption ?? c.prompt ?? '';
  const baseUc = v4uc?.base_caption ?? c.uc ?? '';

  const useCoords = c.v4_prompt?.use_coords === true;
  const captions = v4?.char_captions ?? [];
  const ucCaptions = v4uc?.char_captions ?? [];
  const characters = captions.map((entry, i) => ({
    prompt: String(entry?.char_caption ?? '').trim(),
    uc: String(ucCaptions[i]?.char_caption ?? '').trim(),
    position: useCoords ? centerToPosition(entry?.centers?.[0]) : '',
    gender: 'other',
    tab: 'prompt',
    enabled: true,
  })).filter((entry) => entry.prompt);

  const settings = {};
  if (Number.isFinite(c.steps)) settings.steps = c.steps;
  if (Number.isFinite(c.scale)) settings.guidance = c.scale;
  if (typeof c.sampler === 'string') settings.sampler = c.sampler;
  if (Number.isFinite(c.width)) settings.width = c.width;
  if (Number.isFinite(c.height)) settings.height = c.height;

  const detectedPrompt = detectQualityTags(basePrompt);
  const detectedUc = detectUcPreset(baseUc);

  return {
    prompt: clean ? stripQualityTags(detectedPrompt.prompt) : detectedPrompt.prompt,
    negativePrompt: detectedUc.negativePrompt,
    characters,
    settings,
    qualityToggle: detectedPrompt.qualityToggle,
    ucPreset: detectedUc.ucPreset,
    seed: Number.isFinite(c.seed) ? c.seed : null,
  };
}

export const __test = {
  stripQualityTags, centerToPosition, readAlphaBits, decodeStealthAlpha,
  detectQualityTags, detectUcPreset,
};
