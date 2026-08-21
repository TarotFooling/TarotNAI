import { Runner } from './generate/runner.js';
import { Auth } from './web/auth.js';
import { SessionStore } from './web/sessionStore.js';
import { createServer } from './web/server.js';
import {
  createGenerator,
  createVibeEncoder,
  createTagSuggester,
  createBalanceReader,
} from './nai/client.js';
import { ImageStore } from './storage/store.js';
import { config, checkConfig } from './config.js';

const status = checkConfig();
for (const warning of status.warnings) console.warn(`  warning: ${warning}`);
if (!status.ok) {
  console.warn(`  missing config: ${status.missing.join(', ')}`);
  console.warn('  See .env.example.');
}

const generator = config.naiKey
  ? createGenerator(config.naiKey, { log: config.logRequests })
  : async () => {
      throw Object.assign(new Error('No NAI key configured. See .env.example.'), {
        code: 'no_keys',
      });
    };

const runner = new Runner({ generator });

const sweep = setInterval(() => runner.sweepTimedOut(), 30_000);
sweep.unref();

const auth = new Auth({
  mode: config.authMode,
  password: config.password,
  clientId: config.oauth.clientId,
  clientSecret: config.oauth.clientSecret,
  redirectUri: config.oauth.redirectUri,
  userId: config.oauth.userId,
  sessionStore: new SessionStore(config.sessionFile),
});

if (await auth.restore()) console.log('  signed-in session restored from disk');

const store = new ImageStore(config.imagesDir);

const readBalance = config.naiKey ? createBalanceReader(config.naiKey, { log: false }) : null;

const server = createServer({
  runner,
  auth,
  config,
  store,
  encodeVibe: config.naiKey
    ? createVibeEncoder(config.naiKey, { log: config.logRequests })
    : null,
  suggestTags: config.naiKey ? createTagSuggester(config.naiKey, { log: false }) : null,
  readBalance,
});

server.listen(config.port, config.host, () => {
  const shown = config.host === '0.0.0.0' ? 'localhost' : config.host;
  console.log(`  TarotNAI listening on http://${shown}:${config.port}`);

  if (config.authMode === 'open') console.log('  auth: open - anyone who can reach this port');
  else if (config.authMode === 'password') console.log('  auth: password');
  else console.log('  auth: Discord OAuth');

  // Warm the balance cache now so the first page load does not have to wait on
  // a cold NovelAI round-trip before it can show Anlas and generation cost.
  readBalance?.()
    .then((balance) => {
      const opus = balance.opus ? `, Opus ${balance.opus.percent}%` : '';
      console.log(`  NovelAI account ready: ${balance.anlas} Anlas${opus}`);
    })
    .catch((err) => {
      console.warn(`  could not reach NovelAI: ${err.message}`);
    });
});

const shutdown = () => {
  clearInterval(sweep);
  runner.stop();

  auth.flush().catch(() => {}).then(() => server.close(() => process.exit(0)));

  setTimeout(() => process.exit(0), 3000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
