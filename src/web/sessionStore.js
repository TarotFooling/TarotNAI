import fs from 'node:fs/promises';
import path from 'node:path';

const FILE_MODE = 0o600;

export class SessionStore {
  #file;

  constructor(file) {
    this.#file = path.resolve(file);
  }

  get file() {
    return this.#file;
  }

  async load({ now = Date.now() } = {}) {
    let raw;
    try {
      raw = await fs.readFile(this.#file, 'utf8');
    } catch {
      return null;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    const { sessionId, session } = parsed;
    if (typeof sessionId !== 'string' || !sessionId) return null;
    if (!session || typeof session !== 'object') return null;
    if (typeof session.expiresAt !== 'number' || !(session.expiresAt > now)) return null;

    return {
      sessionId,
      session: {
        username: typeof session.username === 'string' ? session.username : '',
        avatar: typeof session.avatar === 'string' ? session.avatar : null,
        discordId: typeof session.discordId === 'string' ? session.discordId : null,
        expiresAt: session.expiresAt,
      },
    };
  }

  async save(sessionId, session, { now = Date.now() } = {}) {
    const live = sessionId && session && session.expiresAt > now;
    if (!live) return this.clear();

    const tmp = `${this.#file}.tmp`;
    try {
      await fs.mkdir(path.dirname(this.#file), { recursive: true });
      await fs.writeFile(tmp, JSON.stringify({ sessionId, session }), { mode: FILE_MODE });
      await fs.rename(tmp, this.#file);
      await fs.chmod(this.#file, FILE_MODE).catch(() => {});
      return true;
    } catch {
      await fs.rm(tmp, { force: true }).catch(() => {});
      return false;
    }
  }

  async clear() {
    try {
      await fs.rm(this.#file, { force: true });
      return true;
    } catch {
      return false;
    }
  }
}
