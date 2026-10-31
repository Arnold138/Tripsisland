import exifr from 'exifr';

/** Lit la date et le lieu GPS d'une photo (les balises GPS doivent être demandées explicitement). */
export async function readMeta(f: Blob | ArrayBuffer | Uint8Array): Promise<{ lat: number | null; lon: number | null; taken_at: string | null }> {
  const m = await exifr.parse(f as Blob, { gps: true, pick: ['DateTimeOriginal', 'GPSLatitude', 'GPSLatitudeRef', 'GPSLongitude', 'GPSLongitudeRef'] }).catch(() => null);
  const ok = typeof m?.latitude === 'number' && typeof m?.longitude === 'number' && !(m.latitude === 0 && m.longitude === 0);
  return {
    lat: ok ? m.latitude : null, lon: ok ? m.longitude : null,
    taken_at: m?.DateTimeOriginal instanceof Date ? m.DateTimeOriginal.toISOString() : null
  };
}
