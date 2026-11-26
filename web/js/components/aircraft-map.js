// Leaflet map: rotated aircraft icons coloured by altitude band, labels, trails, range rings,
// extended runway centerlines (only when official headings are configured), dead reckoning.
// Leaflet (BSD-2) is vendored and loaded as the global `L` by the page.
import { MAP } from '../config.js';
import { esc } from '../lib/dom.js';
import { fmt } from '../lib/units.js';
import { deadReckon, destination } from '../lib/deadReckon.js';
import { nowSec } from '../lib/time.js';

const NM = 1852;
export const ALT_BANDS = [
  { max: 0, cls: 'alt-g', label: 'Ground' },
  { max: 2000, cls: 'alt-0', label: '< 2,000 ft' },
  { max: 10000, cls: 'alt-1', label: '2–10k ft' },
  { max: 20000, cls: 'alt-2', label: '10–20k ft' },
  { max: 30000, cls: 'alt-3', label: '20–30k ft' },
  { max: Infinity, cls: 'alt-4', label: '≥ 30k ft' },
];
export const altBand = (a) => (a.onGround ? ALT_BANDS[0] : ALT_BANDS.slice(1).find((b) => (a.altFt ?? 0) < b.max) ?? ALT_BANDS[5]);

const PLANE = '<path d="M12 2c.8 0 1.3.9 1.3 2v5.2l7.7 4.6v2l-7.7-2.3v4.7l2.2 1.7V21L12 20l-3.5 1v-1.1l2.2-1.7v-4.7L3 15.8v-2l7.7-4.6V4c0-1.1.5-2 1.3-2z"/>';

function icon(a, { labels, selected }) {
  const band = altBand(a);
  const alert = a.alert ? ` alert-${a.alert.kind.toLowerCase()}` : '';
  const rot = a.trackDeg ?? 0;
  const label = labels
    ? `<span class="ac-label">${esc(a.callsign ?? a.reg ?? a.hex.toUpperCase())}<br><small>${esc(a.onGround ? 'GND' : fmt.flAlt(a.altFt))}${a.alert ? ' · ' + esc(a.squawk) : ''}</small></span>` : '';
  return L.divIcon({
    className: `ac ${band.cls}${alert}${selected ? ' selected' : ''}`,
    html: `<svg viewBox="0 0 24 24" style="transform:rotate(${rot}deg)" aria-hidden="true">${PLANE}</svg>${label}`,
    iconSize: [26, 26], iconAnchor: [13, 13],
  });
}

export class AircraftMap {
  /**
   * @param {HTMLElement} el
   * @param {{mini?:boolean, labels?:boolean, trails?:boolean, interactive?:boolean, onSelect?:(hex:string)=>void, zoom?:number}} opts
   */
  constructor(el, opts = {}) {
    this.opts = { labels: true, trails: true, interactive: true, filter: 'all', ...opts };
    this.items = new Map();
    this.selected = null;
    this.metaKey = '';
    const center = [47.6186, -52.7519];
    this.map = L.map(el, {
      center, zoom: opts.zoom ?? (opts.mini ? MAP.miniZoom : MAP.zoom),
      zoomControl: !opts.mini && this.opts.interactive,
      dragging: this.opts.interactive, scrollWheelZoom: this.opts.interactive && !opts.mini,
      doubleClickZoom: this.opts.interactive, keyboard: this.opts.interactive, touchZoom: this.opts.interactive,
      attributionControl: true,
    });
    L.tileLayer(MAP.tiles, {
      maxZoom: 15, minZoom: 5,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    }).addTo(this.map);
    this.map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');

    // Fit a radius (nm) around the airport instead of a fixed zoom, so any screen size shows the area.
    const fitNm = opts.fitNm ?? (opts.mini ? MAP.miniFitNm : MAP.fitNm);
    if (fitNm && opts.zoom == null) this.map.fitBounds(L.latLng(center).toBounds(2 * fitNm * NM), { animate: false });

    this.staticLayer = L.layerGroup().addTo(this.map);
    this.trailLayer = L.layerGroup().addTo(this.map);
    this.acLayer = L.layerGroup().addTo(this.map);
    this.drawRings(center);

    this.tick = setInterval(() => this.reckon(), 1000);
  }

  drawRings(center) {
    for (const nm of MAP.rings) {
      L.circle(center, { radius: nm * NM, className: 'ring', interactive: false, fill: false, weight: 1 }).addTo(this.staticLayer);
      const [lat, lon] = destination(center[0], center[1], 45, nm);
      L.marker([lat, lon], { interactive: false, icon: L.divIcon({ className: 'ring-label', html: `${nm} nm`, iconSize: [40, 14] }) }).addTo(this.staticLayer);
    }
  }

  /** Extended centerlines from the ARP along the approach path (approximation: thresholds not modelled). */
  setMeta(meta) {
    const rw = (meta?.runways ?? []).filter((r) => r.trueHdg != null);
    const key = JSON.stringify(rw);
    if (key === this.metaKey) return;
    this.metaKey = key;
    this.centerlines?.remove();
    this.centerlines = L.layerGroup().addTo(this.map);
    for (const r of rw) {
      const approachFrom = (r.trueHdg + 180) % 360;
      const end = destination(meta.lat, meta.lon, approachFrom, MAP.centerlineNm);
      L.polyline([[meta.lat, meta.lon], end], { className: 'centerline', interactive: false, weight: 1.5, dashArray: '6 6' }).addTo(this.centerlines);
      L.marker(destination(meta.lat, meta.lon, approachFrom, MAP.centerlineNm + 0.8), {
        interactive: false, icon: L.divIcon({ className: 'cl-label', html: esc(r.id), iconSize: [24, 14] }),
      }).addTo(this.centerlines);
    }
  }

  setOptions(o) {
    Object.assign(this.opts, o);
    this.update(this.last ?? []);
  }

  visible(a) {
    const f = this.opts.filter;
    return f === 'all' || (f === 'ground' ? a.onGround : !a.onGround);
  }

  /** @param {import('../types.js').Aircraft[]} list */
  update(list) {
    this.last = list;
    const seen = new Set();
    for (const a of list) {
      if (!this.visible(a)) continue;
      seen.add(a.hex);
      let it = this.items.get(a.hex);
      const pos = deadReckon(a, nowSec());
      if (!it) {
        const marker = L.marker(pos, { icon: icon(a, { labels: this.opts.labels, selected: a.hex === this.selected }), keyboard: false, riseOnHover: true });
        marker.on('click', () => this.select(a.hex));
        marker.bindTooltip(() => {
          const x = this.items.get(a.hex)?.a ?? a;
          return esc(`${x.callsign ?? x.hex.toUpperCase()} · ${x.type ?? ''} · ${x.onGround ? 'GND' : fmt.flAlt(x.altFt)}`);
        }, { direction: 'top', offset: [0, -10] });
        marker.addTo(this.acLayer);
        it = { marker, trail: null, a };
        this.items.set(a.hex, it);
      } else {
        it.marker.setLatLng(pos);
        it.marker.setIcon(icon(a, { labels: this.opts.labels, selected: a.hex === this.selected }));
      }
      it.a = a;
      const pts = this.opts.trails ? (a.trail ?? []).map((p) => [p[0], p[1]]) : [];
      if (pts.length > 1) {
        pts.push(pos);
        if (it.trail) it.trail.setLatLngs(pts);
        else it.trail = L.polyline(pts, { className: `trail ${altBand(a).cls}${a.hex === this.selected ? ' selected' : ''}`, interactive: false, weight: 2 }).addTo(this.trailLayer);
      } else if (it.trail) { it.trail.remove(); it.trail = null; }
    }
    for (const [hex, it] of this.items) {
      if (seen.has(hex)) continue;
      it.marker.remove(); it.trail?.remove();
      this.items.delete(hex);
    }
  }

  reckon() {
    const now = nowSec();
    for (const it of this.items.values()) {
      const p = deadReckon(it.a, now);
      it.marker.setLatLng(p);
      if (it.trail) {
        const ll = it.trail.getLatLngs();
        if (ll.length) { ll[ll.length - 1] = L.latLng(p); it.trail.setLatLngs(ll); }
      }
    }
  }

  select(hex) {
    this.selected = hex;
    this.update(this.last ?? []);
    this.opts.onSelect?.(hex);
  }

  invalidate() { this.map.invalidateSize(); }

  destroy() {
    clearInterval(this.tick);
    this.map.remove();
  }
}

export function altLegend() {
  return `<ul class="legend">${ALT_BANDS.map((b) => `<li><span class="sw ${b.cls}"></span>${esc(b.label)}</li>`).join('')}</ul>`;
}
