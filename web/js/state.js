// Tiny pub/sub store. Modules subscribe to slices by key.
const data = new Map();
const subs = new Map();

export function set(key, value) {
  data.set(key, value);
  (subs.get(key) ?? []).forEach((fn) => { try { fn(value); } catch (e) { console.error(e); } });
}

export const get = (key) => data.get(key);

/** Subscribe; calls immediately with the current value if present. Returns an unsubscribe fn. */
export function subscribe(key, fn) {
  if (!subs.has(key)) subs.set(key, new Set());
  subs.get(key).add(fn);
  if (data.has(key)) { try { fn(data.get(key)); } catch (e) { console.error(e); } }
  return () => subs.get(key)?.delete(fn);
}
