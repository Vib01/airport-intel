// Provider-swappable flight board. The provider's builder code is pasted UNCHANGED into
// web/embeds/<provider>-<arrivals|departures>.html and shown here in an iframe. We never read,
// scrape or restyle the iframe contents.
//
// BOARD_VIEW (owner request): show a window of N flight rows. Our iframe is laid out at a fixed width
// and positioned/scaled inside a clipping box — the provider's code and its contents are untouched.
// Because the provider's own credit line falls outside that window, we always show a visible credit
// with links to the provider directly under each board.
import { BOARD_CONFIGURED, BOARD_PROVIDER, BOARD_VIEW, LINKS } from '../config.js';
import { esc } from '../lib/dom.js';

export const PROVIDERS = {
  airportia: { name: 'Airportia', url: 'https://www.airportia.com/widgets/', page: (k) => `${LINKS.airportia}${k}/` },
  avionio: { name: 'Avionio', url: 'https://www.avionio.com/en', page: (k) => `https://www.avionio.com/en/airport/yyt/${k}` },
  planetrack: { name: 'PlaneTrack', url: 'https://planetrack.ai', page: () => 'https://planetrack.ai' },
};

const LABEL = { arrivals: 'Arrivals', departures: 'Departures' };
const COLS = { arrivals: 'Time · Date · From · Flight · Airline · Status', departures: 'Time · Date · To · Flight · Airline · Status' };

/**
 * @param {'arrivals'|'departures'|'both'} which
 * @param {{rows?: number, links?: boolean}} opts
 * @returns {HTMLElement & {destroy?: () => void}}
 */
export function boardEmbed(which = 'both', { rows = BOARD_VIEW.rows, links = true } = {}) {
  const el = document.createElement('div');
  el.className = 'board';
  const p = PROVIDERS[BOARD_PROVIDER];
  const kinds = which === 'both' ? ['arrivals', 'departures'] : [which];
  const more = `<p class="board-links">Also on <a href="${esc(LINKS.flightaware)}" target="_blank" rel="noopener">FlightAware</a> ·
    <a href="${esc(LINKS.flightradar)}" target="_blank" rel="noopener">Flightradar24</a></p>`;
  if (!p) { el.innerHTML = `<p class="muted">Flight board disabled.</p>${more}`; return el; }
  if (!BOARD_CONFIGURED) {
    el.innerHTML = `<div class="board-setup">
      <p><b>Scheduled arrivals and departures</b> appear here once the free ${esc(p.name)} widget is added.</p>
      <p class="fine">Setup: generate the YYT widgets at <a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.url)}</a>,
      paste them unchanged into <code>web/embeds/${esc(BOARD_PROVIDER)}-*.html</code>, then set <code>BOARD_CONFIGURED = true</code> in <code>js/config.js</code>.</p>
      </div>${more}`;
    return el;
  }

  const V = BOARD_VIEW;
  const crop = V.enabled;
  el.innerHTML = `<div class="board-frames board-${kinds.length}">${kinds.map((k) => `
    <figure class="board-one">
      <figcaption class="board-label"><span class="board-title">${esc(LABEL[k])}</span><span class="board-cols">${esc(COLS[k])}</span></figcaption>
      <div class="board-window${crop ? ' cropped' : ''}" data-kind="${esc(k)}">
        <iframe title="${esc(p.name)} ${esc(k)} board for YYT" src="embeds/${esc(BOARD_PROVIDER)}-${esc(k)}.html"
          scrolling="no" referrerpolicy="no-referrer-when-downgrade"></iframe>
      </div>
      <p class="board-credit">${esc(LABEL[k])} data: <a href="${esc(p.page(k))}" target="_blank" rel="noopener">YYT live ${esc(k)} — ${esc(p.name)}.com</a> ♥</p>
    </figure>`).join('')}
  </div>${links ? more : ''}`;

  const windows = [...el.querySelectorAll('.board-window')];
  const layout = () => {
    for (const w of windows) {
      const f = w.querySelector('iframe');
      if (!crop) { f.style.cssText = `width:100%;height:${V.frameHeight}px;border:0`; w.style.height = ''; continue; }
      const s = w.clientWidth / V.renderWidth;
      if (!s) continue;
      w.style.height = `${Math.round(rows * V.rowPx * s)}px`;
      f.style.cssText = `position:absolute;left:0;top:0;border:0;width:${V.renderWidth}px;height:${V.frameHeight}px;` +
        `transform-origin:0 0;transform:scale(${s}) translateY(-${V.firstRowPx}px);pointer-events:none`;
    }
  };
  const ro = new ResizeObserver(layout);
  windows.forEach((w) => ro.observe(w));
  requestAnimationFrame(layout);

  // Reload so the widget's time window follows the clock (it opens on the current hour).
  const timer = setInterval(() => {
    for (const f of el.querySelectorAll('iframe')) { const src = f.getAttribute('src'); f.setAttribute('src', 'about:blank'); f.setAttribute('src', src); }
  }, V.refreshMs);
  el.destroy = () => { clearInterval(timer); ro.disconnect(); };
  return el;
}
