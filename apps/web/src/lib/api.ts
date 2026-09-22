export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(
  /\/$/,
  '',
);
let accessToken = '';
let expiresAt = 0;
let refreshing: Promise<string> | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let epoch = 0;
let channel: BroadcastChannel | null = null;
let initialized = false;
const listeners = new Set<() => void>();
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
function clearSession(broadcast: boolean) {
  accessToken = '';
  expiresAt = 0;
  epoch++;
  clearTimeout(timer);
  if (broadcast) {
    channel?.postMessage('logout');
    try {
      localStorage.setItem('bilty-logout', crypto.randomUUID());
    } catch {
      /* BroadcastChannel remains available. */
    }
  }
  listeners.forEach((listener) => listener());
}
export function onSessionEnded(listener: () => void) {
  if (!initialized && typeof window !== 'undefined') {
    initialized = true;
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel('bilty-session');
      channel.onmessage = (event) => {
        if (event.data === 'logout') clearSession(false);
      };
    }
    window.addEventListener('storage', (event) => {
      if (event.key === 'bilty-logout') clearSession(false);
    });
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
async function responseError(response: Response) {
  const body = await response.json().catch(() => ({}));
  const message = Array.isArray(body.message) ? body.message.join(' · ') : body.message;
  return new ApiError(
    response.status,
    message ||
      (response.status === 401
        ? 'Your session has ended. Please sign in again.'
        : `Request failed (${response.status}).`),
  );
}
async function fetchBounded(path: string, options: RequestInit) {
  try {
    return await fetch(API_URL + path, {
      ...options,
      cache: 'no-store',
      credentials: 'include',
      signal: options.signal || AbortSignal.timeout(15000),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError')
      throw new Error('The server took too long to respond. Please try again.');
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }
}
// Web Locks coordinate cookie rotation between tabs without persisting bearer tokens.
async function sessionLock<T>(work: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks)
    return navigator.locks.request('bilty-session-refresh', work);
  // Older browsers use an atomic IndexedDB lease. Its lifetime exceeds the bounded request.
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('bilty-session-coordination', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('locks');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          'This browser cannot coordinate a secure session. Please use an up-to-date browser.',
        ),
      );
  });
  const owner = crypto.randomUUID();
  const change = (release: boolean) =>
    new Promise<boolean>((resolve, reject) => {
      const transaction = db.transaction('locks', 'readwrite'),
        store = transaction.objectStore('locks');
      const request = store.get('refresh');
      let acquired = false;
      request.onsuccess = () => {
        const value = request.result as { owner: string; expires: number } | undefined;
        if (release) {
          if (value?.owner === owner) store.delete('refresh');
        } else if (!value || value.expires < Date.now()) {
          store.put({ owner, expires: Date.now() + 30000 }, 'refresh');
          acquired = true;
        }
      };
      transaction.oncomplete = () => resolve(acquired);
      transaction.onerror = () =>
        reject(new Error('Session coordination failed. Please try again.'));
    });
  try {
    const start = Date.now();
    while (!(await change(false))) {
      if (Date.now() - start > 35000)
        throw new Error('Another tab is updating this session. Please try again.');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    try {
      return await work();
    } finally {
      await change(true);
    }
  } finally {
    db.close();
  }
}
export async function refreshSession(force = false): Promise<string> {
  if (!force && accessToken && expiresAt > Date.now() + 30000) return accessToken;
  if (refreshing) return refreshing;
  const startedEpoch = epoch;
  refreshing = sessionLock(async () => {
    if (startedEpoch !== epoch) throw new ApiError(401, 'Your session has ended.');
    const response = await fetchBounded('/auth/refresh', { method: 'POST' });
    if (!response.ok) {
      const error = await responseError(response);
      if (response.status === 401 || response.status === 403) clearSession(true);
      throw error;
    }
    const result = (await response.json()) as { accessToken: string; expiresIn: number };
    if (startedEpoch !== epoch) throw new ApiError(401, 'Your session has ended.');
    accessToken = result.accessToken;
    expiresAt = Date.now() + result.expiresIn * 1000;
    clearTimeout(timer);
    timer = setTimeout(
      () => {
        void refreshSession(true).catch(() => {
          /* The next request reports connection errors. */
        });
      },
      Math.max(1000, result.expiresIn * 1000 - 60000),
    );
    return accessToken;
  }).finally(() => {
    refreshing = null;
  });
  return refreshing;
}
export async function apiResponse(path: string, options: RequestInit = {}): Promise<Response> {
  let token = await refreshSession();
  const send = () =>
    fetchBounded(path, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  let response = await send();
  if (response.status === 401) {
    token = await refreshSession(true);
    response = await send();
  }
  if (!response.ok) {
    if (response.status === 401) clearSession(true);
    throw await responseError(response);
  }
  return response;
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  return (await apiResponse(path, options)).json() as Promise<T>;
}
export function json(method: string, body?: unknown): RequestInit {
  return { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) };
}
export async function publicApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetchBounded(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<T>;
}
export async function signOut(all = false) {
  const token = await refreshSession();
  await sessionLock(async () => {
    const response = await fetchBounded(all ? '/auth/logout-all' : '/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok && response.status !== 401) throw await responseError(response);
    clearSession(true);
  });
}
