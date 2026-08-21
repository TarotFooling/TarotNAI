
const CONTAINER_ID = 'toast-root';

export const DEFAULT_AUTO_CLOSE = 5000;

const EXIT_MS = 300;

const ICONS = {
  info: '<path d="M12 0a12 12 0 1012 12A12.013 12.013 0 0012 0zm.25 5a1.5 1.5 0 11-1.5 1.5 1.5 1.5 0 011.5-1.5zm2.25 13.5h-4a1 1 0 010-2h.75a.25.25 0 00.25-.25v-4.5a.25.25 0 00-.25-.25h-.75a1 1 0 010-2h1a2 2 0 012 2v4.75a.25.25 0 00.25.25h.75a1 1 0 110 2z"></path>',
  success:
    '<path d="M12 0a12 12 0 1012 12A12.014 12.014 0 0012 0zm6.927 8.2l-6.845 9.289a1.011 1.011 0 01-1.43.188l-4.888-3.908a1 1 0 111.25-1.562l4.076 3.261 6.227-8.451a1 1 0 111.61 1.183z"></path>',
  warning:
    '<path d="M23.32 17.191L15.438 2.184C14.728.833 13.416 0 11.996 0c-1.42 0-2.733.833-3.443 2.184L.533 17.448a4.744 4.744 0 000 4.368C1.243 23.167 2.555 24 3.975 24h16.05C22.22 24 24 22.044 24 19.632c0-.904-.25-1.746-.68-2.44zm-9.622 1.46c0 1.033-.724 1.823-1.698 1.823s-1.698-.79-1.698-1.822v-.043c0-1.028.724-1.822 1.698-1.822s1.698.79 1.698 1.822v.043zm.039-12.285l-.849 8.037c-.078.66-.415 1.037-.888 1.037-.472 0-.809-.376-.887-1.037l-.849-8.037c-.078-.71.315-1.215.926-1.215.607 0 1.002.507.924 1.215z"></path>',
  error:
    '<path d="M11.983 0a12.206 12.206 0 00-8.51 3.653A11.8 11.8 0 000 12.207 11.779 11.779 0 0011.8 24h.214A12.111 12.111 0 0024 11.791 11.766 11.766 0 0011.983 0zM10.5 16.542a1.476 1.476 0 011.449-1.53h.027a1.527 1.527 0 011.523 1.47 1.475 1.475 0 01-1.449 1.53h-.027a1.529 1.529 0 01-1.523-1.47zM11 12.5v-6a1 1 0 012 0v6a1 1 0 11-2 0z"></path>',
};

const CLOSE_ICON =
  '<path d="M6 6l12 12"></path><path d="M18 6l-12 12"></path>';

let nextId = 1;
const active = new Map();

function container() {
  let root = document.getElementById(CONTAINER_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = CONTAINER_ID;
    root.className = 'Toastify__toast-container';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Notifications');
    document.body.append(root);
  }
  return root;
}

export function toast(message, options = {}) {
  const { type = 'info', autoClose = DEFAULT_AUTO_CLOSE, key } = options;

  if (key) {
    const existing = active.get(key);
    if (existing) {
      existing.restart();
      return { id: existing.id, dismiss: existing.dismiss };
    }
  }

  const id = String(nextId++);
  const registryKey = key ?? id;
  const el = document.createElement('div');
  el.id = id;
  el.tabIndex = 0;
  el.dataset.in = 'true';
  el.className = [
    'Toastify__toast',
    'Toastify__toast-theme--dark',
    `Toastify__toast--${type}`,
    'Toastify__toast--close-on-click',
    'Toastify--animate',
    'Toastify__slide-enter',
  ].join(' ');
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

  const icon = document.createElement('div');
  icon.className = 'Toastify__toast-icon Toastify--animate-icon Toastify__zoom-enter';
  icon.innerHTML = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="var(--toast-icon-${type})">${ICONS[type] ?? ICONS.info}</svg>`;

  const body = document.createElement('div');
  body.className = 'Toastify__toast-body';
  body.textContent = message;

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'Toastify__close-button Toastify__close-button--dark';
  closeButton.setAttribute('aria-label', 'close');
  closeButton.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${CLOSE_ICON}</svg>`;

  el.append(icon, body, closeButton);

  const wrap = document.createElement('div');
  wrap.className = 'Toastify__progress-bar--wrp';
  wrap.dataset.hidden = String(autoClose === false);

  const track = document.createElement('div');
  track.className = `Toastify__progress-bar--bg Toastify__progress-bar-theme--dark Toastify__progress-bar--${type}`;

  const bar = document.createElement('div');
  bar.className = `Toastify__progress-bar Toastify__progress-bar--animated Toastify__progress-bar-theme--dark Toastify__progress-bar--${type}`;
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-hidden', String(autoClose === false));
  bar.setAttribute('aria-label', 'notification timer');
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');
  if (autoClose !== false) {
    bar.style.animationDuration = `${autoClose}ms`;
    bar.style.animationPlayState = 'running';
  }

  wrap.append(track, bar);
  el.append(wrap);

  let closed = false;

  const dismiss = () => {
    if (closed) return;
    closed = true;
    active.delete(registryKey);

    el.classList.remove('Toastify__slide-enter');
    el.classList.add('Toastify__slide-exit');

    let removed = false;
    const remove = () => {
      if (removed) return;
      removed = true;
      clearTimeout(fallback);
      el.remove();
    };
    el.addEventListener('animationend', remove, { once: true });
    const fallback = setTimeout(remove, EXIT_MS + 50);
  };

  let timer = null;
  let startedAt = 0;
  let remaining = autoClose === false ? Infinity : autoClose;

  const startTimer = () => {
    if (autoClose === false || closed) return;
    startedAt = Date.now();
    timer = setTimeout(dismiss, remaining);
  };

  const pauseTimer = () => {
    if (autoClose === false || closed || timer === null) return;
    clearTimeout(timer);
    timer = null;
    remaining = Math.max(0, remaining - (Date.now() - startedAt));
    bar.style.animationPlayState = 'paused';
  };

  const resumeTimer = () => {
    if (autoClose === false || closed || timer !== null) return;
    bar.style.animationPlayState = 'running';
    startTimer();
  };

  const restart = () => {
    if (closed) return;
    clearTimeout(timer);
    timer = null;
    remaining = autoClose === false ? Infinity : autoClose;
    bar.classList.remove('Toastify__progress-bar--animated');
    void bar.offsetWidth;
    bar.classList.add('Toastify__progress-bar--animated');
    bar.style.animationPlayState = 'running';
    startTimer();
  };

  el.addEventListener('mouseenter', pauseTimer);
  el.addEventListener('mouseleave', resumeTimer);
  el.addEventListener('focusin', pauseTimer);
  el.addEventListener('focusout', resumeTimer);

  el.addEventListener('click', dismiss);
  closeButton.addEventListener('click', (event) => {
    event.stopPropagation();
    dismiss();
  });

  el.addEventListener(
    'animationend',
    () => {
      if (!closed) el.classList.remove('Toastify--animate', 'Toastify__slide-enter');
    },
    { once: true },
  );

  container().append(el);
  startTimer();

  const handle = { id, dismiss, restart };
  active.set(registryKey, handle);
  return { id, dismiss };
}

export const toastInfo = (message, options) => toast(message, { ...options, type: 'info' });
export const toastSuccess = (message, options) => toast(message, { ...options, type: 'success' });
export const toastWarning = (message, options) => toast(message, { ...options, type: 'warning' });
export const toastError = (message, options) => toast(message, { ...options, type: 'error' });

export function dismissAll() {
  for (const handle of [...active.values()]) handle.dismiss();
}
