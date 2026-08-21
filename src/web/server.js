import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { parseGenerationParams, describeParamsError, MODELS } from '../shared/params.js';
import { isTerminal } from '../shared/job.js';
import { VIBE_MIN, VIBE_MAX, parseVibeBundle } from '../shared/vibe.js';
import { toWebp } from '../shared/image.js';
import { createBalanceReader } from '../nai/client.js';
import { deniedPage } from './denied.js';
import { loginPage } from './loginPage.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, 'public');

const SSE_END = 'end';

const VIBE_UPLOAD_LIMIT = 12 * 1024 * 1024;

const GENERATE_BODY_LIMIT = 24 * 1024 * 1024;


const SUGGEST_PROMPT_MAX = 200;

const VibeEncodeRequestSchema = z.object({
  image: z
    .string()
    .min(1)
    .refine((s) => !s.startsWith('data:'), {
      message: 'Send the bare base64 payload, not a data: URL',
    }),
  model: z.enum(Object.keys(MODELS)),
  informationExtracted: z.number().min(VIBE_MIN).max(VIBE_MAX),
});

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

const json = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
};

const parseCookies = (header) =>
  Object.fromEntries(
    (header ?? '')
      .split(';')
      .map((part) => part.trim().split('='))
      .filter(([k, v]) => k && v !== undefined)
      .map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]),
  );


const readBody = (req, limit = 64 * 1024) =>
  new Promise((resolve, reject) => {
    let size = 0;
    let chunks = [];
    const onData = (chunk) => {
      size += chunk.length;
      if (size > limit) {
        req.off('data', onData);
        chunks = [];
        req.resume();
        reject(Object.assign(new Error('Request body too large'), { code: 'too_large' }));
        return;
      }
      chunks.push(chunk);
    };
    req.on('data', onData);
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });


const sessionCookie = (req, sessionId) => {
  const proto = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim();
  const secure = proto === 'https' || Boolean(req.socket?.encrypted);

  return [
    `sid=${sessionId}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${7 * 24 * 60 * 60}`,
    secure ? 'Secure' : null,
  ]
    .filter(Boolean)
    .join('; ');
};

export function createServer({
  runner,
  auth,
  config,
  store = null,
  encodeVibe = null,
  suggestTags = null,
  readBalance = null,
  hasKey = () => Boolean(config.naiKey),
  onKeySaved = null,
}) {
  const watchers = new Map();

  const finishedImages = new Map();
  const IMAGE_TTL_MS = 10 * 60 * 1000;

  const rememberImage = (jobId, dataUri, images) => {
    finishedImages.set(jobId, { dataUri, images, at: Date.now() });
    for (const [id, entry] of finishedImages) {
      if (Date.now() - entry.at > IMAGE_TTL_MS) finishedImages.delete(id);
    }
  };


  const resultImages = (result) => {
    if (!result) return [];
    if (Array.isArray(result.images) && result.images.length > 0) return result.images;
    return result.bytes ? [{ bytes: result.bytes, seed: result.seed }] : [];
  };

  runner.subscribe((job) => {
    const done = isTerminal(job.state);
    const images = done && job.state === 'done' ? resultImages(job.result) : [];


    const persist = images.length > 0 && store
      ? (async () => {
          const saved = [];
          for (const image of images) {
            try {
              saved.push(await store.save({ bytes: image.bytes, job, seed: image.seed }));
            } catch (err) {
              console.error(`  failed to archive job ${job.id}: ${err.message}`);
              saved.push(null);
            }
          }
          return saved;
        })()
      : Promise.resolve([]);

    persist.then((saved) => {
      const listeners = watchers.get(job.id);

      const dataUris = images.map(
        (image) => `data:image/png;base64,${image.bytes.toString('base64')}`,
      );
      const dataUri = dataUris[0] ?? null;

      if (dataUri) rememberImage(job.id, dataUri, dataUris);

      if (!listeners) return;

      const event = {
        id: job.id,
        state: job.state,
        error: job.error ? { code: job.error.code, message: job.error.message } : null,
        seed: images[0]?.seed ?? null,

        image: dataUri,
        archivedId: saved[0]?.id ?? null,
        images: dataUris,
        seeds: images.map((image) => image.seed ?? null),
        archivedIds: saved.map((entry) => entry?.id ?? null),
      };
      const frame = `data: ${JSON.stringify(event)}\n\n`;
      for (const res of listeners) res.write(frame);

      if (done) {
        for (const res of listeners) {
          res.write(`event: ${SSE_END}\ndata: {}\n\n`);
          res.end();
        }
        watchers.delete(job.id);
      }
    });
  });

  const currentUser = (req) => {
    if (auth.isOpen) return auth.sessionUser(null);

    const { sid } = parseCookies(req.headers.cookie);
    if (!sid) return null;
    return auth.sessionUser(sid);
  };

  const requireUser = (req, res) => {
    const user = currentUser(req);
    if (!user) {
      json(res, 401, { error: 'not_authenticated', message: 'Sign in first.' });
      return null;
    }
    return user;
  };


  // Accepting a key over HTTP is only safe when the person posting it had to
  // prove they are the owner. With no sign-in that proof is "can reach the
  // port", which is fine on loopback and not fine on a LAN, so the setup gate
  // closes there and .env stays the only way in.
  const loopback = config.host === '127.0.0.1' || config.host === 'localhost' || config.host === '::1';
  const keySavingAllowed = () => Boolean(onKeySaved) && (auth.mode !== 'open' || loopback);

  const accountBalance = async ({ force = false } = {}) => {
    if (!hasKey()) return null;
    try {
      const { anlas, subscriptionAnlas, tier, opus } = await readBalance({ force });
      return { anlas, subscriptionAnlas, tier, opus: opus ?? null };
    } catch {
      return null;
    }
  };

  const serveStatic = async (req, res, pathname) => {
    const rel = pathname === '/' ? '/index.html' : pathname;
    const target = path.resolve(PUBLIC, '.' + rel);
    if (!target.startsWith(PUBLIC)) {
      res.writeHead(403).end('forbidden');
      return;
    }

    if (!currentUser(req)) {
      if (rel === '/index.html') {
        const page = loginPage({ mode: auth.mode });
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': Buffer.byteLength(page),
          'Cache-Control': 'no-store',
        });
        res.end(page);
        return;
      }
      res.writeHead(404).end('not found');
      return;
    }

    try {
      const body = await fs.readFile(target);
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(target)] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    const { pathname } = url;

    try {
      if (pathname === '/auth/login') {
        if (auth.mode !== 'oauth') {
          res.writeHead(302, { Location: '/' }).end();
          return;
        }
        if (!auth.configured) {
          json(res, 503, {
            error: 'auth_unconfigured',
            message: 'Discord OAuth is not configured. See .env.example.',
          });
          return;
        }
        res.writeHead(302, { Location: auth.authorizeUrl() }).end();
        return;
      }

      if (pathname === '/auth/password' && req.method === 'POST') {
        if (auth.mode !== 'password') {
          res.writeHead(302, { Location: '/' }).end();
          return;
        }

        let attempt = '';
        try {
          const body = await readBody(req, 4 * 1024);
          attempt = new URLSearchParams(body).get('password') ?? '';
        } catch {
          attempt = '';
        }

        const sessionId = auth.logInWithPassword(attempt);
        if (!sessionId) {
          const page = loginPage({ mode: 'password', note: 'That password is not right.' });
          res.writeHead(401, {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Length': Buffer.byteLength(page),
            'Cache-Control': 'no-store',
          });
          res.end(page);
          return;
        }

        res.writeHead(302, { 'Set-Cookie': sessionCookie(req, sessionId), Location: '/' }).end();
        return;
      }

      if (pathname === '/auth/callback') {
        if (auth.mode !== 'oauth') {
          res.writeHead(302, { Location: '/' }).end();
          return;
        }
        try {
          const { sessionId } = await auth.handleCallback({
            code: url.searchParams.get('code'),
            state: url.searchParams.get('state'),
          });
          res.writeHead(302, { 'Set-Cookie': sessionCookie(req, sessionId), Location: '/' }).end();
        } catch (err) {
          const page = deniedPage({
            username: err.user?.username,
            message: err.code === 'not_allowed' ? null : err.message,
          });
          res.writeHead(err.code === 'not_allowed' ? 403 : 400, {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Length': Buffer.byteLength(page),
          });
          res.end(page);
        }
        return;
      }

      
      if (pathname.startsWith('/i/')) {
        const match = /^\/i\/([a-f0-9]{32})\.webp$/.exec(pathname);
        if (!match || !store) {
          res.writeHead(404).end('not found');
          return;
        }

        if (!currentUser(req)) {
          res.writeHead(404).end('not found');
          return;
        }

        const encoded = await store.webpFor(match[1], toWebp);
        if (!encoded) {
          res.writeHead(404).end('not found');
          return;
        }
        const { bytes, ext } = encoded;

        res.writeHead(200, {
          'Content-Type': ext === 'webp' ? 'image/webp' : 'image/png',
          'Content-Length': bytes.length,
          'Cache-Control': 'private, max-age=31536000, immutable',
        });
        res.end(bytes);
        return;
      }

      if (pathname === '/auth/logout') {
        const { sid } = parseCookies(req.headers.cookie);
        if (!auth.isOpen) auth.destroySession(sid);
        res
          .writeHead(302, { 'Set-Cookie': 'sid=; Max-Age=0; Path=/', Location: '/' })
          .end();
        return;
      }

      if (pathname === '/api/me') {
        const me = currentUser(req);

        const fresh = url.searchParams.get('fresh') === '1';
        json(res, 200, {
          user: me,
          balance: me ? await accountBalance({ force: fresh }) : null,
          authMode: auth.mode,
          authConfigured: auth.configured,
          hasKey: hasKey(),
          canSaveKey: keySavingAllowed(),
        });
        return;
      }

      if (pathname === '/api/key' && req.method === 'POST') {
        const user = requireUser(req, res);
        if (!user) return;

        if (!keySavingAllowed()) {
          json(res, 403, {
            error: 'key_setup_closed',
            message:
              'This server is reachable from the network with no sign-in, so it will not ' +
              'accept a key over HTTP. Set NAI_KEY in .env instead.',
          });
          return;
        }

        let key = '';
        try {
          key = String(JSON.parse(await readBody(req, 8 * 1024)).key ?? '').trim();
        } catch {
          json(res, 400, { error: 'bad_json', message: 'Body must be JSON.' });
          return;
        }

        if (!key) {
          json(res, 400, { error: 'empty_key', message: 'Paste your key first.' });
          return;
        }

        // Check the key against NovelAI before it touches disk, so a typo is
        // caught here rather than on the first generate.
        //
        // The default 120s timeout is sized for generation. This call is a
        // person waiting on a form, and /user/subscription can take ~10s when
        // it is cold, so allow for that and give up well short of two minutes.
        let balance;
        try {
          balance = await createBalanceReader(key, { log: false, timeoutMs: 30_000 })({
            force: true,
          });
        } catch (err) {
          const bad = err?.code === 'unauthorized';
          const slow = err?.code === 'timeout';
          json(res, bad ? 400 : 502, {
            error: bad ? 'invalid_key' : slow ? 'nai_timeout' : 'nai_unreachable',
            message: bad
              ? 'NovelAI did not accept that key. Check you copied the whole token.'
              : slow
                ? 'NovelAI did not answer in time. Your key may be fine, so try again.'
                : 'Could not reach NovelAI to check that key. Try again in a moment.',
          });
          return;
        }

        try {
          await onKeySaved?.(key);
        } catch (err) {
          json(res, 500, {
            error: 'save_failed',
            message: `Key works, but saving it failed: ${err.message}`,
          });
          return;
        }

        json(res, 200, {
          ok: true,
          balance: { ...balance, opus: balance.opus ?? null },
        });
        return;
      }

      if (pathname === '/api/generate' && req.method === 'POST') {
        const user = requireUser(req, res);
        if (!user) return;

        let input;
        try {
          input = JSON.parse(await readBody(req, GENERATE_BODY_LIMIT));
        } catch (err) {
          const tooLarge = err?.code === 'too_large';
          json(res, tooLarge ? 413 : 400, {
            error: tooLarge ? 'too_large' : 'bad_json',
            message: tooLarge
              ? 'That request is too large. Try fewer vibe references.'
              : 'Body must be JSON.',
          });
          return;
        }

        let params;
        try {
          params = parseGenerationParams(input);
        } catch (err) {
          json(res, 400, {
            error: err.code ?? 'invalid_params',
            message: describeParamsError(err),
            issues: err.issues ?? undefined,
          });
          return;
        }

        try {
          const job = runner.start({ params });
          json(res, 202, {
            jobId: job.id,
            state: job.state,
          });
        } catch (err) {
          json(res, err.code === 'busy' ? 429 : 500, {
            error: err.code ?? 'generate_failed',
            message: err.message,
          });
        }
        return;
      }


      if (pathname === '/api/suggest-tags') {
        const user = requireUser(req, res);
        if (!user) return;

        if (!hasKey()) {
          json(res, 503, {
            error: 'no_keys',
            message: 'Tag suggestions need a NovelAI key. See .env.example.',
          });
          return;
        }

        const prompt = (url.searchParams.get('prompt') ?? '').trim();
        const model = url.searchParams.get('model') ?? '';

        if (!prompt) {
          json(res, 200, { tags: [] });
          return;
        }
        if (prompt.length > SUGGEST_PROMPT_MAX) {
          json(res, 200, { tags: [] });
          return;
        }
        if (!Object.hasOwn(MODELS, model)) {
          json(res, 400, {
            error: 'invalid_model',
            message: 'Unknown model.',
          });
          return;
        }

        try {
          const tags = await suggestTags({ model, prompt });
          json(res, 200, { tags });
        } catch (err) {

          json(res, 502, {
            error: err.code ?? 'suggest_failed',
            message: 'Could not fetch tag suggestions.',
          });
        }
        return;
      }

      if (pathname === '/api/encode-vibe' && req.method === 'POST') {
        const user = requireUser(req, res);
        if (!user) return;

        if (!hasKey()) {
          json(res, 503, {
            error: 'no_keys',
            message: 'Vibe encoding needs a NovelAI key. See .env.example.',
          });
          return;
        }

        let input;
        try {
          input = JSON.parse(await readBody(req, VIBE_UPLOAD_LIMIT));
        } catch (err) {
          const tooLarge = err?.code === 'too_large';
          json(res, tooLarge ? 413 : 400, {
            error: tooLarge ? 'too_large' : 'bad_json',
            message: tooLarge ? 'That image is too large to encode.' : 'Body must be JSON.',
          });
          return;
        }

        let request;
        try {
          request = VibeEncodeRequestSchema.parse(input);
        } catch (err) {
          json(res, 400, {
            error: 'invalid_params',
            message: 'That is not a valid vibe encode request.',
            issues: err.issues ?? undefined,
          });
          return;
        }

        try {
          const encoding = await encodeVibe(request);
          json(res, 200, { encoding, balance: await accountBalance() });
        } catch (err) {
          const status = { encode_rejected: 400, unauthorized: 502 }[err.code] ?? 500;
          json(res, status, {
            error: err.code ?? 'encode_failed',
            message: err.message,
          });
        }
        return;
      }

      if (pathname === '/api/vibe-bundle' && req.method === 'POST') {
        const user = requireUser(req, res);
        if (!user) return;

        let body;
        try {
          body = await readBody(req, VIBE_UPLOAD_LIMIT);
        } catch (err) {
          const tooLarge = err?.code === 'too_large';
          json(res, tooLarge ? 413 : 400, {
            error: tooLarge ? 'too_large' : 'bad_request',
            message: tooLarge ? 'That bundle is too large.' : 'Could not read that file.',
          });
          return;
        }

        const parsed = parseVibeBundle(body);
        if (parsed.error) {
          json(res, 400, { error: 'invalid_bundle', message: parsed.error });
          return;
        }
        json(res, 200, { vibes: parsed.vibes, truncated: parsed.truncated });
        return;
      }

      if (pathname.startsWith('/api/jobs/') && pathname.endsWith('/events')) {
        const user = requireUser(req, res);
        if (!user) return;

        const jobId = pathname.slice('/api/jobs/'.length, -'/events'.length);
        const job = runner.getJob(jobId);
        if (!job) {
          json(res, 404, { error: 'no_such_job' });
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        const finished = finishedImages.get(jobId);
        res.write(
          `data: ${JSON.stringify({
            id: job.id,
            state: job.state,
            error: job.error ? { code: job.error.code, message: job.error.message } : null,
            seed: job.result?.seed ?? null,
            image: finished?.dataUri ?? null,

            images: finished?.images ?? [],
            seeds: resultImages(job.result).map((image) => image.seed ?? null),
          })}\n\n`,
        );

        if (isTerminal(job.state)) {
          res.write(`event: ${SSE_END}\ndata: {}\n\n`);
          res.end();
          return;
        }

        if (!watchers.has(jobId)) watchers.set(jobId, new Set());
        watchers.get(jobId).add(res);
        req.on('close', () => {
          watchers.get(jobId)?.delete(res);
        });
        return;
      }


      if (pathname === '/api/stats') {
        json(res, 200, runner.stats());
        return;
      }

      await serveStatic(req, res, pathname);
    } catch (err) {
      json(res, 500, { error: 'internal', message: err.message });
    }
  });

  return server;
}
