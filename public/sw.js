const CACHE='kotoba-v4';
// Authenticated pages, RSC payloads, and API responses are always network-only.
const SHELL=['/offline.html','/icon.svg','/icons/icon-192.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('kotoba-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(url.pathname==='/hn'||url.pathname.startsWith('/hn/')||url.pathname.startsWith('/api/')||request.headers.get('RSC')==='1')return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).catch(()=>caches.match('/offline.html')));
 }else if(url.pathname.startsWith('/_next/static/')||url.pathname.startsWith('/icons/')||url.pathname==='/icon.svg'){
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok&&!response.headers.get('Cache-Control')?.includes('no-store')){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(request,copy)));}return response;})));
 }
});
