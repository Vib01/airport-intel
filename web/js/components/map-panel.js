// Interactive map panel: layer toggles, filter, detail sheet, full-screen button.
import { FEATURES } from '../config.js';
import { storage, esc } from '../lib/dom.js';
import { AircraftMap, altLegend } from './aircraft-map.js';
import { Overlays } from './overlays.js';
import { renderAircraftDetail } from './aircraft-detail.js';

const DEFAULTS = { radar: false, radarKind: 'rain', sigmet: true, pirep: false, trails: true, labels: true, filter: 'all' };

export class MapPanel {
  constructor(host) {
    this.prefs = { ...DEFAULTS, ...storage.get('mapPrefs', {}) };
    host.innerHTML = `<div class="map-wrap">
      <div class="map full"></div>
      <form class="map-ctl" aria-label="Map layers">
        ${FEATURES.radar ? `<label><input type="checkbox" name="radar"> Radar</label>
          <select name="radarKind" aria-label="Radar type"><option value="rain">rain</option><option value="snow">snow</option></select>` : ''}
        ${FEATURES.sigmet ? '<label><input type="checkbox" name="sigmet"> SIGMETs</label>' : ''}
        <label><input type="checkbox" name="pirep"> PIREPs</label>
        <label><input type="checkbox" name="trails"> Trails</label>
        <label><input type="checkbox" name="labels"> Labels</label>
        <select name="filter" aria-label="Show aircraft"><option value="all">All aircraft</option><option value="airborne">Airborne</option><option value="ground">On ground</option></select>
        <button type="button" class="btn-units btn-fs" aria-label="Full screen map">⛶ Full screen</button>
      </form>
      <div class="map-legend">${altLegend()}<span class="map-count" aria-live="polite"></span></div>
      <aside class="sheet" hidden aria-label="Aircraft details"></aside>
    </div>`;
    this.wrap = host.querySelector('.map-wrap');
    this.form = host.querySelector('.map-ctl');
    this.sheet = host.querySelector('.sheet');
    this.count = host.querySelector('.map-count');
    for (const [k, v] of Object.entries(this.prefs)) {
      const i = this.form.elements.namedItem(k);
      if (!i) continue;
      if (i.type === 'checkbox') i.checked = !!v; else i.value = v;
    }
    this.selected = null;
    this.aircraft = [];
    this.pilot = null;
    this.map = new AircraftMap(host.querySelector('.map'), {
      labels: this.prefs.labels, trails: this.prefs.trails, filter: this.prefs.filter,
      onSelect: (hex) => { this.selected = hex; this.showDetail(); },
    });
    this.ov = new Overlays(this.map.map);

    this.form.addEventListener('change', () => {
      for (const k of Object.keys(DEFAULTS)) {
        const i = this.form.elements.namedItem(k);
        if (i) this.prefs[k] = i.type === 'checkbox' ? i.checked : i.value;
      }
      storage.set('mapPrefs', this.prefs);
      this.map.setOptions({ labels: this.prefs.labels, trails: this.prefs.trails, filter: this.prefs.filter });
      this.applyOverlays();
    });
    this.form.addEventListener('submit', (e) => e.preventDefault());
    host.querySelector('.btn-fs').addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else this.wrap.requestFullscreen?.().catch(() => this.wrap.classList.toggle('pseudo-fs'));
    });
    this.onFs = () => setTimeout(() => this.map.invalidate(), 50);
    document.addEventListener('fullscreenchange', this.onFs);
    this.applyOverlays();
  }

  showDetail() {
    renderAircraftDetail(this.sheet, this.aircraft.find((a) => a.hex === this.selected) ?? null,
      () => { this.selected = null; this.sheet.hidden = true; this.map.selected = null; this.map.update(this.aircraft); });
  }

  applyOverlays() {
    this.ov.setRadar(this.prefs.radar, this.prefs.radarKind);
    this.ov.setSigmets(this.pilot?.sigmet, this.prefs.sigmet);
    this.ov.setPireps(this.pilot?.pirep, this.prefs.pirep);
  }

  setPilot(p) { this.pilot = p; this.applyOverlays(); }

  setDashboard(d) {
    this.aircraft = d?.aircraft ?? [];
    if (d) { this.map.setMeta(d.meta); this.map.update(this.aircraft); }
    const emerg = this.aircraft.filter((a) => a.alert);
    this.count.innerHTML = `${this.aircraft.length} aircraft within 60 nm${emerg.length
      ? ` · <b class="alert-text">${emerg.map((a) => esc(`${a.callsign ?? a.hex} ${a.alert.label}`)).join(', ')}</b>` : ''}`;
    if (this.selected) this.showDetail();
  }

  destroy() {
    document.removeEventListener('fullscreenchange', this.onFs);
    this.ov.destroy();
    this.map.destroy();
  }
}
