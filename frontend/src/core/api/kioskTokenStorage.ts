const LS_KEY = "softone.kiosk.token";
const COOKIE_KEY = "softone_kiosk_token";
const IDB_NAME = "softone-kiosk";
const IDB_STORE = "tokens";
const IDB_KEY = "device";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 10; // 10 años

function readCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_KEY}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(token: string | null) {
  if (token) {
    document.cookie = `${COOKIE_KEY}=${encodeURIComponent(token)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  } else {
    document.cookie = `${COOKIE_KEY}=; path=/; max-age=0; SameSite=Lax`;
  }
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
  });
}

async function readIdb(): Promise<string | null> {
  try {
    const db = await openIdb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_KEY);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(typeof req.result === "string" ? req.result : null);
    });
  } catch {
    return null;
  }
}

async function writeIdb(token: string | null): Promise<void> {
  try {
    const db = await openIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      if (token) store.put(token, IDB_KEY);
      else store.delete(IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* IndexedDB no disponible */
  }
}

/** Lee token del kiosco; rehidrata localStorage desde cookie o IndexedDB si hace falta. */
export function getKioskToken(): string | null {
  const fromLs = localStorage.getItem(LS_KEY);
  if (fromLs) return fromLs;

  const fromCookie = readCookie();
  if (fromCookie) {
    localStorage.setItem(LS_KEY, fromCookie);
    void writeIdb(fromCookie);
    return fromCookie;
  }

  return null;
}

/** Recuperación async desde IndexedDB (llamar al montar kiosk si getKioskToken() es null). */
export async function hydrateKioskTokenFromIdb(): Promise<string | null> {
  if (localStorage.getItem(LS_KEY)) return localStorage.getItem(LS_KEY);

  const fromIdb = await readIdb();
  if (fromIdb) {
    localStorage.setItem(LS_KEY, fromIdb);
    writeCookie(fromIdb);
    return fromIdb;
  }
  return null;
}

export function setKioskToken(token: string | null) {
  if (token) {
    localStorage.setItem(LS_KEY, token);
    writeCookie(token);
    void writeIdb(token);
  } else {
    localStorage.removeItem(LS_KEY);
    writeCookie(null);
    void writeIdb(null);
  }
}

export function isKioskAuthError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 401 || status === 403;
}
