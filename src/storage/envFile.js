import fs from 'node:fs/promises';
import path from 'node:path';

const ENV_PATH = path.resolve(process.cwd(), '.env');

// Anything that would break the file when read back, or smuggle a second
// setting in on the same line.
const UNSAFE = /[\r\n\0]/;

/**
 * Write a single KEY=value into .env, leaving every other line, comment and
 * blank exactly where it was. Creates the file if it is not there yet.
 *
 * NovelAI persistent tokens are long opaque strings with no quoting rules of
 * their own, so the value is written bare. A value containing a newline would
 * let a caller append arbitrary settings, so it is refused outright.
 */
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

  // Match an assignment for this key, commented out or not, so re-running the
  // setup gate updates the line the user already has rather than adding a
  // second one further down that the first would win over.
  const pattern = new RegExp(`^\\s*(?:#\\s*)?${key}\\s*=`);

  const at = lines.findIndex((line) => pattern.test(line));
  if (at === -1) {
    if (lines.length && lines[lines.length - 1].trim() !== '') lines.push('');
    lines.push(assignment, '');
  } else {
    lines[at] = assignment;
  }

  // 0600: the file holds an API token, so keep it to the owner where the
  // platform honours the mode. Windows ignores it, which is why this is a
  // hardening step and not the thing the safety of the token rests on.
  await fs.writeFile(ENV_PATH, lines.join(eol), { encoding: 'utf8', mode: 0o600 });

  return ENV_PATH;
}
