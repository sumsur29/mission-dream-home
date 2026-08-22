const CACHE='mdh-v6';
const SHELL=['.','index.html','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.pathname.startsWith('/api')) return;
  // never intercept instagram embeds / cross-origin fonts POSTs etc.
  if(u.origin!==location.origin){return;}
  // app shell + local photos: cache-first, fall back to network then cache
  e.respondWith(
    caches.match(e.request,{ignoreSearch:true}).then(hit=>hit||fetch(e.request).then(res=>{
      const copy=res.clone();
      if(res.ok && (u.pathname.includes('/photos/')||SHELL.some(s=>u.pathname.endsWith(s.replace('.',''))||u.pathname.endsWith(s)))){
        caches.open(CACHE).then(c=>c.put(e.request,copy));
      }
      return res;
    }).catch(()=>caches.match('index.html')))
  );
});
