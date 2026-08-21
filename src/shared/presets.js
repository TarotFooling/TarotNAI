
import { V5_CURATED_MODEL, V5_FULL_MODEL } from './modelIds.js';

const V3_MODELS = new Set(['nai-diffusion-3', 'nai-diffusion-furry-3']);
const V4_MODELS = new Set(['nai-diffusion-4-curated', 'nai-diffusion-4-full']);
const V45_MODELS = new Set(['nai-diffusion-4-5-curated', 'nai-diffusion-4-5-full']);

const V5_MODELS = new Set([V5_CURATED_MODEL, V5_FULL_MODEL]);

const CURATED_MODELS = new Set([
  'nai-diffusion-4-curated',
  'nai-diffusion-4-5-curated',
  V5_CURATED_MODEL,
]);

const QUALITY_TAGS = Object.freeze({
  v3: 'best quality, amazing quality, very aesthetic, absurdres',
  v4_curated: 'rating:general, best quality, very aesthetic, absurdres',
  v4_full: 'no text, best quality, very aesthetic, absurdres',
  v45_curated: 'very aesthetic, masterpiece, no text, -0.8::feet::, rating:general',
  v45_full: 'very aesthetic, masterpiece, no text',
  v5: 'very aesthetic, masterpiece, no text',
  v5_light: 'very aesthetic, amazing quality, no text',
});

function qualityTagsFor(model) {
  if (V5_MODELS.has(model)) return QUALITY_TAGS.v5;
  if (V45_MODELS.has(model)) {
    return CURATED_MODELS.has(model) ? QUALITY_TAGS.v45_curated : QUALITY_TAGS.v45_full;
  }
  if (V4_MODELS.has(model)) {
    return CURATED_MODELS.has(model) ? QUALITY_TAGS.v4_curated : QUALITY_TAGS.v4_full;
  }
  if (V3_MODELS.has(model)) return QUALITY_TAGS.v3;
  return null;
}

function tokenize(text) {
  return (text ?? '')
    .split(',')
    .map((t) => t.trim().toLowerCase().replace(/\s+/g, ' '))
    .filter(Boolean);
}

const TEXT_FIELD = /(^|[\s,.])(text\s*:)/i;

const TEXT_TAGS =
  /(^|,)\s*(?:\{+|\[+|\d*\.?\d*::)*\s*(?:english |japanese |chinese |korean |handwritten |engrish )?text\s*(?:\}+|\]+|::)*\s*(?=,|$)/i;

export function wantsText(prompt) {
  const own = prompt ?? '';
  return TEXT_FIELD.test(own) || TEXT_TAGS.test(own);
}

export function splitTextField(prompt) {
  const match = TEXT_FIELD.exec(prompt);
  if (!match) return { head: prompt, tail: '' };

  const at = match.index + match[1].length;
  return {
    head: prompt.slice(0, at).replace(/[\s,.]+$/g, ''),
    tail: prompt.slice(at),
  };
}

export function dedupeTags(text) {
  const { head, tail } = splitTextField(text ?? '');

  const raw = head.split(',');
  const seen = new Set();
  const kept = [];

  for (const piece of raw) {
    const token = piece.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!token || seen.has(token)) continue;
    seen.add(token);
    kept.push(piece.trim());
  }

  const joined = kept.join(', ');
  if (!tail) return joined;
  return joined ? `${joined}. ${tail}` : tail;
}

export function splitPipeSyntax(prompt, hasCharacterBoxes = false) {
  const own = prompt ?? '';
  if (hasCharacterBoxes || !own.includes('|')) {
    return { base: own, characters: [], used: false };
  }

  const segments = own.split('|');
  const base = segments[0].replace(/^[\s,]+|[\s,]+$/g, '');
  const characters = segments
    .slice(1)
    .map((s) => s.replace(/^[\s,]+|[\s,]+$/g, ''))
    .filter(Boolean)
    .map((s) => ({ prompt: s, uc: '', position: '' }));

  if (characters.length === 0) return { base, characters: [], used: false };
  return { base, characters, used: true };
}

export function applyQualityTags(prompt, model, enabled) {
  if (!enabled) return prompt;

  const tags = qualityTagsFor(model);
  if (!tags) return prompt;

  const own = (prompt ?? '').replace(/^[\s,]+|[\s,]+$/g, '');
  if (!own) return prompt;

  const textual = wantsText(own);
  const wanted = textual
    ? tokenize(tags).filter((tag) => tag !== 'no text')
    : tokenize(tags);

  const { head, tail } = textual ? splitTextField(own) : { head: own, tail: '' };

  const present = new Set(tokenize(head));
  const missing = wanted.filter((tag) => !present.has(tag));

  if (missing.length === 0) return own;
  if (!head) return `${missing.join(', ')}${tail ? `. ${tail}` : ''}`;

  const withTags = `${head}, ${missing.join(', ')}`;
  return tail ? `${withTags}. ${tail}` : withTags;
}

export const TRANSPARENT_BG_TAGS = 'transparent background, has alpha';

export function applyTransparentBg(prompt, model, enabled) {
  if (!enabled || !V5_MODELS.has(model)) return prompt;

  const own = (prompt ?? '').replace(/^[\s,]+|[\s,]+$/g, '');
  const { head, tail } = splitTextField(own);

  const present = new Set(tokenize(head));
  const missing = tokenize(TRANSPARENT_BG_TAGS).filter((tag) => !present.has(tag));
  if (missing.length === 0) return own;

  const added = missing.join(', ');
  const withTags = head ? `${added}, ${head}` : added;
  return tail ? `${withTags}. ${tail}` : withTags;
}

export const UC_PRESETS = Object.freeze({
  heavy: 4,
  light: 5,
  human_focus: 6,
  furry_focus: 4,
  none: 3,
});

export const DEFAULT_UC_PRESET = 'heavy';

const V5_UC_PRESETS = {
  heavy:
    'lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, ' +
    'jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, ' +
    'multiple views, logo, too many watermarks, negative space, blank page',
  light:
    'lowres, bad hands, bad anatomy, artistic error, sepia, white haze, worst quality, ' +
    'very displeasing, jpeg artifacts, 0::ai-generated::',
  human_focus:
    'lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, ' +
    'jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, ' +
    'multiple views, logo, too many watermarks, negative space, blank page, @_@, ' +
    'mismatched pupils, glowing eyes, bad anatomy',
  furry_focus:
    '{worst quality}, distracting watermark, unfinished, bad quality, {widescreen}, upscale, ' +
    '{sequence}, {{grandfathered content}}, blurred foreground, chromatic aberration, sketch, ' +
    'everyone, [sketch background], simple, [flat colors], ych (character), outline, ' +
    'multiple scenes, [[horror (theme)]], comic',
  none: '',
};

const UC_PRESET_TEXT_BASE = {
  'nai-diffusion-4-5-curated': {
    heavy:
      'blurry, lowres, upscaled, artistic error, film grain, scan artifacts, worst quality, ' +
      'bad quality, jpeg artifacts, very displeasing, chromatic aberration, halftone, ' +
      'multiple views, logo, too many watermarks, negative space, blank page',
    light:
      'blurry, lowres, upscaled, artistic error, scan artifacts, jpeg artifacts, logo, ' +
      'too many watermarks, negative space, blank page',
    human_focus:
      'blurry, lowres, upscaled, artistic error, film grain, scan artifacts, bad anatomy, ' +
      'bad hands, worst quality, bad quality, jpeg artifacts, very displeasing, ' +
      'chromatic aberration, halftone, multiple views, logo, too many watermarks, @_@, ' +
      'mismatched pupils, glowing eyes, negative space, blank page',
    none: '',
  },
  'nai-diffusion-4-5-full': {
    heavy:
      'nsfw, lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, ' +
      'jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, ' +
      'multiple views, logo, too many watermarks, negative space, blank page',
    light:
      'nsfw, lowres, artistic error, scan artifacts, worst quality, bad quality, jpeg artifacts, ' +
      'multiple views, very displeasing, too many watermarks, negative space, blank page',
    human_focus:
      'nsfw, lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, ' +
      'jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, ' +
      'multiple views, logo, too many watermarks, negative space, blank page, @_@, ' +
      'mismatched pupils, glowing eyes, bad anatomy',
    none: '',
  },
  'nai-diffusion-4-curated': {
    heavy:
      'blurry, lowres, error, film grain, scan artifacts, worst quality, bad quality, ' +
      'jpeg artifacts, very displeasing, chromatic aberration, logo, dated, signature, ' +
      'multiple views, gigantic breasts, white blank page, blank page',
    light:
      'blurry, lowres, error, worst quality, bad quality, jpeg artifacts, very displeasing, ' +
      'logo, dated, signature',
    none: '',
  },
  'nai-diffusion-4-full': {
    heavy:
      'nsfw, blurry, lowres, error, film grain, scan artifacts, worst quality, bad quality, ' +
      'jpeg artifacts, very displeasing, chromatic aberration, multiple views, logo, ' +
      'too many watermarks, white blank page, blank page',
    light:
      'nsfw, blurry, lowres, error, worst quality, bad quality, jpeg artifacts, ' +
      'very displeasing, white blank page, blank page',
    none: '',
  },
  'nai-diffusion-3': {
    heavy:
      'nsfw, lowres, {bad}, error, fewer, extra, missing, worst quality, jpeg artifacts, ' +
      'bad quality, watermark, unfinished, displeasing, chromatic aberration, signature, ' +
      'extra digits, artistic error, username, scan, [abstract]',
    light: 'nsfw, lowres, jpeg artifacts, worst quality, watermark, blurry, very displeasing',
    none: 'lowres',
  },
  'nai-diffusion-furry-3': {
    heavy:
      'nsfw, {{worst quality}}, [displeasing], {unusual pupils}, guide lines, {{unfinished}}, ' +
      '{bad}, url, artist name, {{tall image}}, mosaic, {sketch page}, comic panel, ' +
      'impact (font), [dated], {logo}, ych, {what}, {where is your god now}, {distorted text}, ' +
      'repeated text, {floating head}, {1994}, {widescreen}, absolutely everyone, sequence, ' +
      '{compression artifacts}, hard translated, {cropped}, {commissioner name}, unknown text, ' +
      'high contrast',
    light:
      '{worst quality}, guide lines, unfinished, bad, url, tall image, widescreen, ' +
      'compression artifacts, unknown text',
    none: 'lowres',
  },
};

const UC_PRESET_TEXT = Object.freeze({
  ...UC_PRESET_TEXT_BASE,
  [V5_CURATED_MODEL]: V5_UC_PRESETS,
  [V5_FULL_MODEL]: V5_UC_PRESETS,
});

export function ucPresetText(model, preset) {
  const table = UC_PRESET_TEXT[model];
  if (!table) return '';

  const text = table[preset];
  if (text !== undefined) return text;
  if (preset === 'human_focus' || preset === 'furry_focus') return table.heavy ?? '';
  return '';
}

export function applyUcPreset(negativePrompt, model, preset) {
  const base = ucPresetText(model, preset);
  const own = (negativePrompt ?? '').replace(/^[\s,]+|[\s,]+$/g, '');

  if (!base) return own;
  if (!own) return base;

  const present = new Set(tokenize(base));
  const added = tokenize(own).filter((tag) => !present.has(tag));
  if (added.length === 0) return base;

  return `${base}, ${added.join(', ')}`;
}

export function applyNsfwToUc(prompt, negativePrompt, model, preset) {
  if (!V5_MODELS.has(model)) return negativePrompt;
  if (CURATED_MODELS.has(model) || preset === 'none') return negativePrompt;
  if (/nsfw/i.test(prompt ?? '')) return negativePrompt;

  const own = (negativePrompt ?? '').replace(/^[\s,]+/, '');
  return own ? `nsfw, ${own}` : 'nsfw';
}

export function stripNsfwFromUc(prompt, negativePrompt) {
  if (!/nsfw/i.test(prompt ?? '')) return negativePrompt;
  if (!/^nsfw\s*,/i.test(negativePrompt ?? '')) return negativePrompt;

  return negativePrompt.replace(/^nsfw\s*,/i, '').trim();
}

export function composePrompts({
  prompt,
  negativePrompt,
  model,
  qualityToggle,
  transparentBg,
  ucPreset,
  characters = [],
}) {
  const composedUc = applyNsfwToUc(
    prompt,
    stripNsfwFromUc(prompt, applyUcPreset(negativePrompt, model, ucPreset)),
    model,
    ucPreset,
  );

  const piped = splitPipeSyntax(prompt, characters.length > 0);

  return {
    prompt: dedupeTags(
      applyQualityTags(
        applyTransparentBg(piped.base, model, transparentBg),
        model,
        qualityToggle,
      ),
    ),
    negativePrompt: dedupeTags(composedUc),
    characters: piped.used
      ? piped.characters.map((c) => ({ ...c, prompt: dedupeTags(c.prompt) }))
      : characters,
  };
}
