/**
 * Distances only mean something for a local marketplace. Beyond this the number is noise
 * (a visitor abroad sees "7332.8 km" on every card), so the UI shows the city instead.
 */
export const MAX_MEANINGFUL_DISTANCE_KM = 300;

export const isMeaningfulDistance = (km: number | undefined): km is number =>
    typeof km === 'number' && Number.isFinite(km) && km <= MAX_MEANINGFUL_DISTANCE_KM;

/** "850 m" under a kilometre, "1.4 km" under ten, "23 km" above. */
export const formatDistance = (km: number): string => {
    if (km < 1) return `${Math.max(50, Math.round(km * 1000 / 50) * 50)} m`;
    if (km < 10) return `${km.toFixed(1)} km`;
    return `${Math.round(km)} km`;
};
