let tables = null;

export async function loadRandomPromptTables(fetchImpl = fetch) {
  if (tables) return tables;
  const res = await fetchImpl('/data/random-prompt.json');
  if (!res.ok) throw new Error(`random-prompt tables ${res.status}`);
  tables = await res.json();
  return tables;
}

export function setRandomPromptTables(next) {
  tables = next;
}

const randInt = (max, min = 0) => Math.floor(Math.random() * (max - min)) + min;

function pick(table, flags) {
  const usable = table.filter((entry) => {
    for (const flag of entry.excludes ?? []) if (flags.has(flag)) return false;
    for (const flag of entry.requires ?? []) if (!flags.has(flag)) return false;
    return true;
  });

  let total = 0;
  for (const entry of usable) total += entry.weight;
  if (total <= 0) return '';

  const roll = randInt(total, 1);
  let seen = 0;
  for (const entry of usable) {
    seen += entry.weight;
    if (roll <= seen) {
      for (const flag of entry.requires ?? []) flags.add(flag);
      return entry.tag;
    }
  }
  return '';
}

const weighted = (pairs) => pairs.map(([tag, weight]) => ({ tag, weight }));

const COUNT_BY_CHARACTERS = {
  1: weighted([[0, 10], [1, 30], [2, 15], [3, 5]]),
  2: weighted([[0, 20], [1, 40], [2, 10]]),
  other: weighted([[0, 30], [1, 30]]),
};

const CLOTHING = weighted([
  ['uniform', 25],
  ['swimsuit', 5],
  ['bodysuit', 5],
  ['normal clothes', 40],
]);

function tagCount(characterCount, flags) {
  const table = COUNT_BY_CHARACTERS[characterCount] ?? COUNT_BY_CHARACTERS.other;
  return pick(table, flags);
}

function buildCharacter(t, sharedFlags, gender, characterCount) {
  const out = [];
  const flags = new Set(sharedFlags);

  if (Math.random() < 0.1) out.push(pick(t.sK, flags));
  if (Math.random() < 0.4) out.push(pick(t.s0, flags));
  if (Math.random() < 0.05) out.push(pick(t.s3, flags));

  if (!flags.has('no eyes')) {
    if (Math.random() < 0.2) out.push(pick(t.s2, flags));
    if (Math.random() < 0.8 && !flags.has('nocoloreyes')) out.push(pick(t.nb, flags));
  }

  if (Math.random() < 0.8) out.push(pick(t.s1, flags));
  if (Math.random() < 0.7) out.push(pick(t.s5, flags));
  if (Math.random() < 0.7) out.push(pick(t.n_, flags));
  if (Math.random() < 0.1) out.push(pick(t.nx, flags), pick(t.n_, flags));
  if (Math.random() < 0.3) out.push(pick(t.s6, flags));
  if (Math.random() < 0.4) out.push(pick(t.s8, flags));
  if (gender.startsWith('f') && Math.random() < 0.8) out.push(pick(t.s4, flags));

  const detail = tagCount(characterCount, flags);
  for (let i = 0; i < detail; i += 1) out.push(pick(t.s7, flags));

  if (Math.random() < 0.2) {
    out.push(pick(t.s9, flags));
    if (Math.random() < 0.2) out.push(pick(t.nt, flags));
  } else if (Math.random() < 0.3) {
    out.push(pick(t.ne, flags));
  }

  const withPrefix = (prefixTable, table) => {
    const usePrefix = Math.random() < 0.5;
    const prefix = pick(prefixTable, flags);
    const tag = pick(table, flags);
    if (tag) out.push(usePrefix ? `${prefix} ${tag}` : tag);
  };

  switch (pick(CLOTHING, flags)) {
    case 'uniform':
      out.push(pick(t.nl, flags));
      break;
    case 'swimsuit':
      out.push(pick(t.nd, flags));
      break;
    case 'bodysuit':
      out.push(pick(t.nc, flags));
      break;
    case 'normal clothes':
      if (gender.startsWith('f') && Math.random() < 0.5) {
        out.push(pick(t.ni, flags));
        if (Math.random() < 0.2) out.push(pick(t.nr, flags));
      }
      if (gender.startsWith('f') && Math.random() < 0.2) {
        withPrefix(t.nw, t.na);
      } else {
        if (Math.random() < 0.85) withPrefix(t.nw, t.ns);
        if (flags.has('legs')) {
          if (Math.random() < 0.85) withPrefix(t.nw, t.nn);
          if (flags.has('feet') && Math.random() < 0.6) withPrefix(t.nw, t.no);
        }
      }
      break;
    default:
      break;
  }

  if (Math.random() < 0.6) out.push(pick(t.np, flags));
  if (Math.random() < 0.4) out.push(pick(t.nf, flags));

  const extra = tagCount(characterCount, flags);
  for (let i = 0; i < extra; i += 1) out.push(pick(t.nh, flags));

  return out.filter((tag) => tag !== '');
}

const COUNT_PREFIX = {
  female: ['1girl', '2girls', '3girls'],
  male: ['1boy', '2boys', '3boys'],
  other: ['1other', '2others', '3others'],
};

export function randomPrompt(tableSet = tables) {
  const t = tableSet?.v4;
  if (!t) throw new Error('random-prompt tables not loaded');

  const base = [];
  const flags = new Set();
  const characterPrompts = [];

  const count = pick(weighted([[1, 70], [2, 20], [3, 7], [0, 5]]), flags);

  if (count === 0) {
    base.push('no humans');
    if (Math.random() < 0.5) base.push(pick(t.sZ, flags));
    base.push(pick(t.sQ, flags));

    const objects = pick(weighted([[2, 15], [3, 50], [4, 15], [5, 5]]), flags);
    for (let i = 0; i < objects; i += 1) base.push(pick(t.nm, flags));

    let extra = pick(weighted([[0, 15], [1, 10], [2, 20], [3, 20], [4, 20], [5, 15]]), flags);
    extra -= count;
    if (extra < 0) extra = 0;
    for (let i = 0; i < extra; i += 1) base.push(pick(t.nu, flags));

    return { prompt: base.join(', '), characters: [] };
  }

  if (Math.random() < 0.5) base.push(pick(t.sZ, flags));

  const genders = { female: 0, male: 0, other: 0 };
  const GENDER_KEY = { m: 'male', f: 'female', o: 'other' };
  for (let i = 0; i < count; i += 1) {
    const roll = pick(weighted([['m', 30], ['f', 60], ['o', 0]]), flags);
    genders[GENDER_KEY[roll] ?? 'other'] += 1;
  }

  for (const key of ['female', 'male', 'other']) {
    const n = genders[key];
    if (n >= 1 && n <= 3) base.unshift(COUNT_PREFIX[key][n - 1]);
  }

  if (Math.random() < 0.8) {
    const setting = pick(t.sJ, flags);
    base.push(setting);
    if (setting === 'scenery' && Math.random() < 0.5) {
      const n = randInt(3, 1);
      for (let i = 0; i < n; i += 1) base.push(pick(t.nm, flags));
    }
  }

  if (Math.random() < 0.3) base.push(pick(t.s$, flags));

  let shared;
  if (Math.random() < 0.7) {
    shared = pick(t.sX, flags);
    if (shared) base.push(shared);
  }

  for (const [key, seed] of [['female', 'girl'], ['male', 'boy'], ['other', 'other']]) {
    for (let i = 0; i < genders[key]; i += 1) {
      const gender = key === 'female' ? 'f' : key === 'male' ? 'm' : 'o';
      characterPrompts.push({
        gender: key,
        prompt: [seed, ...buildCharacter(t, flags, gender, count)].join(', '),
      });
    }
  }

  if (Math.random() < 0.2) {
    const n = count === 2 ? randInt(3) : randInt(4);
    for (let i = 0; i < n; i += 1) base.push(pick(t.nu, flags));
  }

  if (Math.random() < 0.25) {
    const n = randInt(3, 1);
    for (let i = 0; i < n; i += 1) base.push(pick(t.ny, flags));
  }

  if (Math.random() < 0.2) base.push(pick(t.ng, flags));
  if (Math.random() < 0.1) base.push(pick(t.sY, flags));

  const prompt = [...new Set(base.join(', ').split(', '))]
    .filter((tag) => tag !== '')
    .join(', ');

  return { prompt, characters: characterPrompts };
}
