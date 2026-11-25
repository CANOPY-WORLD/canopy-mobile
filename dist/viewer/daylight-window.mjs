// Presentation bounds only; the complete source day and frame indices are retained.
export function daylightWindow(altitudes, count, fullDay = false) {
  const full = {start: 1, end: count};
  if (fullDay || !Array.isArray(altitudes) || altitudes.length !== count || !altitudes.every(Number.isFinite)) return full;
  const first = altitudes.findIndex(a => a > 0);
  if (first < 0) return full;
  let last = count - 1;
  while (altitudes[last] <= 0) last--;
  return {start: first + 1, end: last + 1};
}
