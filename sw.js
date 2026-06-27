/*
 * かなトク進捗管理 — Service Worker
 * オフライン動作とインストール（PWA）のためのキャッシュ層。
 * 相対パスで登録するため、本番ルート（/）と PR プレビュー（/pr-preview/pr-N/）の双方で動く。
 * 方針:
 *   - ナビゲーション要求は network-first（オンライン時は常に最新を取得、オフライン時はキャッシュへ）
 *   - 静的アセットは cache-first（裏で更新する stale-while-revalidate）
 *   - 外部オリジン（フォント等の任意要素）はブラウザ既定に委ね、ここでは扱わない
 * 内容を変えたら CACHE のバージョンを上げて古いキャッシュを破棄する。
 */
'use strict';

const CACHE = 'kanatoku-v1';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 外部リソースはブラウザ既定に任せる

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req));
  } else {
    event.respondWith(cacheFirst(req));
  }
});

// オンライン時は最新を取得しキャッシュ更新。失敗時はキャッシュ（最終的にトップ）へ。
async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    cache.put(req, res.clone());
    return res;
  } catch (e) {
    return (
      (await cache.match(req)) ||
      (await cache.match('./index.html')) ||
      (await cache.match('./')) ||
      Response.error()
    );
  }
}

// キャッシュ優先。ヒット時は裏で更新（stale-while-revalidate）。
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  if (cached) {
    fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); }).catch(() => {});
    return cached;
  }
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    return Response.error();
  }
}
