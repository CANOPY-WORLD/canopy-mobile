try {
 await import('./scene-navigation.js');
 if(!('serviceWorker' in navigator))throw Error('Please use a browser with service worker support to load CANOPY.');
 const root=new URL('../',import.meta.url);const registration=await navigator.serviceWorker.register(new URL('asset-router.js',root));await registration.update().catch(error=>{if(!registration.active)throw error});const pending=registration.installing||registration.waiting;
 if(pending&&pending.state!=='activated')await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Asset connection update timed out. Please reload.')),30000);pending.addEventListener('statechange',()=>{if(pending.state==='activated'){clearTimeout(timer);resolve()}if(pending.state==='redundant'){clearTimeout(timer);reject(Error('Asset connection update failed. Please reload.'))}})});
 await navigator.serviceWorker.ready;
 if(!navigator.serviceWorker.controller)await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Asset connection timed out. Please reload.')),20000);navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(t);resolve()},{once:true})});
 const query=new URLSearchParams(location.search);
 if(!root.pathname.endsWith('/src/visualization/legacy/') && !query.has('run') && !query.has('presentation')) {
   const {downloadAll}=await import('../preload.js');
   // Mobile: selected resources only; never prefetch the complete offline bundle.
 }
 await import('./bootstrap.js');
} catch(error){document.getElementById('loading').classList.add('failed');document.getElementById('loading-title').textContent='Unable to connect';document.getElementById('pct').textContent=error.message;const a=document.createElement('a');a.href=location.href;a.textContent='Retry';document.querySelector('#loading .loading-progress').append(a);}
