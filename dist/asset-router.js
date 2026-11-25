/* Shared Viewer routes resolve through pinned, explicitly declared data hosts. */
const base = new URL('./', self.location.href);
const CONTROL = 'canopy-cache-control';
const activeKey = new URL('__active', base).href;
let sources;

async function fetchResource(request, options = {}) {
  const signal = options.signal || request.signal;
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    try {
      const response = await fetch(request, options);
      if (![502, 503, 504].includes(response.status) || attempt === 3) return response;
      response.body?.cancel().catch(() => {});
    } catch (error) {
      if (signal?.aborted || attempt === 3) throw error;
    }
    // Bounded retries for transient transport failures; cancellation still wins.
    await new Promise((resolve, reject) => {
      const cancel = () => { clearTimeout(timer); reject(signal.reason); };
      const timer = setTimeout(() => { signal?.removeEventListener('abort', cancel); resolve(); }, 200 * 2 ** attempt);
      signal?.addEventListener('abort', cancel, { once: true });
      if (signal?.aborted) cancel();
    });
  }
}

function resourceURL(path) {
  if (typeof path !== 'string' || !path || path.startsWith('/') || /[\\%?#:]/.test(path) ||
      path.split('/').some(part => !part || part === '.' || part === '..')) {
    throw Error('Invalid public resource path');
  }
  const url = new URL(path, base);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) throw Error('Public resource escapes Canopy');
  return url;
}

function remoteURL(value) {
  if (typeof value !== 'string' || /[\\%?#\s]/.test(value) ||
      value.replace(/^https:\/\//, '').split('/').some(part => part === '.' || part === '..')) {
    throw Error('Invalid remote data URL');
  }
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      url.href !== value || url.pathname.includes('//')) throw Error('Invalid remote data URL');
  return url;
}

async function activeCache() {
  const selected = await (await caches.open(CONTROL)).match(activeKey);
  return selected ? caches.open(await selected.text()) : null;
}

async function readSources() {
  const url = new URL('asset-sources.json', base);
  let response;
  try {
    response = await fetchResource(url, { cache: 'no-cache' });
    if (!response.ok) throw Error('Public resource index unavailable');
  } catch (error) {
    response = await (await activeCache())?.match(url);
    if (!response) throw error;
  }
  const data = await response.json();
  if (!['1.0.0', '2.0.0'].includes(data.schema_version) || !data.resources || typeof data.resources !== 'object')
    throw Error('Unsupported public resource index');
  const roots = data.schema_version === '2.0.0' ? data.remote_bases : [];
  if (!Array.isArray(roots)) throw Error('Missing remote data roots');
  for (const root of roots) {
    remoteURL(root);
    if (!root.endsWith('/')) throw Error('Remote data root must end with a slash');
  }
  const map = new Map();
  for (const [path, target] of Object.entries(data.resources)) {
    resourceURL(path);
    if (typeof target === 'string' && target.startsWith('https://')) {
      const remote = remoteURL(target);
      if (!roots.some(root => remote.href.startsWith(root))) throw Error('Undeclared remote data target');
      map.set(path, remote);
    } else map.set(path, resourceURL(target));
  }
  return map;
}

function getSources() {
  return sources ||= readSources().catch(error => { sources = undefined; throw error; });
}

self.addEventListener('install', event => event.waitUntil(getSources().then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  if (event.data?.type !== 'activate-cache' || !event.data.name?.startsWith('canopy-complete-')) return;
  event.waitUntil((async () => {
    await (await caches.open(CONTROL)).put(activeKey, new Response(event.data.name));
    event.ports[0]?.postMessage({ ok: true });
  })());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname) || event.request.method !== 'GET') return;
  event.respondWith((async () => {
    const requestedPath = url.pathname.slice(base.pathname.length);
    const path = !requestedPath || requestedPath.endsWith('/') ? requestedPath + 'index.html' : requestedPath;
    const map = await getSources();
    const geometry = path.endsWith('.glb') && !map.has(path) && map.has(path + '.gz');
    const resourcePath = geometry ? path + '.gz' : path;
    const logicalURL = new URL(resourcePath, base);
    const network = async () => {
      const target = map.get(resourcePath);
      if (!target) return fetchResource(event.request);
      // Data hosts receive no application credentials or arbitrary request headers.
      const headers = new Headers();
      if (!geometry) for (const name of ['Accept', 'Range']) {
        if (event.request.headers.has(name)) headers.set(name, event.request.headers.get(name));
      }
      return fetchResource(target, { headers, mode: 'cors', redirect: 'error',
        cache: event.request.cache, credentials: 'omit', signal: event.request.signal });
    };
    if (event.request.cache === 'no-store' && !geometry) return network();
    const cache = await activeCache();
    const cached = () => cache?.match(logicalURL, { ignoreSearch: true });
    if (geometry) {
      const response = await cached() || await network();
      if (!response.ok) return response;
      return new Response(response.body.pipeThrough(new DecompressionStream('gzip')),
        { headers: { 'Content-Type': 'model/gltf-binary' } });
    }
    if (['', 'index.html', 'download-manifest.json', 'preload.js', 'asset-sources.json'].includes(path)) {
      try { const response = await network(); return response.ok ? response : await cached() || response; }
      catch (error) { const response = await cached(); if (response) return response; throw error; }
    }
    return await cached() || network();
  })());
});

// Publication routing: 168f7d0f642dfbd62ef8afa63e18cad42a028a5843e9d7682368a47a8e110d37
