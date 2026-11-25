/** Shared Scenario navigation. Links preserve reload, history and open-in-new-tab. */
export function renderScenarioTabs(container, {items, current}) {
  const fragment = document.createDocumentFragment();
  for (const item of items) {
    const tab = document.createElement(item.available === false ? 'span' : 'a');
    tab.className = 'scenario-tab';
    tab.dataset.scenario = item.id;
    tab.textContent = item.label || item.title || item.id;
    tab.title = item.title || item.id;
    if (item.available === false) {
      tab.setAttribute('aria-disabled', 'true');
      tab.title += ' — data unavailable';
    } else {
      tab.href = item.href;
    }
    if (item.id === current) tab.setAttribute('aria-current', 'page');
    fragment.append(tab);
  }
  container.replaceChildren(fragment);
  container.setAttribute('aria-label', 'Scenarios');
  container.onkeydown = event => {
    const links = [...container.querySelectorAll('a[href]')];
    const index = links.indexOf(document.activeElement);
    if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + links.length) % links.length;
    links[next].focus();
    links[next].scrollIntoView({block:'nearest', inline:'nearest'});
  };
  container.querySelector('[aria-current="page"]')?.scrollIntoView({block:'nearest', inline:'nearest'});
}
