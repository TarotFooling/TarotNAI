export const BRACKET_STEP = 1.05;

export function parseEmphasis(text) {
  const runs = [];
  const stack = [];
  let runStart = 0;

  const weightNow = () => stack.reduce((w, s) => w * s.factor, 1);

  let runWeight = 1;

  const noteWeight = () => {
    runWeight = weightNow();
  };

  const cut = (end) => {
    if (end > runStart) {
      runs.push({
        start: runStart,
        end,
        weight: runWeight,
        text: text.slice(runStart, end),
      });
    }
    runStart = end;
    runWeight = weightNow();
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (ch === '{' || ch === '[') {
      if (stack.length === 0) cut(i);
      stack.push({ kind: ch, factor: ch === '{' ? BRACKET_STEP : 1 / BRACKET_STEP });
      noteWeight();
      continue;
    }

    if (ch === '}' || ch === ']') {
      const want = ch === '}' ? '{' : '[';
      const top = stack[stack.length - 1];
      if (top && top.kind === want) {
        const outermost = stack.length === 1;
        stack.pop();
        if (outermost) cut(i + 1);
        continue;
      }
      continue;
    }

    if (ch === ':' && text[i + 1] === ':') {
      const before = text.slice(runStart, i);
      const m = /(-?\d*\.?\d+)$/.exec(before);

      if (m) {
        const factor = Number(m[0]);
        const numAt = i - m[0].length;
        cut(numAt);
        stack.push({ kind: '::', factor });
        noteWeight();
        i += 1;
        continue;
      }

      cut(i);
      stack.length = 0;
      cut(i + 2);
      const last = runs[runs.length - 1];
      if (last && last.start === i) last.terminator = true;
      i += 1;
      continue;
    }
  }

  cut(text.length);
  return runs;
}

const ALPHA_BASE = 0.2125;
const ALPHA_PER_UNIT = 0.375;
const ALPHA_MAX = 0.75;

export function emphasisStyle(weight) {
  if (!Number.isFinite(weight) || weight === 1) return null;

  const distance = Math.abs(weight - 1);
  const alpha = Math.min(ALPHA_MAX, ALPHA_BASE + ALPHA_PER_UNIT * distance);

  return {
    direction: weight > 1 ? 'up' : 'down',
    alpha: Number(alpha.toFixed(4)),
  };
}
