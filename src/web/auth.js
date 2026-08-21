import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';

const DISCORD_API = 'https://discord.com/api/v10';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SAVE_DEBOUNCE_MS = 2000;

export const OWNER = Object.freeze({
  userId: 'owner',
  username: 'You',
  avatar: null,
});

export class Auth {
  #session = null;
  #sessionId = null;
  #pendingStates = new Map();
  #config;
  #fetch;
  #store;
  #saveTimer = null;

  constructor(config = {}) {
    this.#config = { mode: 'open', password: '', userId: '', ...config };
    this.#fetch = config.fetch ?? ((...args) => globalThis.fetch(...args));
    this.#store = config.sessionStore ?? null;
  }

  get mode() {
    return this.#config.mode;
  }

  get isOpen() {
    return this.#config.mode === 'open';
  }

  get configured() {
    if (this.#config.mode === 'open') return true;
    if (this.#config.mode === 'password') return Boolean(this.#config.password);
    return Boolean(this.#config.clientId && this.#config.clientSecret && this.#config.userId);
  }

  async restore() {
    if (!this.#store || this.isOpen) return 0;

    const saved = await this.#store.load();
    if (!saved) return 0;

    this.#sessionId = saved.sessionId;
    this.#session = saved.session;
    return 1;
  }

  #scheduleSave() {
    if (!this.#store || this.isOpen || this.#saveTimer) return;
    this.#saveTimer = setTimeout(() => {
      this.#saveTimer = null;
      this.#store.save(this.#sessionId, this.#session).catch(() => {});
    }, SAVE_DEBOUNCE_MS);
    this.#saveTimer.unref?.();
  }

  async flush() {
    if (!this.#store || this.isOpen) return false;
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
      this.#saveTimer = null;
    }
    return this.#store.save(this.#sessionId, this.#session);
  }

  #startSession(profile = {}) {
    this.#sessionId = randomBytes(32).toString('hex');
    this.#session = {
      username: profile.username ?? OWNER.username,
      avatar: profile.avatar ?? null,
      discordId: profile.discordId ?? null,
      expiresAt: Date.now() + SESSION_TTL_MS,
    };
    this.#scheduleSave();
    return this.#sessionId;
  }

  logInWithPassword(attempt) {
    if (this.#config.mode !== 'password') return null;
    if (!safeEqual(hash(attempt), hash(this.#config.password))) return null;
    return this.#startSession();
  }

  authorizeUrl() {
    const state = randomBytes(16).toString('hex');
    this.#pendingStates.set(state, Date.now());
    this.#sweepStates();

    const params = new URLSearchParams({
      client_id: this.#config.clientId,
      redirect_uri: this.#config.redirectUri,
      response_type: 'code',
      scope: 'identify',
      state,
      prompt: 'none',
    });
    return `https://discord.com/oauth2/authorize?${params}`;
  }

  async handleCallback({ code, state }) {
    if (!state || !this.#pendingStates.has(state)) {
      const err = new Error('Login state was missing or expired. Try again.');
      err.code = 'bad_state';
      throw err;
    }
    this.#pendingStates.delete(state);

    const token = await this.#exchangeCode(code);
    const user = await this.#fetchJson(`${DISCORD_API}/users/@me`, token);

    if (!this.#config.userId || user.id !== this.#config.userId) {
      const err = new Error('This account does not own this server.');
      err.code = 'not_allowed';
      err.user = { username: user.username, id: user.id };
      throw err;
    }

    const sessionId = this.#startSession({
      username: user.username,
      avatar: user.avatar ?? null,
      discordId: user.id,
    });

    return { sessionId, user: this.sessionUser(sessionId) };
  }

  sessionUser(sessionId) {
    if (this.isOpen) return { ...OWNER };
    if (!sessionId || sessionId !== this.#sessionId || !this.#session) return null;

    if (Date.now() > this.#session.expiresAt) {
      this.#session = null;
      this.#sessionId = null;
      this.#scheduleSave();
      return null;
    }

    return {
      userId: OWNER.userId,
      username: this.#session.username,
      avatar: this.#session.avatar ?? null,
      discordId: this.#session.discordId ?? null,
    };
  }

  destroySession(sessionId) {
    if (!sessionId || sessionId !== this.#sessionId) return false;
    this.#session = null;
    this.#sessionId = null;
    this.#scheduleSave();
    return true;
  }

  async #exchangeCode(code) {
    const body = new URLSearchParams({
      client_id: this.#config.clientId,
      client_secret: this.#config.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.#config.redirectUri,
    });

    const res = await this.#fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      const err = new Error(`Discord rejected the login (${res.status}).`);
      err.code = 'token_exchange_failed';
      throw err;
    }
    const json = await res.json();
    return json.access_token;
  }

  async #fetchJson(url, token) {
    const res = await this.#fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const err = new Error(`Discord API request failed (${res.status}).`);
      err.code = 'discord_api_failed';
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  #sweepStates() {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [state, created] of this.#pendingStates) {
      if (created < cutoff) this.#pendingStates.delete(state);
    }
  }
}

const hash = (value) => createHash('sha256').update(String(value ?? '')).digest();

export function safeEqual(a, b) {
  const bufA = Buffer.isBuffer(a) ? a : Buffer.from(String(a ?? ''));
  const bufB = Buffer.isBuffer(b) ? b : Buffer.from(String(b ?? ''));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
