// Read-only information alongside the existing scene; selection comes from the viewer.
export function installModelCard(tabs, cards) {
  const host = document.createElement('aside');
  host.id = 'model-card';
  host.hidden = true;
  host.setAttribute('aria-label', 'About this model');
  host.innerHTML = `<header><span data-label></span><button type="button" aria-expanded="true" aria-controls="model-card-body" aria-label="Collapse model information">−</button></header><div id="model-card-body"><h2></h2><p data-description></p><nav aria-label="Model references"></nav><details><summary>About this demo</summary><p data-note></p></details></div>`;
  document.body.append(host);
  const toggle = host.querySelector('button');
  const body = host.querySelector('#model-card-body');
  let current;
  toggle.addEventListener('click', () => {
    body.hidden = !body.hidden;
    toggle.textContent = body.hidden ? '+' : '−';
    toggle.setAttribute('aria-expanded', String(!body.hidden));
    toggle.setAttribute('aria-label', `${body.hidden ? 'Expand' : 'Collapse'} model information`);
  });
  // Keep card controls out of the city's Space/arrow-key handlers.
  host.addEventListener('keydown', event => event.stopPropagation());
  function position() {
    host.style.top = `${Math.ceil(tabs.getBoundingClientRect().bottom + 10)}px`;
  }
  const observer = new ResizeObserver(position);
  observer.observe(tabs);
  window.addEventListener('resize', position);
  position();
  return {
    select(key) {
      if (current === key) return;
      current = key;
      const card = cards[key];
      host.hidden = !card;
      if (!card) return;
      host.querySelector('[data-label]').textContent = card.label;
      host.querySelector('h2').textContent = card.title;
      host.querySelector('[data-description]').textContent = card.description;
      host.querySelector('[data-note]').textContent = `${card.description} ${card.note}`;
      host.querySelector('details').open = false;
      const nav = host.querySelector('nav');
      nav.replaceChildren();
      for (const [label, href] of card.links) {
        if (new URL(href).protocol !== 'https:') continue;
        const a = document.createElement('a');
        a.textContent = label; a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
        nav.append(a);
      }
    },
    dispose() { observer.disconnect(); window.removeEventListener('resize', position); host.remove(); }
  };
}
