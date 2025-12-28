const CACHE_NAME = 'funbible-cache-v6'; // Incremented to force update
const ASSETS = [
    './',
    'index.html',
    'index.css',
    'app.js',
    'bible-manager.js',
    'search.js',
    'data/versions.json',
    'data/bg_bbd.json'
];

const EXTERNAL_ASSETS = [
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&display=swap',
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            // Cache local assets - these must succeed for the app to work offline
            try {
                await cache.addAll(ASSETS);
            } catch (e) {
                console.error('Failed to cache local assets:', e);
                throw e;
            }

            // Attempt to cache external assets gracefully
            await Promise.all(EXTERNAL_ASSETS.map(async (url) => {
                try {
                    // Use no-cors to handle opaque responses from CDNs
                    const request = new Request(url, { mode: 'no-cors' });
                    const response = await fetch(request);
                    await cache.put(request, response);
                } catch (e) {
                    console.warn('Failed to cache external asset:', url, e);
                }
            }));
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.filter((cacheName) => {
                    return cacheName !== CACHE_NAME;
                }).map((cacheName) => {
                    return caches.delete(cacheName);
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Network first for versions.json, Cache first for everything else
    if (event.request.url.includes('versions.json')) {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
    } else {
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request);
            })
        );
    }
});
