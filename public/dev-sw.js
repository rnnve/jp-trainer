// Replace any production worker left on a development origin. With no fetch
// handler, dev assets and HMR always go straight to the development server.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
 event.waitUntil(
  caches.keys()
   .then(keys => Promise.all(keys.filter(key => key.startsWith('kotoba-')).map(key => caches.delete(key))))
   .then(() => self.clients.claim())
   .then(() => self.registration.unregister())
 );
});
