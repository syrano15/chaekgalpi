const CACHE = 'chaekgalpi-v16';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, {cache:'reload'})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.href.includes('pretendard');
  if (!sameOrigin && !isFont) return;
  // 같은 사이트 파일은 항상 서버에 새 버전이 있는지 확인 (깃허브 10분 캐시 무시)
  const req = sameOrigin ? new Request(e.request, {cache:'no-cache'}) : e.request;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, {ignoreSearch:true}).then(r => r || (sameOrigin && e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
