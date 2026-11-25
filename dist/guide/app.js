const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const repo = 'https://github.com/CANOPY-WORLD/canopy/blob/main/';
const link = (path) => repo + path.split('/').map(encodeURIComponent).join('/');
const bytes = n => n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(2)} GiB` : `${(n / 1024 ** 2).toFixed(1)} MiB`;
const names = {geometry:'Geometry', solar:'Solar', flood:'Flood', wind:'Wind', temperature:'Temperature', pollution:'Pollution'};
let inventory;

function activateTab(name, focus=false) {
  $$('.tablist [role=tab]').forEach(tab => {
    const active = tab.dataset.tab === name;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    $(`#panel-${tab.dataset.tab}`).hidden = !active;
    if (active && focus) tab.focus();
  });
}
$$('.tablist [role=tab]').forEach((tab, i, tabs) => {
  tab.addEventListener('click', () => activateTab(tab.dataset.tab));
  tab.addEventListener('keydown', event => {
    const next = {ArrowRight:(i+1)%tabs.length, ArrowLeft:(i+tabs.length-1)%tabs.length, Home:0, End:tabs.length-1}[event.key];
    if (next !== undefined) {event.preventDefault();activateTab(tabs[next].dataset.tab,true);}
  });
});

function renderMethods(query='') {
  const q = query.trim().toLowerCase();
  let index=0, found=0;
  $('#method-list').innerHTML = inventory.models.map(group => {
    const methods = group.methods.map(method => ({method,index:++index})).filter(({method:m}) =>
      `${m.model_id} ${m.method_id} ${m.title} ${m.description} ${JSON.stringify(m.inputs)}`.toLowerCase().includes(q));
    found += methods.length;
    if (!methods.length) return '';
    return `<section class="method-group" aria-label="${esc(names[group.id] || group.id)} methods"><h4 class="group-heading">${esc(names[group.id] || group.id)}</h4>${methods.map(({method:m,index:i}) => {
      const ports = Object.entries(m.inputs);
      const route = ports.length ? ports.map(([name])=>name).join(' + ') : 'parameters';
      return `<details class="method"><summary><span class="method-number">${String(i).padStart(2,'0')}</span><span class="method-name">${esc(m.title)}<span class="method-id">${esc(m.model_id)} / ${esc(m.method_id)}</span></span><span class="method-route">${esc(route)} → ${m.category==='geometry'?'Geometry':'Physics'} asset</span><span class="method-toggle" aria-hidden="true">+</span></summary><div class="method-body"><p>${esc(m.description)}</p><div class="method-ports"><div><h4>Required inputs</h4>${ports.length?`<ul>${ports.map(([n,p])=>`<li><b>${esc(n)}</b> · ${esc(p.kind)}<br>Layers: ${p.required_layers.map(esc).join(', ')}${p.required_artifacts?.length?`<br>Artifacts: ${p.required_artifacts.map(esc).join(', ')}`:''}</li>`).join('')}</ul>`:'<p>Explicit generator parameters. No input Asset.</p>'}</div><div><h4>Export contract</h4><p>${m.outputs.map(esc).join(' · ')}<br>Validated manifest → immutable Asset<br>${Object.keys(m.parameters.properties).length} declared parameters · version ${esc(m.version)}<br>Cancellation: ${m.capabilities.cancel?'supported':'not supported'} · resume: ${m.capabilities.resume?'supported':'not supported'}</p></div></div><div class="method-actions"><a class="text-link" href="${link(m.guide)}">Read the run guide ↗</a><a class="text-link" href="${link(m.example)}">Example request ↗</a><button class="copy-button" data-copy="${esc(`canopy models ${m.model_id} ${m.method_id}`)}">Copy inspect command</button><span class="badge">Registered</span></div></div></details>`;
    }).join('')}</section>`;
  }).join('');
  $('#method-result').textContent = found ? `${found} Methods${q ? ' match your search' : ' across ' + inventory.models.length + ' Model groups'}` : 'No Methods match. Try a model name or a required input, such as wind.';
}

function assetTitle(a) {
  const run=a.run_id;
  if (a.scope==='verification') return a.kind==='geometry'?'GLB crop / sampled heightfield':'Solar crop verification';
  if (run.includes('solar_summer')) return 'Solar / summer';
  if (run.includes('solar_winter')) return 'Solar / winter';
  return `${names[a.simulation] || a.simulation} / recorded`;
}
function renderAssets(filter='all') {
  const rows=inventory.assets.filter(a=>filter==='all'||a.kind===filter);
  $('#asset-result').textContent=`${rows.length} ${filter==='all'?'registered':filter} Assets`;
  $('#asset-rows').innerHTML=rows.map(a=>`<tr><td><strong>${esc(assetTitle(a))}</strong><span class="reference">${esc(a.reference)}</span><span class="badge ${a.scope==='verification'?'verification':''}">${a.scope==='verification'?'Verification':'Default view'}</span></td><td>${a.layers.map(l=>`<span class="layer-line">${esc(l.id)}${l.unit?` <small>· ${esc(l.unit)}</small>`:''}</span>`).join('')}</td><td><code>${[...new Set(a.layers.map(l=>l.format))].map(esc).join('<br>')}</code></td><td>${a.sample_count||'Static'}${a.time_range_s?`<br><span class="small muted">${a.time_range_s.map(x=>Number(x).toLocaleString('en-GB')).join(' – ')} s</span>`:''}</td><td>${bytes(a.bundle_bytes)}<br><span class="small muted">${a.bundle_files} files</span></td></tr>`).join('');
  $$('.filter-row button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));
}

function renderViewer() {
  const v=inventory.visualizer;
  const tokens=items=>`<div class="token-list">${items.map(x=>`<span class="token">${esc(x)}</span>`).join('')}</div>`;
  $('#visualizer-inventory').innerHTML=[
    ['Shared shell',`<p>${v.shell.map(esc).join(' · ')}</p>`],
    ['Typed layer widgets',tokens(v.layer_kinds)],
    ['Supported encodings',tokens(v.formats)],
    ['Scenario presets',tokens(v.presets)],
    ['Widget lifecycle',tokens(v.widget_interface)],
  ].map(([title,body])=>`<div class="viewer-row"><h4>${title}</h4><div>${body}</div></div>`).join('');
}

const changes={
  model:{title:'Model standard',steps:[
    'Read the Method lifecycle and declare the exact input ports, parameter schema, version and computational artifacts.',
    'Register a trusted adapter. Implement describe, validate, prepare, execute and export; write only inside the run workspace.',
    'Add an isolated example and a complete run guide, including dependencies, hardware, expected outputs and numerical acceptance.',
    'Run behavioral and numerical checks, refresh the review inventory, and retain results through the shared runner.'
  ],command:'python model/tools/run_example.py --physics solar flood wind temperature pollution'},
  asset:{title:'Asset standard',steps:[
    'Define the representation: owner and version, space, axes, units, actual sample times, masks and exact dependencies.',
    'Extend the protocol, both schema copies, validation and affected readers/writers together. Keep tiny fixtures in model/tests/fixtures/.',
    'Validate the export before retention. Preserve provenance and SHA-256 hashes; existing Asset versions remain immutable.',
    'Refresh the London review catalog after data changes. Keep private payloads and source paths out of Git and this website.'
  ],command:'python model/tools/build_review_inventory.py --refresh-assets'},
  visualizer:{title:'Visualizer standard',steps:[
    'Read the typed layer and supported encoding. Reuse an existing widget when it can represent the data correctly.',
    'Implement loading, time, visibility, opacity, picking and disposal. Keep camera and timeline ownership in the shared shell.',
    'Preserve coordinates, masks and real samples. A preset changes presentation; it never starts a solver or modifies an Asset.',
    'Check all London layers, final samples, keyboard controls and mobile layout. Update the inventory and this guide.'
  ],command:'node --test visualizer/tests/test_viewer.mjs'},
  scenario:{title:'Scenario standard',steps:[
    'Keep imperial_corridor_8km as the sole curated case. Use a disposable workspace for synthetic Method development.',
    'Retain validated same-Scenario assets first, then register their exact references. Preserve original bounds and the vertical datum.',
    'Record a task recipe only when the Method, version, inputs and parameters are known. Select explicit Asset/layer pairs for the view.',
    'Verify the independently published data snapshot, pin its repository revision and manifest hash, then refresh the review catalog and public links.'
  ],command:'canopy --root . validate imperial_corridor_8km'}
};
function renderContribution() {
  const key=$('#change-type').value;
  const c=changes[key];
  $('#contribution-detail').innerHTML=`<ol class="contribution-steps">${c.steps.map(s=>`<li><span>${esc(s)}</span></li>`).join('')}</ol><div class="contribution-links"><a href="${link(`${key}/CONTRIBUTING.md`)}">Read the ${esc(c.title)} ↗</a><button class="copy-button" data-copy="${esc(c.command)}">Copy verification command</button></div>`;
}
$('#change-type').addEventListener('change',renderContribution);
renderContribution();
let toastTimer;
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-copy]');
  if (!button) return;
  try {
    await navigator.clipboard.writeText(button.dataset.copy);
    $('#copy-status').textContent='Command copied. Run it in your local checkout after installation.';
  } catch {
    $('#copy-status').textContent=`Copy this command: ${button.dataset.copy}`;
  }
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#copy-status').textContent='',8000);
});

try {
  const response=await fetch('inventory.json');
  if (!response.ok) throw new Error(`Inventory response: ${response.status}`);
  inventory=await response.json();
  $('#model-count').textContent=`${inventory.models.reduce((n,m)=>n+m.methods.length,0)} methods`;
  $('#asset-count').textContent=`${inventory.assets.length} assets`;
  $('#inventory-status').textContent='Generated from registered Method specs and the London review catalog. No raw simulation data is loaded here.';
  $('#inventory-status').classList.add('ready');
  $('#asset-totals').textContent=`${inventory.assets.filter(a=>a.kind==='geometry').length} Geometry · ${inventory.assets.filter(a=>a.kind==='physics').length} Physics · ${bytes(inventory.unique_bundle_bytes)} in retained bundles`;
  const s=inventory.scenario, b=s.spatial.bounds_m;
  $('#london-facts').innerHTML=`<div><strong>${s.visualization.layers.length}</strong><span>Selected layers</span></div><div><strong>${inventory.assets.length}</strong><span>Registered Assets</span></div><div><strong>${((b.max[0]-b.min[0])/1000).toFixed(3)} × ${((b.max[1]-b.min[1])/1000).toFixed(3)}</strong><span>Retained source extent / km</span></div>`;
  $('#rerun-status').textContent=s.rerun_status;
  renderMethods();renderAssets();renderViewer();
  $('#method-search').addEventListener('input',event=>renderMethods(event.target.value));
  $$('.filter-row button').forEach(button=>button.addEventListener('click',()=>renderAssets(button.dataset.filter)));
} catch (error) {
  $('#inventory-status').textContent=`The inventory could not be loaded. Reload this page or read the component READMEs in the repository. (${error.message})`;
}
