/** Great-circle distance in metres. */
export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Location check: within the radius, allowing for reported GPS accuracy up to 50 m
 * extra (indoor GPS drifts), but rejecting very poor fixes.
 */
export function withinGeofence(
  pos: { lat: number; lng: number; accuracy?: number },
  center: { lat: number; lng: number },
  radiusM: number,
) {
  const distance = haversineM(pos, center);
  const acc = Math.min(pos.accuracy ?? 0, 50);
  const ok = (pos.accuracy ?? 0) <= 500 && distance <= radiusM + acc;
  return { ok, distance: Math.round(distance), accuracy: Math.round(pos.accuracy ?? 0) };
}
