// App shell: header (clock, category badge, status pill, section links, units), single dashboard, footer.
import { POLL_MS } from './config.js';
import { poll, refreshStatuses } from './api.js';
import { subscribe } from './state.js';
import { $, esc } from './lib/dom.js';
import { hm, tzAbbr, nowSec, dateLong } from './lib/time.js';
import { onUnitMode, setUnitMode, unitMode } from './lib/units.js';
import { renderStatusPill } from './components/status-pill.js';
import { categoryBadge } from './components/metar-panel.js';
import { disclaimer } from './components/disclaimer.js';
import { attribution } from './components/attribution.js';
import { mount, SECTIONS } from './views/dashboard.js';

function clock() {
  const t = nowSec();
  $('#clock').innerHTML = `<b>${hm(t)}</b> <small>${tzAbbr(t)} · ${dateLong(t)}</small>`;
}

/** Old links (#/pilot, #/map, #/stats) and section links (#pilot) scroll to the matching section. */
function scrollToHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const id = { map: 'traffic', '': null }[h] ?? h;
  const el = id && document.getElementById(`sec-${id}`);
  if (el) el.scrollIntoView({ block: 'start' });
}

function boot() {
  clock();
  setInterval(clock, 15_000);
  setInterval(refreshStatuses, 5_000);

  $('#nav').insertAdjacentHTML('afterbegin', SECTIONS.map(([id, label]) => `<a href="#${esc(id)}">${esc(label)}</a>`).join(''));

  // One shared dashboard poll feeds the header and the page.
  poll('dashboard', '/v1/dashboard', POLL_MS);
  subscribe('dashboard', (s) => {
    const d = s.data;
    $('#hdr-cat').innerHTML = categoryBadge(d?.weather?.derived?.category);
    renderStatusPill($('#hdr-status'), s.status, d?.health ?? null, s.okAt);
    $('#foot-attr').replaceChildren(attribution(d?.health?.sources?.adsb?.sourceUsed ?? null));
  });

  $('#foot-disc').replaceChildren(disclaimer());
  $('#foot-attr').replaceChildren(attribution());

  const unitsBtn = $('#units');
  const label = () => {
    const m = unitMode();
    unitsBtn.textContent = m === 'metric' ? 'Units: metric' : 'Units: aviation';
    unitsBtn.setAttribute('aria-pressed', String(m === 'aviation'));
  };
  unitsBtn.addEventListener('click', () => setUnitMode(unitMode() === 'metric' ? 'aviation' : 'metric'));
  onUnitMode(label);
  label();

  const view = $('#view');
  view.innerHTML = '';
  mount(view);
  window.addEventListener('hashchange', scrollToHash);
  requestAnimationFrame(scrollToHash);

  // Highlight the section in view.
  const links = new Map([...document.querySelectorAll('#nav a')].map((a) => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const id = e.target.id.replace('sec-', '');
      links.forEach((a, k) => a.setAttribute('aria-current', k === id ? 'true' : 'false'));
    }
  }, { rootMargin: '-30% 0px -60% 0px' });
  document.querySelectorAll('.sec').forEach((s) => io.observe(s));
}

boot();
