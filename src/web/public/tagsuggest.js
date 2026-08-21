const SEPARATORS = /[,\n]/;

const LEADING = /^[\s{[]*(?:-?\d*\.?\d+\s*::)?\s*/;

const TRAILING = /[\s\]}]*(?:::)?[\s\]}]*$/;

export function tagAtCaret(text, caret) {
  if (typeof text !== 'string') return null;
  const pos = Math.max(0, Math.min(caret ?? 0, text.length));

  let start = pos;
  while (start > 0 && !SEPARATORS.test(text[start - 1])) start -= 1;

  let end = pos;
  while (end < text.length && !SEPARATORS.test(text[end])) end += 1;

  const raw = text.slice(start, end);

  const lead = LEADING.exec(raw)?.[0].length ?? 0;
  const afterLead = raw.slice(lead);
  const trail = TRAILING.exec(afterLead)?.[0].length ?? 0;

  const value = afterLead.slice(0, afterLead.length - trail);
  if (!value) return null;

  const valueStart = start + lead;
  const valueEnd = valueStart + value.length;

  if (pos < valueStart || pos > valueEnd) return null;

  return { value, start: valueStart, end: valueEnd };
}

export function applySuggestion(text, span, tag) {
  const before = text.slice(0, span.start);
  const after = text.slice(span.end);

  const trailingIsEmpty = after.trim() === '';
  const insert = trailingIsEmpty ? `${tag}, ` : tag;

  return {
    text: before + insert + after,
    caret: before.length + insert.length,
  };
}

const COUNT_CEILING = 10000;
const MIN_ALPHA = 0.08;
const MAX_ALPHA = 1;

export function dotOpacity(count) {
  const n = Number.isFinite(count) ? count : 0;
  if (n >= COUNT_CEILING) return MAX_ALPHA;
  if (n <= 0) return MIN_ALPHA;

  const alpha = Math.max(MIN_ALPHA, n / COUNT_CEILING);
  return Number(alpha.toFixed(3));
}

export function displayTag(tag) {
  return tag;
}
