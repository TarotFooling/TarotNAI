const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

export function loginPage({ mode = 'password', note = null } = {}) {
  const detail = note ? `<p class="note">${escapeHtml(note)}</p>` : '';

  const body =
    mode === 'oauth'
      ? `<p>This server is set up to sign in with Discord.</p>
    ${detail}
    <div class="actions">
      <a class="button" href="/auth/login">Sign in with Discord</a>
    </div>`
      : `<p>This server is password protected.</p>
    ${detail}
    <form class="actions" method="POST" action="/auth/password">
      <input class="field" type="password" name="password" placeholder="Password"
             autocomplete="current-password" autofocus required>
      <button class="button" type="submit">Sign in</button>
    </form>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Sign in</title>
<style>
  :root {
    --bg: rgb(19, 21, 44);
    --panel: rgb(25, 27, 49);
    --border: rgb(34, 37, 63);
    --text: rgb(255, 255, 255);
    --muted: rgba(255, 255, 255, 0.7);
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    line-height: 24px;
  }
  .card {
    width: 100%;
    max-width: 420px;
    padding: 30px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 5px;
    text-align: center;
  }
  h1 { margin: 0 0 15px; font-size: 22px; font-weight: 600; }
  p { margin: 0 0 10px; font-size: 14px; color: var(--muted); }
  .note { font-size: 12.8px; color: rgb(255, 140, 140); }
  .actions {
    margin-top: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
  }
  .field {
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 3px;
    background: rgb(19, 21, 44);
    color: var(--text);
    font-size: 14px;
    font-family: inherit;
  }
  .field:focus { outline: 2px solid rgb(80, 86, 140); outline-offset: -1px; }
  .button {
    display: inline-block;
    padding: 8px 20px;
    border: 1px solid var(--border);
    border-radius: 3px;
    background: rgb(34, 37, 63);
    color: var(--text);
    font-size: 14px;
    font-family: inherit;
    text-decoration: none;
    cursor: pointer;
  }
  .button:hover { background: rgb(44, 48, 78); }
</style>
</head>
<body>
  <main class="card">
    <h1>Sign in to continue</h1>
    ${body}
  </main>
</body>
</html>`;
}
