// Map overlays: ECCC GeoMet radar WMS (browser-loaded tiles, OGL-Canada), SIGMET polygons, PIREP markers.
import { FEATURES, RADAR } from '../config.js';
import { esc } from '../lib/dom.js';
import { ago, ddhhmmZ } from '../lib/time.js';
import { fmt } from '../lib/units.js';

export class Overlays {
  constructor(map) {
    this.map = map;
    this.radar = null;
    this.sigmet = L.layerGroup();
    this.pirep = L.layerGroup();
    this.timer = null;
  }

  setRadar(on, kind = 'rain') {
    if (!FEATURES.radar) return;
    if (this.radar) { this.radar.remove(); this.radar = null; clearInterval(this.timer); }
    if (!on) return;
    this.radar = L.tileLayer.wms(RADAR.url, {
      layers: RADAR.layers[kind] ?? RADAR.layers.rain, format: 'image/png', transparent: true, version: '1.3.0',
      opacity: 0.6, className: 'radar',
      attribution: 'Radar: <a href="https://eccc-msc.github.io/open-data/" target="_blank" rel="noopener">ECCC MSC GeoMet</a> (OGL-Canada)',
    }).addTo(this.map);
    // Latest frame is the server default; force a refresh every 6 min.
    this.timer = setInterval(() => this.radar?.setParams({ _r: Date.now() }), RADAR.refreshMs);
  }

  /** @param {{type:'FeatureCollection', features:any[]}} fc */
  setSigmets(fc, on) {
    this.sigmet.clearLayers();
    if (!FEATURES.sigmet || !fc) return;
    L.geoJSON(fc, {
      style: () => ({ className: 'sigmet', weight: 2 }),
      onEachFeature: (f, layer) => {
        const p = f.properties;
        layer.bindPopup(`<b>SIGMET ${esc(p.hazard)}${p.qualifier ? ' ' + esc(p.qualifier) : ''}</b><br>${esc(p.fir)}<br>
          ${p.baseFt != null || p.topFt != null ? `${esc(fmt.flAlt(p.baseFt ?? 0))} – ${esc(fmt.flAlt(p.topFt))}<br>` : ''}
          Valid ${esc(ddhhmmZ(p.validFrom))} – ${esc(ddhhmmZ(p.validTo))}<pre class="raw small">${esc(p.raw)}</pre>`, { maxWidth: 360 });
      },
    }).addTo(this.sigmet);
    this.toggle(this.sigmet, on);
  }

  setPireps(list, on) {
    this.pirep.clearLayers();
    for (const p of list ?? []) {
      const sev = p.turbulence || p.icing;
      L.circleMarker([p.lat, p.lon], { radius: sev ? 7 : 4, className: `pirep ${sev ? 'pirep-sig' : ''}`, weight: 1.5 })
        .bindPopup(`<b>${esc(p.type)} ${esc(p.acType ?? '')}</b> · ${esc(fmt.flAlt(p.altFt))} · ${esc(ago(p.obsTime))}<br>
          ${p.turbulence ? `Turbulence: ${esc(p.turbulence)}<br>` : ''}${p.icing ? `Icing: ${esc(p.icing)}<br>` : ''}
          <pre class="raw small">${esc(p.raw)}</pre>`, { maxWidth: 360 })
        .addTo(this.pirep);
    }
    this.toggle(this.pirep, on);
  }

  toggle(layer, on) {
    if (on && !this.map.hasLayer(layer)) layer.addTo(this.map);
    if (!on && this.map.hasLayer(layer)) layer.remove();
  }

  destroy() { clearInterval(this.timer); }
}
