const TEXT_KEY = 'tarotnai.rail.v1';
const LEGACY_TEXT_KEY = 'naibot.rail.v1';
const DB_NAME = 'tarotnai';
const LEGACY_DB_NAME = 'naibot';
const DB_VERSION = 1;
const IMAGE_STORE = 'rail-images';
const IMAGE_KEY = 'current';

const SAVE_DEBOUNCE_MS = 400;

export function loadState() {
  try {
    let raw = localStorage.getItem(TEXT_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_TEXT_KEY);
      if (raw) {
        localStorage.setItem(TEXT_KEY, raw);
        localStorage.removeItem(LEGACY_TEXT_KEY);
      }
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(TEXT_KEY, JSON.stringify(state));
  } catch {
  }
}

export function clearState() {
  try {
    localStorage.removeItem(TEXT_KEY);
  } catch {
  }
}

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined' || !indexedDB) {
      resolve(null);
      return;
    }
    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE)) db.createObjectStore(IMAGE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function withStore(mode, run) {
  return openDb().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        let tx;
        try {
          tx = db.transaction(IMAGE_STORE, mode);
        } catch {
          resolve(null);
          return;
        }
        const request = run(tx.objectStore(IMAGE_STORE));
        if (mode === 'readonly') {
          request.onsuccess = () => resolve(request.result ?? null);
          request.onerror = () => resolve(null);
        } else {
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(null);
          tx.onabort = () => resolve(null);
        }
      }),
  );
}

function openLegacyDb() {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined' || !indexedDB) {
      resolve(null);
      return;
    }
    let request;
    try {
      request = indexedDB.open(LEGACY_DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function loadLegacyImages() {
  return openLegacyDb().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        let tx;
        try {
          tx = db.transaction(IMAGE_STORE, 'readonly');
        } catch {
          db.close();
          resolve(null);
          return;
        }
        const request = tx.objectStore(IMAGE_STORE).get(IMAGE_KEY);
        request.onsuccess = () => {
          db.close();
          resolve(request.result ?? null);
        };
        request.onerror = () => {
          db.close();
          resolve(null);
        };
      }),
  );
}

export async function loadImages() {
  const current = await withStore('readonly', (store) => store.get(IMAGE_KEY));
  if (current) return current;

  const legacy = await loadLegacyImages();
  if (!legacy) return null;
  await saveImages(legacy);
  try {
    indexedDB.deleteDatabase(LEGACY_DB_NAME);
  } catch {
  }
  return legacy;
}

export function saveImages(images) {
  const empty = !images || Object.keys(images).length === 0;
  return withStore('readwrite', (store) =>
    empty ? store.delete(IMAGE_KEY) : store.put(images, IMAGE_KEY),
  );
}

export function clearImages() {
  return withStore('readwrite', (store) => store.delete(IMAGE_KEY));
}

export function createSaver(collect, { delay = SAVE_DEBOUNCE_MS } = {}) {
  let timer = null;

  const write = () => {
    timer = null;
    const state = collect();
    saveState(state.text);
    if (state.images !== undefined) saveImages(state.images);
  };

  const save = () => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(write, delay);
  };

  save.flush = () => {
    if (timer !== null) clearTimeout(timer);
    write();
  };

  return save;
}
