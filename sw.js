const CACHE_NAME = "sime-monitor-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./sensor.html",
  "./style.css",
  "./style-fab.css",
  "./dtcea_sj_logo.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // Skip external connections like Supabase and the PHP api endpoint to keep realtime updates clean
  if (event.request.url.includes("supabase") || event.request.url.includes("api.php")) {
    return;
  }
  
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
