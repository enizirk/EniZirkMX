const CACHE = 'enizirk-v66';
const ASSETS = ['./', './index.html', './manifest.json', './icon.svg', './xlsx.full.min.js', './pdf.min.js', './pdf.worker.min.js', './grundwortschatz.csv'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Nur einwandfreie Antworten der eigenen Seite zwischenspeichern — eine Fehlerseite (404/500)
// darf nie die gute Offline-Kopie überschreiben.
function cacheable(res) { return res && res.ok && res.type === 'basic'; }

// Die App selbst (index.html) wird "Netz zuerst" geladen, damit eine hochgeladene neue Version
// sofort erscheint — aber mit Zeitlimit: bei schwachem Netz nach 3 Sekunden die gespeicherte
// Kopie, statt beim Start zu hängen. Bibliotheken (xlsx/pdf.js) ändern sich selten: Cache zuerst.
function isAppShell(url) {
  return url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // fremde Adressen (z.B. KI-Schnittstelle) nie anfassen

  if (isAppShell(url)) {
    const network = fetch(e.request, { cache: 'no-cache' }).then(res => {
      if (cacheable(res)) { const clone = res.clone(); e.waitUntil(caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {})); }
      return res;
    });
    network.catch(() => {});
    const timeout = new Promise(resolve => setTimeout(resolve, 3000)).then(() => caches.match(e.request));
    e.respondWith(
      Promise.race([network.then(res => (res.ok ? res : caches.match(e.request).then(c => c || res))), timeout.then(c => c || network)])
        .catch(() => caches.match(e.request))
        .then(res => res || caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(res => {
        if (cacheable(res)) { const clone = res.clone(); e.waitUntil(caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {})); }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
