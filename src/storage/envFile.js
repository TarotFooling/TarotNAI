import fs from 'node:fs/promises';
import path from 'node:path';

const ENV_PATH = path.resolve(process.cwd(), '.env');


const UNSAFE = /[\r\n\0]/;


export async function writeEnvValue(key, value) {
  if (UNSAFE.test(value)) {
    throw Object.assign(new Error('Value contains a line break.'), { code: 'unsafe_value' });
  }

  let original = '';
  try {
    original = await fs.readFile(ENV_PATH, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const lines = original ? original.split(/\r?\n/) : [];
  const assignment = `${key}=${value}`;


  const pattern = new RegExp(`^\\s*(?:#\\s*)?${key}\\s*=`);

  const at = lines.findIndex((line) => pattern.test(line));
  if (at === -1) {
    if (lines.length && lines[lines.length - 1].trim() !== '') lines.push('');
    lines.push(assignment, '');
  } else {
    lines[at] = assignment;
  }

  await fs.writeFile(ENV_PATH, lines.join(eol), { encoding: 'utf8', mode: 0o600 });

  return ENV_PATH;
}
