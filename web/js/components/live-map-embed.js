// Live aircraft map: adsb.lol's public tracker (open source tar1090, ODbL data), embedded unchanged.
// It loads in each viewer's browser (like the flight-board widget), so it updates every few seconds
// and does not use the Worker's adsb.lol quota. We don't read, scrape or restyle its contents.
import { LIVE_MAP } from '../config.js';
import { esc } from '../lib/dom.js';

/** @param {{ zoom?: number, labels?: boolean, interactive?: boolean }} opts */
export function liveMapEmbed({ zoom = LIVE_MAP.zoom, labels = true, interactive = true } = {}) {
  const p = new URLSearchParams({ lat: String(LIVE_MAP.lat), lon: String(LIVE_MAP.lon), zoom: String(zoom) });
  let qs = p.toString() + '&hideSidebar&hideButtons';
  if (labels) qs += '&enableLabels&extendedLabels=1';
  const el = document.createElement('div');
  el.className = 'live-map';
  el.innerHTML = `<iframe title="Live aircraft map around YYT (adsb.lol)" src="${esc(LIVE_MAP.url)}?${esc(qs)}"
      loading="lazy" referrerpolicy="no-referrer-when-downgrade" ${interactive ? '' : 'tabindex="-1" style="pointer-events:none"'}></iframe>
    <p class="live-map-credit">Live map: <a href="${esc(LIVE_MAP.url)}?${esc(p.toString())}" target="_blank" rel="noopener">adsb.lol</a> (ODbL) · updates every few seconds</p>`;
  return el;
}
