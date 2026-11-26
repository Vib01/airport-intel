// Plain-language "now" sentence (from METAR) + next-24 h strip (Open-Meteo).
import { esc } from '../lib/dom.js';
import { compassWord, fmt, unitMode } from '../lib/units.js';
import { hour, ago, nowSec } from '../lib/time.js';
import { skyToWords, wmo, wxIcon, wxToWords } from '../lib/wx.js';

/** @param {import('../types.js').Metar|null} m */
export function weatherSentence(m) {
  if (!m) return 'No current observation available.';
  const parts = [];
  parts.push(wxToWords(m.wx) ?? skyToWords(m.clouds, m.cavok, m.vertVisFt));
  if (m.windKt === 0) parts.push('calm wind');
  else if (m.windKt != null) {
    const dir = m.windVariable || m.windDirDeg == null ? 'variable wind' : `wind from the ${compassWord(m.windDirDeg)}`;
    parts.push(`${dir} at ${fmt.wind(m.windKt)}${m.gustKt ? ` gusting ${fmt.wind(m.gustKt)}` : ''}`);
  }
  let s = parts.join(', ') + '.';
  if (m.visSm != null) s += ` Visibility ${fmt.visSm(m.visSm, m.visPlus)}.`;
  return s[0].toUpperCase() + s.slice(1);
}

/** @param {HTMLElement} el @param {{metar:{decoded:any}|null, forecast:any[]}} w */
export function renderWeatherCard(el, w, { hours = 24, now = nowSec() } = {}) {
  const m = w?.metar?.decoded ?? null;
  const fc = (w?.forecast ?? []).slice(0, hours);
  const metric = unitMode() === 'metric';
  el.innerHTML = `
    <div class="wx-now">
      <div class="wx-temp">${esc(fmt.temp(m?.tempC))}</div>
      <div>
        <p class="wx-sentence">${esc(weatherSentence(m))}</p>
        <p class="fine">Observed at YYT ${esc(m ? ago(m.obsTime, now) : '—')}${m?.dewpC != null ? ` · dew point ${esc(fmt.temp(m.dewpC))}` : ''}${m?.altimHpa != null ? ` · pressure ${esc(fmt.hpa(m.altimHpa))}` : ''}</p>
      </div>
    </div>
    ${fc.length ? `<div class="fc-strip" role="list" aria-label="Next ${fc.length} hours">${fc.map((f) => {
      const [word, icon] = wmo(f.weatherCode);
      return `<div class="fc-h" role="listitem" title="${esc(word)}">
        <span class="fc-t">${esc(hour(f.t))}</span>
        ${wxIcon(icon)}
        <span class="fc-temp">${esc(fmt.temp(f.tempC))}</span>
        <span class="fc-pop${f.popPct === 0 ? ' zero' : ''}">${f.popPct != null ? `${esc(f.popPct)}%` : '—'}</span>
        <span class="fc-wind">${esc(metric ? fmt.num(f.windKt * 1.852) : fmt.num(f.windKt))}${f.gustKt && f.gustKt - f.windKt >= 8 ? `<sup>G${esc(metric ? fmt.num(f.gustKt * 1.852) : fmt.num(f.gustKt))}</sup>` : ''}</span>
      </div>`;
    }).join('')}</div>
    <p class="fine">Next ${fc.length} h: hour (local), temperature, chance of precipitation, wind ${metric ? 'km/h' : 'kt'}. Forecast: Open-Meteo.</p>` : '<p class="muted">Forecast unavailable.</p>'}`;
}
