const bool = (value, fallback = false) => {
  const s = (value ?? '').trim().toLowerCase();
  if (s === '') return fallback;
  return s === 'true' || s === '1' || s === 'yes' || s === 'on';
};

const oauthEnabled = bool(process.env.OAUTH_ENABLED, false);
const password = process.env.APP_PASSWORD ?? '';

const authMode = oauthEnabled ? 'oauth' : password ? 'password' : 'open';

export const config = Object.freeze({
  port: Number(process.env.PORT ?? 8744),

  host: process.env.HOST ?? '127.0.0.1',

  naiKey: (process.env.NAI_KEY ?? '').trim(),

  authMode,

  password,

  oauth: Object.freeze({
    enabled: oauthEnabled,
    clientId: process.env.DISCORD_CLIENT_ID ?? '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
    redirectUri:
      process.env.DISCORD_REDIRECT_URI ??
      `http://localhost:${process.env.PORT ?? 8744}/auth/callback`,
    userId: (process.env.DISCORD_USER_ID ?? '').trim(),
  }),

  logRequests: bool(process.env.LOG_REQUESTS, true),

  imagesDir: process.env.IMAGES_DIR ?? 'images',

  sessionFile: process.env.SESSION_FILE ?? '.sessions.json',
});

export function checkConfig() {
  const missing = [];
  const warnings = [];

  if (!config.naiKey) {
    warnings.push('NAI_KEY is empty - generation will fail until it is set.');
  }

  if (config.authMode === 'oauth') {
    if (!config.oauth.clientId) missing.push('DISCORD_CLIENT_ID');
    if (!config.oauth.clientSecret) missing.push('DISCORD_CLIENT_SECRET');
    if (!config.oauth.userId) missing.push('DISCORD_USER_ID');

    if (config.oauth.userId && !/^\d{17,20}$/.test(config.oauth.userId)) {
      warnings.push(
        `DISCORD_USER_ID "${config.oauth.userId}" does not look like a Discord ID - ` +
          'it should be all digits. A username will never match.',
      );
    }
  }

  if (config.authMode === 'open' && config.host !== '127.0.0.1' && config.host !== 'localhost') {
    warnings.push(
      `HOST is ${config.host} with no APP_PASSWORD set - anyone who can reach ` +
        'this port can use your NovelAI key. Set APP_PASSWORD.',
    );
  }

  return { ok: missing.length === 0, missing, warnings };
}
