/** Directional daylight only; ambient illumination keeps the city navigable at night. */
export function solarLight(altitudeDeg, azimuthDeg, radius = 3000) {
  if (!Number.isFinite(altitudeDeg) || !Number.isFinite(azimuthDeg)) throw new Error('Invalid solar direction');
  const alt = altitudeDeg * Math.PI / 180, az = azimuthDeg * Math.PI / 180;
  return {
    position: [radius * Math.cos(alt) * Math.sin(az), radius * Math.sin(alt), -radius * Math.cos(alt) * Math.cos(az)],
    intensity: Math.max(0, Math.sin(alt)),
  };
}
