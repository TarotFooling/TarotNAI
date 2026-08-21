export const MAX_VIBES = 5;

export const DEFAULT_REFERENCE_STRENGTH = 0.6;
export const DEFAULT_INFORMATION_EXTRACTED = 0.7;

export const ANLAS_PER_ENCODE = 2;

export const VIBE_MIN = 0.01;
export const VIBE_MAX = 1;

const BUNDLE_ID = 'novelai-vibe-transfer-bundle';
const VIBE_ID = 'novelai-vibe-transfer';

const ENCODING_SET = 'v4-5full';

export function clampVibeValue(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, VIBE_MIN), VIBE_MAX);
}

export function parseVibeBundle(content) {
  const fail = (error) => ({ vibes: [], error, truncated: false });

  let data;
  try {
    const text = typeof content === 'string'
      ? content
      : new TextDecoder('utf-8', { fatal: true }).decode(content);
    data = JSON.parse(text);
  } catch {
    return fail('That file is not readable JSON.');
  }

  if (!data || typeof data !== 'object') return fail('That file is not a vibe bundle.');

  let entries;
  if (data.identifier === BUNDLE_ID && Array.isArray(data.vibes)) entries = data.vibes;
  else if (data.identifier === VIBE_ID) entries = [data];
  else return fail('That file is not a vibe bundle.');

  const vibes = [];
  for (const vibe of entries) {
    if (!vibe || vibe.identifier !== VIBE_ID) continue;

    const encodings = vibe.encodings?.[ENCODING_SET];
    if (!encodings || typeof encodings !== 'object') continue;

    const keys = Object.keys(encodings);
    if (keys.length === 0) continue;

    let encoding;
    if (vibe.type === 'encoding') {
      const key = 'unknown' in encodings ? 'unknown' : keys[0];
      encoding = encodings[key]?.encoding;
    } else {
      encoding = keys[0];
    }
    if (typeof encoding !== 'string' || !encoding) continue;

    const info = encodings[keys[0]]?.informationExtracted;

    vibes.push({
      encoding,
      strength: clampVibeValue(vibe.importInfo?.strength, DEFAULT_REFERENCE_STRENGTH),
      informationExtracted: Number.isFinite(Number(info)) ? Number(info) : null,
      name: typeof vibe.name === 'string' && vibe.name ? vibe.name : vibeName(encoding),
    });
  }

  if (vibes.length === 0) return fail('No usable v4.5 vibes in that file.');

  const truncated = vibes.length > MAX_VIBES;
  return { vibes: vibes.slice(0, MAX_VIBES), error: null, truncated };
}

export function vibeName(encoding) {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < encoding.length; i += 1) {
    const c = encoding.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b + c, 0x85ebca6b) >>> 0;
  }
  const hex = (n) => n.toString(16).padStart(8, '0').slice(0, 6);
  return `${hex(a)}-${hex(b)}`;
}

export function vibeCacheKey({ image, model, informationExtracted }) {
  return `${model}:${Number(informationExtracted).toFixed(2)}:${vibeName(image)}`;
}

export function vibeParameters(vibes = [], { normalize = true } = {}) {
  const usable = vibes.filter((v) => v && typeof v.encoding === 'string' && v.encoding);
  if (usable.length === 0) return {};
  return {
    reference_image_multiple: usable.map((v) => v.encoding),
    reference_strength_multiple: usable.map((v) =>
      clampVibeValue(v.strength, DEFAULT_REFERENCE_STRENGTH)),
    normalize_reference_strength_multiple: normalize,
  };
}
