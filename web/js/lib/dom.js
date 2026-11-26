// Tiny DOM helpers. All dynamic text goes through esc() before reaching innerHTML.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => (v == null ? '' : String(v).replace(/[&<>"']/g, (c) => ESC[c]));

/** Tagged template that escapes interpolations unless wrapped with raw(). */
export function html(strings, ...values) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < values.length) out += render(values[i]);
  });
  return new Raw(out);
}
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(String(s));
function render(v) {
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(render).join('');
  if (v === false || v == null) return '';
  return esc(v);
}

export function setHtml(el, content) {
  if (el) el.innerHTML = String(content);
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Create a titled panel with a status slot; returns { el, body }. */
export function panel(title, { cls = '', id = '' } = {}) {
  const el = document.createElement('section');
  el.className = `panel ${cls}`.trim();
  if (id) el.id = id;
  el.innerHTML = `<header class="panel-h"><h2>${esc(title)}</h2><span class="panel-status" aria-live="polite"></span></header><div class="panel-b"></div>`;
  return { el, body: el.querySelector('.panel-b'), status: el.querySelector('.panel-status') };
}

/** Mark a panel STALE / OFFLINE (text, not just colour). */
export function setPanelStatus(p, status, detail = '') {
  if (!p?.status) return;
  p.el.classList.toggle('is-stale', status === 'STALE');
  p.el.classList.toggle('is-offline', status === 'OFFLINE');
  p.status.innerHTML = status && status !== 'LIVE'
    ? `<span class="pill pill-${status.toLowerCase()}" title="${esc(detail)}">${esc(status)}</span>` : '';
}

export const storage = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode etc. */ } },
};
