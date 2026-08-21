
import { z } from 'zod';
import { UC_PRESETS, DEFAULT_UC_PRESET } from './presets.js';
import { V5_CURATED_MODEL, V5_FULL_MODEL } from './modelIds.js';
import {
  MAX_VIBES,
  VIBE_MIN,
  VIBE_MAX,
  DEFAULT_REFERENCE_STRENGTH,
} from './vibe.js';

export const RESOLUTIONS = Object.freeze({
  '1024,1024': 'Square (1024x1024)',

  '832,1216': 'Portrait (832x1216)',
  '896,1152': 'Portrait (896x1152)',
  '768,1280': 'Portrait (768x1280)',
  '704,1344': 'Portrait (704x1344)',
  '640,1408': 'Portrait (640x1408)',
  '576,1472': 'Portrait (576x1472)',
  '512,1536': 'Portrait (512x1536)',

  '1216,832': 'Landscape (1216x832)',
  '1152,896': 'Landscape (1152x896)',
  '1280,768': 'Landscape (1280x768)',
  '1344,704': 'Landscape (1344x704)',
  '1408,640': 'Landscape (1408x640)',
  '1472,576': 'Landscape (1472x576)',
  '1536,512': 'Landscape (1536x512)',

  '512,768': 'Small Portrait (512x768)',
  '768,512': 'Small Landscape (768x512)',
  '640,640': 'Small Square (640x640)',

  '1024,1536': 'Large Portrait (1024x1536)',
  '1536,1024': 'Large Landscape (1536x1024)',
  '1472,1472': 'Large Square (1472x1472)',
  '1088,1920': 'Wallpaper Portrait (1088x1920)',
  '1920,1088': 'Wallpaper Landscape (1920x1088)',
});

export { V5_CURATED_MODEL, V5_FULL_MODEL };

export const MODELS = Object.freeze({
  [V5_CURATED_MODEL]: 'Anime v5 Curated',
  [V5_FULL_MODEL]: 'Anime v5 Full',
  'nai-diffusion-4-5-curated': 'Anime v4.5 Curated',
  'nai-diffusion-4-5-full': 'Anime v4.5 Full',
  'nai-diffusion-4-curated': 'Anime v4 Curated',
  'nai-diffusion-4-full': 'Anime v4 Full',
  'nai-diffusion-3': 'Anime v3',
  'nai-diffusion-furry-3': 'Furry v3',
});

export const SAMPLERS = Object.freeze({
  k_euler_ancestral: 'Euler Ancestral',
  k_euler: 'Euler',
  k_dpmpp_2s_ancestral: 'DPM++ 2S Ancestral',
  k_dpmpp_2m_sde: 'DPM++ 2M SDE',
  k_dpmpp_sde: 'DPM++ SDE',
  k_dpmpp_2m: 'DPM++ 2M',
});

export const DEFAULT_RESOLUTION = '832,1216';
export const DEFAULT_MODEL = V5_FULL_MODEL;
export const DEFAULT_SAMPLER = 'k_euler_ancestral';

export const DEFAULT_PROMPT = 'masterpiece, location, no text';
export const DEFAULT_NEGATIVE_PROMPT =
  'blurry, lowres, upscaled, artistic error, film grain, scan artifacts, worst quality, ' +
  'bad quality, jpeg artifacts, very displeasing, chromatic aberration, halftone, multiple views, ' +
  'logo, too many watermarks, negative space, blank page, ai-generated';

export const V45_STEPS = 28;
export const V45_DEFAULTS = Object.freeze({
  params_version: 3,
  legacy: false,
  qualityToggle: true,
  prefer_brownian: true,
  dynamic_thresholding: false,
  use_coords: false,
  use_order: true,
});

export const RANDOM_SEED = 0;

export const MIN_IMAGE_COUNT = 1;
export const MAX_IMAGE_COUNT = 4;
export const DEFAULT_IMAGE_COUNT = 1;

export const MAX_CHARACTERS = 15;

export const CHARACTER_POSITIONS = Object.freeze(
  ['A', 'B', 'C', 'D', 'E'].flatMap((col) => [1, 2, 3, 4, 5].map((row) => `${col}${row}`)),
);

export const DEFAULT_CHARACTER_POSITION = 'C3';

export function positionToCenter(position) {
  const p = position || DEFAULT_CHARACTER_POSITION;
  return {
    x: Math.round((0.5 + 0.2 * (p.charCodeAt(0) - 'C'.charCodeAt(0))) * 10) / 10,
    y: Math.round((0.5 + 0.2 * (Number(p[1]) - 3)) * 10) / 10,
  };
}

export const PROMPT_LIMIT = 8000;
export const CHARACTER_PROMPT_LIMIT = 2000;
export const V5_PROMPT_LIMIT = PROMPT_LIMIT * 2;
export const V5_CHARACTER_PROMPT_LIMIT = CHARACTER_PROMPT_LIMIT * 2;

const V5_MODELS = new Set([V5_CURATED_MODEL, V5_FULL_MODEL]);

export function promptLimit(model) {
  return V5_MODELS.has(model) ? V5_PROMPT_LIMIT : PROMPT_LIMIT;
}

export function characterPromptLimit(model) {
  return V5_MODELS.has(model) ? V5_CHARACTER_PROMPT_LIMIT : CHARACTER_PROMPT_LIMIT;
}

export const CharacterPromptSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, 'A character needs a prompt')
    .max(V5_CHARACTER_PROMPT_LIMIT),
  uc: z.string().trim().max(V5_CHARACTER_PROMPT_LIMIT).default(''),
  position: z
    .union([z.literal(''), z.enum(CHARACTER_POSITIONS)])
    .default(''),
});

export const VibeSchema = z.object({
  encoding: z
    .string()
    .min(1, 'A vibe needs an encoding')
    .refine((s) => !s.startsWith('data:'), {
      message: 'A vibe carries an encoding, not an image',
    }),
  strength: z.number().min(VIBE_MIN).max(VIBE_MAX).default(DEFAULT_REFERENCE_STRENGTH),
});

export const DEFAULT_INPAINT_STRENGTH = 0.7;
export const DEFAULT_STRENGTH = 0.7;
export const DEFAULT_NOISE = 0;

const Base64Png = z
  .string()
  .min(1)
  .refine((s) => !s.startsWith('data:'), {
    message: 'Send the bare base64 payload, not a data: URL',
  });

export const PRECISE_MIN = 0;
export const PRECISE_MAX = 1;
export const DEFAULT_PRECISE_STRENGTH = 1;
export const DEFAULT_PRECISE_FIDELITY = 1;

export const ANLAS_PER_PRECISE_REFERENCE = 5;

export const PRECISE_MODES = ['character&style', 'character', 'style'];
export const PRECISE_EXTRA_MODES = ['costume', 'delta'];
export const ALL_PRECISE_MODES = [...PRECISE_MODES, ...PRECISE_EXTRA_MODES];

export const PreciseSchema = z.object({
  image: Base64Png,
  strength: z.number().min(PRECISE_MIN).max(PRECISE_MAX).default(DEFAULT_PRECISE_STRENGTH),
  fidelity: z.number().min(PRECISE_MIN).max(PRECISE_MAX).default(DEFAULT_PRECISE_FIDELITY),
  mode: z.enum(ALL_PRECISE_MODES).default(PRECISE_MODES[0]),
});

const modelKeys = Object.keys(MODELS);

export const MIN_DIMENSION = 512;
export const DIMENSION_STEP = 64;
export const MAX_PIXELS = 3 * 1024 * 1024;
export const FIT_SHORT_AXIS = 896;
export const MAX_FIT_ASPECT_ERROR = 0.01;


export const MAX_INPAINT_DIMENSION = 2560;

export const MAX_DIMENSION = Math.floor(MAX_PIXELS / MIN_DIMENSION / DIMENSION_STEP)
  * DIMENSION_STEP;

export function isValidDimensions(width, height, { maxSide = MAX_DIMENSION } = {}) {
  return (
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width >= MIN_DIMENSION &&
    height >= MIN_DIMENSION &&
    width % DIMENSION_STEP === 0 &&
    height % DIMENSION_STEP === 0 &&
    width <= maxSide &&
    height <= maxSide &&
    width * height <= MAX_PIXELS
  );
}

export function fitToValid(width, height, { maxSide = MAX_DIMENSION } = {}) {
  if (!(width > 0) || !(height > 0)) {
    return { width: MIN_DIMENSION, height: MIN_DIMENSION };
  }

  const sideCap = Math.min(maxSide, MAX_DIMENSION);

  const snap = (n) => Math.max(
    Math.round(n / DIMENSION_STEP) * DIMENSION_STEP,
    MIN_DIMENSION,
  );

  
  const w = snap(width);
  const h = snap(height);
  if (w * h <= MAX_PIXELS && w <= sideCap && h <= sideCap) {
    
    const aspect = width / height;
    const snapErr = Math.abs(w / h - aspect) / aspect;
    if (snapErr > 1e-9) {
      const sourceScale = Math.sqrt(width * height);
      const drift = (a, b) => Math.abs(Math.sqrt(a * b) / sourceScale - 1);
      const snapDrift = drift(w, h);

      
      const REACH = 3;
      let better = null;
      for (let iw = -REACH; iw <= REACH; iw += 1) {
        for (let ih = -REACH; ih <= REACH; ih += 1) {
          const cw = w + iw * DIMENSION_STEP;
          const ch = h + ih * DIMENSION_STEP;
          if (cw < MIN_DIMENSION || ch < MIN_DIMENSION) continue;
          if (cw > sideCap || ch > sideCap) continue;
          if (cw * ch > MAX_PIXELS) continue;
          const err = Math.abs(cw / ch - aspect) / aspect;
          if (err >= snapErr - 1e-9) continue;
          if (drift(cw, ch) > snapDrift + 0.02) continue;
          if (!better || err < better.err) better = { width: cw, height: ch, err };
        }
      }
      if (better) return { width: better.width, height: better.height };
    }
    return { width: w, height: h };
  }

  
  const aspect = width / height;
  const portrait = width <= height;
  let best = null;

  for (let long = MIN_DIMENSION; long <= sideCap; long += DIMENSION_STEP) {
    const rawShort = portrait ? long * aspect : long / aspect;
    for (const round of [Math.floor, Math.ceil]) {
      const short = round(rawShort / DIMENSION_STEP) * DIMENSION_STEP;
      if (short < MIN_DIMENSION || short > sideCap) continue;
      const cand = portrait
        ? { width: short, height: long }
        : { width: long, height: short };
      if (cand.width * cand.height > MAX_PIXELS) continue;

      
      const err = Math.abs(cand.width / cand.height - aspect) / aspect;
      const area = cand.width * cand.height;
      if (err > MAX_FIT_ASPECT_ERROR) continue;
      if (
        !best
        || area > best.area
        || (area === best.area && err < best.err)
      ) {
        best = { ...cand, err, area };
      }
    }
  }

  
  if (!best) {
    const long = Math.min(sideCap, MAX_DIMENSION);
    const short = MIN_DIMENSION;
    if (long * short <= MAX_PIXELS) {
      return portrait
        ? { width: short, height: long }
        : { width: long, height: short };
    }
    return { width: MIN_DIMENSION, height: MIN_DIMENSION };
  }
  return { width: best.width, height: best.height };
}

const ResolutionSchema = z
  .string()
  .refine((value) => {
    const parts = value.split(',');
    if (parts.length !== 2) return false;
    const [width, height] = parts.map(Number);
    return isValidDimensions(width, height);
  }, {
    message:
      `Resolution must be "width,height" - each at least ${MIN_DIMENSION} and a ` +
      `multiple of ${DIMENSION_STEP}, with width x height no more than ${MAX_PIXELS}`,
  });

export const GenerationParamsSchema = z.object({
  prompt: z.string().trim().min(1, 'Prompt cannot be empty').max(V5_PROMPT_LIMIT),
  negativePrompt: z.string().trim().max(V5_PROMPT_LIMIT).default(''),
  resolution: ResolutionSchema.default(DEFAULT_RESOLUTION),
  model: z.enum(modelKeys).default(DEFAULT_MODEL),
  sampler: z.enum(Object.keys(SAMPLERS)).default(DEFAULT_SAMPLER),
  guidance: z.number().min(0).max(10).default(5),
  qualityToggle: z.boolean().default(true),
  transparentBg: z.boolean().default(false),
  ucPreset: z.enum(Object.keys(UC_PRESETS)).default(DEFAULT_UC_PRESET),
  steps: z.number().int().min(1).max(50).default(V45_STEPS),
  seed: z.number().int().min(0).max(4294967295).default(RANDOM_SEED),
  imageCount: z
    .number()
    .int()
    .min(MIN_IMAGE_COUNT)
    .max(MAX_IMAGE_COUNT)
    .default(DEFAULT_IMAGE_COUNT),
  characters: z.array(CharacterPromptSchema).max(MAX_CHARACTERS).default([]),

  image: Base64Png.optional(),
  mask: Base64Png.optional(),
  strength: z.number().min(0).max(1).default(DEFAULT_STRENGTH),
  noise: z.number().min(0).max(1).default(DEFAULT_NOISE),
  inpaintStrength: z.number().min(0.01).max(1).default(DEFAULT_INPAINT_STRENGTH),
  addOriginalImage: z.boolean().default(true),

  vibes: z.array(VibeSchema).max(MAX_VIBES).default([]),
  normalizeVibes: z.boolean().default(true),

  precise: PreciseSchema.nullish().default(null),
}).refine((p) => !p.mask || Boolean(p.image), {
  message: 'mask requires an image',
  path: ['mask'],
}).refine((p) => p.vibes.length === 0 || !(p.image && p.mask), {
  message: 'Vibe Transfer is not supported for inpainting',
  path: ['vibes'],
}).refine((p) => {
  if (!p.mask || !p.image) return true;
  const { width, height } = parseResolution(p.resolution);
  return width <= MAX_INPAINT_DIMENSION && height <= MAX_INPAINT_DIMENSION;
}, {
  message:
    `Inpainting is limited to ${MAX_INPAINT_DIMENSION}px on each side`,
  path: ['resolution'],
}).refine((p) => !p.precise || !(p.image && p.mask), {
  message: 'Precise Reference is not supported for inpainting',
  path: ['precise'],
}).superRefine((p, ctx) => {
  const limit = promptLimit(p.model);
  const charLimit = characterPromptLimit(p.model);

  if (p.prompt.length > limit) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Prompt is limited to ${limit} characters for ${MODELS[p.model]}`,
      path: ['prompt'],
    });
  }
  if (p.negativePrompt.length > limit) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Undesired content is limited to ${limit} characters for ${MODELS[p.model]}`,
      path: ['negativePrompt'],
    });
  }
  p.characters.forEach((c, i) => {
    if (c.prompt.length > charLimit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Character prompts are limited to ${charLimit} characters for ${MODELS[p.model]}`,
        path: ['characters', i, 'prompt'],
      });
    }
    if (c.uc.length > charLimit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Character undesired content is limited to ${charLimit} characters for ${MODELS[p.model]}`,
        path: ['characters', i, 'uc'],
      });
    }
  });
});

export const UPSCALE_SCALES = [2, 4];
export const DEFAULT_UPSCALE_SCALE = 4;
export const UPSCALE_MAX_INPUT_PIXELS = 640 * 640;

export const UPSCALE_MODELS = Object.freeze([V5_CURATED_MODEL, V5_FULL_MODEL]);

export function supportsUpscale(model) {
  return UPSCALE_MODELS.includes(model);
}

export const UpscaleParamsSchema = z.object({
  action: z.literal('upscale'),
  image: Base64Png,
  model: z
    .enum(modelKeys)
    .default(DEFAULT_MODEL)
    .refine(supportsUpscale, {
      message: 'Only the Anime v5 models support standalone upscaling',
    }),
  scale: z
    .number()
    .int()
    .refine((v) => UPSCALE_SCALES.includes(v), {
      message: `Scale must be one of ${UPSCALE_SCALES.join(', ')}`,
    })
    .default(DEFAULT_UPSCALE_SCALE),
});

export function parseUpscaleParams(input) {
  return UpscaleParamsSchema.parse(input ?? {});
}

export function isInpainting(params) {
  return Boolean(params.image && params.mask);
}

export function usesCoords(characters = []) {
  return characters.some((c) => Boolean(c.position));
}

const FIELD_LABELS = {
  prompt: 'Prompt',
  negativePrompt: 'Undesired content',
  resolution: 'Resolution',
  qualityToggle: 'Add quality tags',
  transparentBg: 'Transparent background',
  ucPreset: 'Undesired content preset',
  inpaintStrength: 'Inpaint strength',
  addOriginalImage: 'Overlay original image',
};

export function describeIssues(issues = []) {
  if (issues.length === 0) return 'Those settings are not valid.';
  const described = issues.slice(0, 3).map((issue) => {
    const path = (issue.path ?? []).join('.');
    const label = FIELD_LABELS[path] ?? path;
    if (issue.code === 'invalid_type' && issue.received === 'undefined') {
      return `${label || 'A required field'} is required`;
    }
    const generic = /^(String|Number|Array|Invalid|Expected|Required)/.test(issue.message);
    return generic && label ? `${label}: ${issue.message}` : issue.message;
  });
  const more = issues.length > described.length
    ? ` (+${issues.length - described.length} more)`
    : '';
  return `${described.join('; ')}${more}`;
}

export function describeParamsError(err) {
  if (Array.isArray(err?.issues)) return describeIssues(err.issues);
  return err?.message ?? 'Those parameters are not valid.';
}

export function parseGenerationParams(input) {
  return GenerationParamsSchema.parse(input ?? {});
}

export function safeParseGenerationParams(input) {
  return GenerationParamsSchema.safeParse(input ?? {});
}

export function parseResolution(resolution) {
  const [width, height] = resolution.split(',').map(Number);
  return { width, height };
}
