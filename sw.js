// 홈 화면에 추가할 수 있도록 하는 최소 서비스 워커 (오프라인에서도 열리게 기본 파일만 저장)
const CACHE = 'detox-code-v12';
const FILES = ['./', './index.html', './code.js', './claim.js', './config.js', './manifest.webmanifest', './icon.svg', './terms.html', './privacy.html'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))));
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))));
self.addEventListener('fetch', (e) => {
  // Firebase 등 다른 주소와 GET 이 아닌 요청은 건드리지 않는다
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
