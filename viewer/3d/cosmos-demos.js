// Optional recorded demos: no scene state or simulation clocks are modified.
export function installCosmosDemos(tabs) {
  if (document.getElementById('cosmos-demos')) return;
  const button = document.createElement('button');
  button.className = 'tab';
  button.textContent = 'Cosmos3-Super';
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-controls', 'cosmos-demos');
  tabs.append(button);
  const dialog = document.createElement('dialog');
  dialog.id = 'cosmos-demos';
  dialog.setAttribute('aria-labelledby', 'cosmos-title');
  dialog.innerHTML = `<header><h2 id="cosmos-title">Cosmos3-Super demos</h2><button type="button" data-close aria-label="Close demos">Close</button></header>
    <nav aria-label="Choose a demo"><button type="button" data-demo="0">Video generation</button><button type="button" data-demo="1">Text modification</button></nav>
    <video controls playsinline preload="none" aria-label="Cosmos3-Super demonstration"></video>
    <details><summary>About these recordings</summary><p data-caption></p></details><p data-status role="status"></p>`;
  const style = document.createElement('style');
  style.textContent = `#cosmos-demos{box-sizing:border-box;width:min(1000px,94vw);max-height:92dvh;overflow:auto;border:1px solid #516570;border-radius:16px;background:#14232d;color:#edf4f8;padding:20px}#cosmos-demos::backdrop{background:#000b}#cosmos-demos header{display:flex;align-items:center;justify-content:space-between;gap:16px}#cosmos-demos h2{font:600 20px system-ui;margin:0}#cosmos-demos nav{display:flex;gap:10px;margin:18px 0;flex-wrap:wrap}#cosmos-demos button{font:inherit;color:inherit;background:#293e4a;border:1px solid #6b8796;border-radius:8px;padding:10px 14px;cursor:pointer}#cosmos-demos button[aria-pressed=true]{background:#246b70}#cosmos-demos button:focus-visible{outline:3px solid #83e9ee;outline-offset:3px}#cosmos-demos video{display:block;width:100%;max-height:62dvh;background:#000}#cosmos-demos details{margin-top:12px;color:#a9c0cc;font:12px/1.5 system-ui}#cosmos-demos summary{cursor:pointer}#cosmos-demos p{font:12px/1.5 system-ui}#cosmos-demos [data-status]:empty{display:none}`;
  document.head.append(style);
  document.body.append(dialog);
  const video = dialog.querySelector('video');
  const status = dialog.querySelector('[data-status]');
  const demos = [
    ['video-generation.mp4', 'Video generation · Recorded November 20, 2026. Cosmos3-Super renders conditioned on Canopy edge videos and generated first frames.'],
    ['text-modification.mp4', 'Two recorded Cosmos3-Super edits: lower/cream and raise/slate blue, followed by Undo. Accelerated playback; native reasoner batch outputs from November 25, 2026. Geometry only; physics not recalculated.']
  ];
  function play(index) {
    video.pause();
    status.textContent = '';
    video.src = new URL('../demos/' + demos[index][0], import.meta.url).href;
    dialog.querySelector('[data-caption]').textContent = demos[index][1];
    dialog.querySelectorAll('[data-demo]').forEach(el => el.setAttribute('aria-pressed', String(Number(el.dataset.demo) === index)));
    video.play().catch(() => { if (dialog.open) status.textContent = 'Press Play to start the video.'; });
  }
  button.addEventListener('click', event => { event.stopPropagation(); dialog.showModal(); play(0); });
  dialog.querySelectorAll('[data-demo]').forEach(el => el.addEventListener('click', () => play(Number(el.dataset.demo))));
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => event.stopPropagation());
  dialog.addEventListener('close', () => { video.pause(); video.removeAttribute('src'); video.load(); button.focus(); });
  video.addEventListener('error', () => { if (dialog.open) status.textContent = 'Unable to load this video. Select the demo again to retry.'; });
}
