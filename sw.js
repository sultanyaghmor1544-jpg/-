const CACHE='thakir-v16';
const ASSETS=['./','./index.html','./style.css','./app.js','./sky.js','./data.js','./manifest.json','./icon.svg','./icon.png','./icon-192.png','./icon-maskable.png','./apple-touch-icon.png'];

self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});

self.addEventListener('activate',e=>e.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
));

// Same-origin GET: serve from cache instantly, refresh the cache in the background
// (so a new upload to GitHub shows up on the next open instead of never).
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  if(new URL(req.url).origin!==self.location.origin)return;
  e.respondWith(caches.open(CACHE).then(async c=>{
    const cached=await c.match(req,{ignoreSearch:true});
    const net=fetch(req).then(r=>{if(r&&r.ok)c.put(req,r.clone());return r}).catch(()=>null);
    if(cached){e.waitUntil(net);return cached}
    const r=await net;
    return r||(req.mode==='navigate'?c.match('./index.html'):Response.error());
  }));
});

self.addEventListener('push',e=>{
  let data={title:'ذَكِّر',body:'حان وقت الأذكار 🌿',icon:'./icon.png'};
  try{if(e.data)data={...data,...e.data.json()}}catch(_){}
  e.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:data.icon,badge:data.icon,dir:'rtl',lang:'ar'}));
});

self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>cs.length?cs[0].focus():clients.openWindow('./')));
});
