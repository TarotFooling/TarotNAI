const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

export function deniedPage({ username, message } = {}) {
  const who = username
    ? `<p class="who">Signed in as <strong>${escapeHtml(username)}</strong></p>`
    : '';

  const ask =
    '<p class="ask">This account is not on the allow list for this server. ' +
    'Ask whoever runs it to add you.</p>';

  const detail = message ? `<p class="detail">${escapeHtml(message)}</p>` : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Access not granted</title>
<style>
  :root {
    --bg: rgb(19, 21, 44);
    --panel: rgb(25, 27, 49);
    --border: rgb(34, 37, 63);
    --text: rgb(255, 255, 255);
    --muted: rgba(255, 255, 255, 0.7);
    --accent: rgb(245, 243, 194);
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
    font-family: "Source Sans Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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
  .who { color: var(--text); }
  .who strong { color: var(--accent); font-weight: 600; }
  .ask strong { color: var(--accent); font-weight: 600; }
  .detail { font-size: 12.8px; opacity: 0.6; }
  .actions { margin-top: 20px; }
  a.button {
    display: inline-block;
    padding: 8px 20px;
    border: 1px solid var(--border);
    border-radius: 3px;
    background: rgb(34, 37, 63);
    color: var(--text);
    font-size: 14px;
    text-decoration: none;
  }
  a.button:hover { background: rgb(44, 48, 78); }
</style>
</head>
<body>
  <main class="card">
    <h1>Access not granted</h1>
    ${who}
    ${ask}
    ${detail}
    <div class="actions">
      <a class="button" href="/auth/logout">Use another account</a>
    </div>
  </main>
</body>
</html>`;
}
