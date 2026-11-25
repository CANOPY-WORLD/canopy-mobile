export function installMobileUI() {
 const header=document.createElement('header');header.className='mobile-header';
 header.innerHTML='<a class="mobile-brand" href="../../">Canopy<span>Mobile</span></a><a class="desktop-link" href="https://canopy-world.github.io/canopy/" target="_blank" rel="noopener">Full website</a>';
 const footer=document.createElement('section');footer.className='mobile-dock';
 footer.innerHTML='<div class="mobile-context"><button id="mobile-about" type="button" aria-haspopup="dialog"><span data-current>London overview</span><span class="about-hint">About this model</span></button><button id="mobile-explore" type="button" aria-haspopup="dialog">Explore</button></div><p id="mobile-status" role="status"></p>';
 const menu=document.createElement('dialog');menu.id='mobile-menu';menu.setAttribute('aria-labelledby','mobile-menu-title');
 menu.innerHTML='<header><div><p class="eyebrow">CANOPY MOBILE</p><h2 id="mobile-menu-title">Explore the city</h2></div><button type="button" data-close aria-label="Close Explore">Close</button></header><p class="menu-note">Choose a model. Data loads when you need it.</p>';
 const tabs=document.getElementById('tabs');menu.append(tabs);
 const info=document.createElement('dialog');info.id='mobile-info';info.setAttribute('aria-labelledby','mobile-info-title');
 info.innerHTML='<header><h2 id="mobile-info-title">About this model</h2><button type="button" data-close aria-label="Close model information">Close</button></header><p class="mobile-limits">Mobile preview uses simplified building geometry and sampled vegetation. Recorded model results keep their original values and timestamps.</p>';
 document.body.append(header,footer,menu,info);
 const open=(dialog,button)=>{dialog.showModal();dialog._opener=button};
 for(const dialog of [menu,info]){
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>dialog._opener?.focus());
  dialog.addEventListener('keydown',e=>e.stopPropagation());
 }
 const explore=footer.querySelector('#mobile-explore');explore.onclick=()=>open(menu,explore);
 const about=footer.querySelector('#mobile-about');about.onclick=()=>open(info,about);
 menu.addEventListener('click',e=>{const b=e.target.closest('button.tab');if(b){menu.close();if(b.hasAttribute('aria-busy'))status('Loading selected model…')}});
 // Cosmos stops propagation, so close the menu before its dialog opens.
 tabs.addEventListener('click',e=>{if(e.target.closest('[aria-controls="cosmos-demos"]'))menu.close()},true);
 function status(text){footer.querySelector('#mobile-status').textContent=text;}
 window.addEventListener('mobile-status',e=>status(e.detail));
 const observer=new MutationObserver(()=>{
  const active=tabs.querySelector('[data-shot].active,[data-field].active');
  if(active)footer.querySelector('[data-current]').textContent=active.textContent;
  const card=document.getElementById('model-card');
  if(card&&card.parentElement!==info){info.append(card);card.querySelector('#model-card-body').hidden=false;}
 });
 observer.observe(tabs,{attributes:true,subtree:true,childList:true,attributeFilter:['class','aria-busy']});
 observer.observe(document.body,{childList:true});
 for(const node of [header,footer])node.addEventListener('keydown',e=>e.stopPropagation());
 document.querySelector('#mobile-about').disabled=false;
 const player=document.querySelector('.timebar');
 const timeline=player.querySelector('input[type=range]');if(timeline)timeline.setAttribute('aria-label','Simulation playback position');
 const label=document.createElement('p');label.className='mobile-map-hint';label.textContent='Drag to explore · pinch to zoom';document.body.append(label);
 const canvas=document.getElementById('gl');canvas.addEventListener('pointerdown',()=>label.remove(),{once:true});
 // Show real buffering messages without mirroring long desktop diagnostics.
 const stage=document.getElementById('stage');new MutationObserver(()=>{if(/unavailable|failed|buffer|preparing/i.test(stage.textContent))status(stage.textContent);}).observe(stage,{childList:true,characterData:true,subtree:true});
}
