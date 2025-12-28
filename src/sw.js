const CACHE_NAME = 'funbible-cache-v5'; // Incremented to force update
const ASSETS = [
    './',
    'index.html',
    'index.css',
    'app.js',
    'bible-manager.js',
    'search.js',
    'data/versions.json',
    'data/bg_bbd.json',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&display=swap',
    'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Split into local and external assets
            const localAssets = ASSETS.filter(a => !a.startsWith('http'));
            const externalAssets = ASSETS.filter(a => a.startsWith('http'));

            // Add local assets - these must succeed
            const localPromise = cache.addAll(localAssets);

            // Add external assets individually and ignore failures
            const externalPromises = externalAssets.map(url => {
                return fetch(url, { mode: 'no-cors' })
                    .then(response => cache.put(url, response))
                    .catch(err => console.warn(`Failed to cache external asset: ${url}`, err));
            });

            return Promise.all([localPromise, ...externalPromises]);
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
