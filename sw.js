const CACHE_NAME = 'football-manager-v3';
const OFFLINE_PAGE = '/offline.html';
const ASSETS = [
    '/',
    '/index.html',
    '/player.html',
    '/styles.css',
    '/script.js',
    '/player.js',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
    '/images/logo.png',
];

// Установка и кеширование
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => {
                console.log('Кеширование ресурсов');
                return cache.addAll(ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Активация и очистка старых кешей
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cache) => {
                        if (cache !== CACHE_NAME) {
                            console.log('Удаление старого кеша:', cache);
                            return caches.delete(cache);
                        }
                    })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Стратегия: Сначала сеть, потом кеш
self.addEventListener('fetch', (event) => {
    // Для навигационных запросов - особая обработка
    if (event.request.mode === 'navigate') {
        event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_PAGE)));
    } else {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Клонируем для кеша
                    const responseToCache = response.clone();
                    caches
                        .open(CACHE_NAME)
                        .then((cache) => cache.put(event.request, responseToCache));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
    }
});

// Фоновая синхронизация
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-data') {
        event.waitUntil(
            syncData()
                .then(() => console.log('Данные синхронизированы'))
                .catch((err) => console.error('Ошибка синхронизации:', err))
        );
    }
});

async function syncData() {
    // Здесь может быть логика синхронизации с сервером
    const cache = await caches.open(CACHE_NAME);
    return Promise.resolve();
}
