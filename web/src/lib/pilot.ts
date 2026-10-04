// Approved launch scope. Changing it requires a coordinated SQL + app release.
export const PILOT_CITY = 'Бельцы';
export const PILOT_CITY_RO = 'Bălți';
export const PILOT_BID_LIMIT = 10;
export const PILOT_JOB_LIMIT = 5;
export const PILOT_CENTER: [number, number] = [47.7617, 27.9297];
// Service coverage box around Bălți, not a claim about municipal boundaries.
export const PILOT_BOUNDS: [[number, number], [number, number]] = [[47.68, 27.82], [47.83, 28.02]];
export function isPilotLocation(lat: number | null, lng: number | null): boolean {
  return lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= PILOT_BOUNDS[0][0] && lat <= PILOT_BOUNDS[1][0]
    && lng >= PILOT_BOUNDS[0][1] && lng <= PILOT_BOUNDS[1][1];
}
