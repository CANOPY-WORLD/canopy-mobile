// Shared navigation remains usable while an individual scene is loading.
const legacyRoot = new URL('../', import.meta.url);
const local = legacyRoot.pathname.endsWith('/src/visualization/legacy/');
const root = local ? new URL('../../../', legacyRoot) : legacyRoot;
const { renderScenarioTabs } = await import(new URL('src/visualization/shared/scenario-tabs.mjs', root));
const style = document.createElement('link');
style.rel = 'stylesheet';
style.href = new URL('src/visualization/shared/scenario-tabs.css', root);
document.head.append(style);
const catalogue = new URL('src/visualization/public-scenes.json', root);
const tabs = document.getElementById('scenario-tabs');
const home = document.getElementById('scene-home');
home.href = root.href;
const query = new URLSearchParams(location.search);
let current = query.get('scene');
try {
  const response = await fetch(catalogue, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Scene catalogue: HTTP ${response.status}`);
  const { scenes } = await response.json();
  if (!current) {
    const index = await fetch(new URL('scenes/index.json', legacyRoot)).then(r => {
      if (!r.ok) throw new Error(`Scenario index: HTTP ${r.status}`);
      return r.json();
    });
    current = index.default;
  }
  if (query.has('run') && !scenes.some((s) => s.scene_id === current)) {
    const metadata = await fetch(new URL(`project/${current}/project.json`, root)).then((r) =>
      r.json(),
    );
    scenes.push({ scene_id: current, title: metadata.title, viewer_url: location.href });
  }
  const selected = scenes.find(scene => scene.scene_id === current);
  if (selected) {
    const title = document.getElementById('loading-scenario');
    const description = document.getElementById('loading-description');
    if (title) title.textContent = selected.title;
    if (description) description.textContent = selected.description || 'Preparing geometry and recorded results for this scenario.';
  }
  renderScenarioTabs(tabs, {current, items:scenes.map((scene) => {
      const target = new URL(scene.viewer_url, root);
      // Keep rendering preferences; scene-specific field/camera state is reset.
      for (const key of ['lite', 'tile', 'expansion']) {
        if (query.has(key)) target.searchParams.set(key, query.get(key));
      }
      return {id:scene.scene_id,title:scene.title,label:scene.short,href:target.href};
    })});
} catch (error) {
  tabs.textContent = 'Scenarios unavailable — use Canopy home';
  console.error(error);
}
