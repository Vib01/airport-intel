// Must render on every view.
export const DISCLAIMER =
  'Situational awareness only. Not an official source and not for flight planning or operational decisions. ' +
  'Use NAV CANADA official products and your dispatcher/ATC.';

export function disclaimer(compact = false) {
  const el = document.createElement('p');
  el.className = `disclaimer${compact ? ' compact' : ''}`;
  el.setAttribute('role', 'note');
  el.innerHTML = `<strong>Safety notice:</strong> ${DISCLAIMER}`;
  return el;
}
