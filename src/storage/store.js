
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const hashBytes = (bytes) => createHash('md5').update(bytes).digest('hex');

export function dateKey(when = new Date()) {
  const y = when.getFullYear();
  const m = String(when.getMonth() + 1).padStart(2, '0');
  const d = String(when.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export class ImageStore {
  #root;
  #seq = 0;

  constructor(root) {
    this.#root = path.resolve(root);
  }

  get root() {
    return this.#root;
  }

  async save({ bytes, job, seed, now = new Date() }) {
    const id = hashBytes(bytes);
    const dir = path.join(this.#root, dateKey(now));
    await fs.mkdir(dir, { recursive: true });

    const pngPath = path.join(dir, `${id}.png`);
    await fs.writeFile(pngPath, bytes);

    const sidecar = {
      id,
      seed,
      params: job.params,
      createdAt: now.toISOString(),
      seq: this.#seq++,
    };
    await fs.writeFile(path.join(dir, `${id}.json`), JSON.stringify(sidecar, null, 2), 'utf8');

    return { id, pngPath, dir };
  }

  async #dateDirs() {
    let dates;
    try {
      dates = await fs.readdir(this.#root, { withFileTypes: true });
    } catch {
      return [];
    }
    return dates
      .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
      .map((e) => path.join(this.#root, e.name));
  }

  async find(id) {
    if (!/^[a-f0-9]{32}$/.test(id ?? '')) return null;

    for (const dir of await this.#dateDirs()) {
      const pngPath = path.join(dir, `${id}.png`);
      try {
        await fs.access(pngPath);
      } catch {
        continue;
      }
      let meta = null;
      try {
        meta = JSON.parse(await fs.readFile(path.join(dir, `${id}.json`), 'utf8'));
      } catch {
      }
      return { id, pngPath, dir, meta };
    }
    return null;
  }

  async read(pngPath) {
    return fs.readFile(pngPath);
  }

  
  get #cacheDir() {
    return path.join(this.#root, 'cache');
  }

  async webpFor(id, encode) {
    const found = await this.find(id);
    if (!found) return null;

    const cached = path.join(this.#cacheDir, `${id}.webp`);
    const cachedPng = path.join(this.#cacheDir, `${id}.png`);
    for (const [file, ext] of [[cached, 'webp'], [cachedPng, 'png']]) {
      try {
        return { bytes: await fs.readFile(file), ext };
      } catch {
      }
    }

    const { bytes, ext } = await encode(await this.read(found.pngPath));
    const cachePath = ext === 'webp' ? cached : cachedPng;

    await fs.mkdir(this.#cacheDir, { recursive: true });
    const tmp = `${cachePath}.${process.pid}.tmp`;
    try {
      await fs.writeFile(tmp, bytes);
      await fs.rename(tmp, cachePath);
    } catch {
      await fs.rm(tmp, { force: true }).catch(() => {});
    }
    return { bytes, ext };
  }
}
