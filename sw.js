const CACHE_NAME = "us-always-v1";

const APP_FILES = [
    "./",
    "./index.html",
    "./style.css",
    "./script.js",
    "./manifest.json",
    "./icon-192.png",
    "./icon-512.png"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(APP_FILES);
        })
    );

    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                .filter((key) => key !== CACHE_NAME)
                .map((key) => caches.delete(key))
            )
        )
    );

    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Backend API requests must always go to the server.
    if (url.origin !== self.location.origin) return;

    if (request.method !== "GET") return;

    event.respondWith(
        fetch(request).catch(() => caches.match(request))
    );
});
