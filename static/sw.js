const CACHE_NAME = 'mycampus-store-v12';

const ASSETS_TO_CACHE = [
  '/',
  '/login',
  '/static/style.css',
  '/static/dashboard.js',
  '/static/login.js',
  '/static/manifest.json',
  '/static/icon-192.png',
  '/static/icon-512.png',
  '/static/favicon.ico',
  // Modules
  '/static/modules/constants.js',
  '/static/modules/data_service.js', // FIXED
  '/static/modules/state.js',
  '/static/modules/ui.js',
  // Helpers
  '/static/calculator.js',
  '/static/solver.js',
  '/static/bitmaps.js',
  // CRITICAL: Offline Libraries
  '/static/tailwind.js',
  '/static/lucide.js',
  '/static/alpine.js'
];

// 1. Install Event: Cache the "App Shell" immediately
self.addEventListener('install', (e) => {
  self.skipWaiting(); // Force this SW to become active immediately
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching App Shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. Activate Event: Clean up old caches to prevent conflicts
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[SW] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim(); // Take control of all clients immediately
});

// 3. Fetch Event: The Offline Guard
self.addEventListener('fetch', (e) => {

  // A. Handle Navigation Requests (HTML Pages)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .catch(() => {
          // If network fails (offline), return the cached Dashboard HTML
          return caches.match('/');
        })
    );
    return;
  }

  // B. Handle Static Assets (JS, CSS, Images) -> Cache First, Fallback to Network
  // We only cache GET requests. API calls (POST) pass through to be handled by data.js
  if (e.request.method === 'GET') {
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        // Return cached file if found, otherwise try network
        return cachedResponse || fetch(e.request);
      })
    );
  }
});
