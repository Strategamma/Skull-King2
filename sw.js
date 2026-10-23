const CACHE='skull-king-shell-v5';
const SHELL=['./','./index.html','./style.css','./app.js','./feedback.js','./cards.js','./audio.js','./victory.js','./rules.js','./bot.js','./table-layout.js','./turn-alerts.js','./config.js','./manifest.webmanifest','./assets/app-icon-192.png','./assets/app-icon-512.png','./assets/skull-king-wordmark-matte.png','./assets/captains-cabin.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('skull-king-shell-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==location.origin||url.pathname.endsWith('/socket')||url.pathname.endsWith('/healthz'))return;
 event.respondWith(fetch(req).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)));}return response;}).catch(async()=>{const cached=await caches.match(req);if(cached)return cached;if(req.mode==='navigate'){const fallback=await caches.match(new URL('./index.html',self.registration.scope));if(fallback)return fallback;}return Response.error();}));
});
