// Plain-language helpers for METAR weather strings, sky cover and WMO weather codes.

const INTENSITY = { '-': 'light', '+': 'heavy' };
const DESC = { MI: 'shallow', PR: 'partial', BC: 'patches of', DR: 'drifting', BL: 'blowing', SH: 'showers of', TS: 'thunderstorm with', FZ: 'freezing' };
const PHEN = {
  DZ: 'drizzle', RA: 'rain', SN: 'snow', SG: 'snow grains', IC: 'ice crystals', PL: 'ice pellets', GR: 'hail', GS: 'small hail', UP: 'precipitation',
  BR: 'mist', FG: 'fog', FU: 'smoke', VA: 'volcanic ash', DU: 'dust', SA: 'sand', HZ: 'haze', PY: 'spray',
  PO: 'dust whirls', SQ: 'squalls', FC: 'funnel cloud', SS: 'sandstorm', DS: 'duststorm',
};

/** "-SN BR" → "Light snow and mist" */
export function wxToWords(wx) {
  if (!wx) return null;
  const parts = wx.trim().split(/\s+/).map((tok) => {
    let t = tok, words = [];
    const vc = t.startsWith('VC'); if (vc) t = t.slice(2);
    if (INTENSITY[t[0]]) { words.push(INTENSITY[t[0]]); t = t.slice(1); }
    if (t.startsWith('VC')) { t = t.slice(2); }
    for (const d of Object.keys(DESC)) if (t.startsWith(d)) { words.push(DESC[d]); t = t.slice(2); break; }
    const ph = [];
    while (t.length >= 2) { ph.push(PHEN[t.slice(0, 2)] ?? t.slice(0, 2)); t = t.slice(2); }
    if (ph.length) words.push(ph.join(' and '));
    else if (words.length) words[words.length - 1] = words[words.length - 1].replace(/ (of|with)$/, '');
    let s = words.join(' ');
    if (vc) s += ' nearby';
    return s.trim();
  });
  const s = parts.filter(Boolean).join(', and ');
  return s ? s[0].toUpperCase() + s.slice(1) : null;
}

/** Highest cover → words. */
export function skyToWords(clouds, cavok, vertVisFt) {
  if (vertVisFt != null) return 'Sky obscured';
  if (cavok) return 'Clear skies';
  if (!clouds?.length) return 'Clear skies';
  const rank = { FEW: 1, SCT: 2, BKN: 3, OVC: 4 };
  const max = clouds.reduce((m, c) => Math.max(m, rank[c.cover] ?? 0), 0);
  return ['Clear skies', 'Mostly clear', 'Partly cloudy', 'Mostly cloudy', 'Overcast'][max];
}

/** WMO weather interpretation codes (Open-Meteo) → [word, icon key]. */
export function wmo(code) {
  if (code == null) return ['—', 'cloud'];
  if (code === 0) return ['Clear', 'sun'];
  if (code <= 2) return ['Partly cloudy', 'partly'];
  if (code === 3) return ['Overcast', 'cloud'];
  if (code <= 48) return ['Fog', 'fog'];
  if (code <= 57) return ['Drizzle', 'rain'];
  if (code <= 67) return [code >= 66 ? 'Freezing rain' : 'Rain', 'rain'];
  if (code <= 77) return ['Snow', 'snow'];
  if (code <= 82) return ['Rain showers', 'rain'];
  if (code <= 86) return ['Snow showers', 'snow'];
  return ['Thunderstorm', 'storm'];
}

const P = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
const CLOUD = '<path d="M7 17h10a3.5 3.5 0 0 0 .5-7 5 5 0 0 0-9.6-1A4 4 0 0 0 7 17z"/>';
const ICONS = {
  sun: `<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>`,
  partly: `<path d="M8 3v1.5M3 8h1.5M4.5 4.5l1 1M11.5 4.5l-1 1"/><path d="M5.2 10.5a3 3 0 0 1 5.6-2.6"/><path d="M9 20h8.5a3 3 0 0 0 .4-6 4.2 4.2 0 0 0-8-.8A3.4 3.4 0 0 0 9 20z"/>`,
  cloud: CLOUD,
  fog: `${CLOUD}<path d="M5 20h14M7 22h10"/>`,
  rain: `${CLOUD}<path d="M9 19l-1 2.5M13 19l-1 2.5M17 19l-1 2.5"/>`,
  snow: `${CLOUD}<path d="M9 20h.01M13 20h.01M17 20h.01M11 22.5h.01M15 22.5h.01"/>`,
  storm: `${CLOUD}<path d="M12 17l-2 3h3l-2 3"/>`,
};
export const wxIcon = (key) => `<svg class="wxi" viewBox="0 0 24 24" aria-hidden="true" ${P}>${ICONS[key] ?? ICONS.cloud}</svg>`;
