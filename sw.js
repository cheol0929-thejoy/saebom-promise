// 새봄약속 서비스 워커 — 예배당 와이파이가 끊겨도 화면이 열리도록 앱 파일을 저장해 둡니다.
const VERSION = 'saebom-promise-v1';
const SHELL = [
  './',
  'index.html',
  'css/style.css',
  'js/config.js',
  'js/card.js',
  'js/app.js',
  'data/sample.csv',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 말씀 시트: 항상 새로 받고, 실패하면 앱이 저장해 둔 사본을 씁니다.
  if (url.hostname === 'docs.google.com') return;

  // 구글 글꼴: 한 번 받으면 저장해 두고 씁니다.
  if (url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com')) {
    e.respondWith(
      caches.open(VERSION).then(async (c) => {
        const hit = await c.match(req);
        const net = fetch(req).then((res) => { c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  // 앱 파일: 네트워크 우선(새 버전 반영), 실패하면 저장본
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('index.html')))
    );
  }
});
