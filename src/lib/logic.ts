export const TASTE_GROUPS: { title: string; items: [string, string][] }[] = [
  { title: 'Manger & boire', items: [['street', 'Street food'], ['gastro', 'Gastronomie'], ['ramen', 'Ramen & sushi'], ['izakaya', 'Izakaya & saké'], ['cafe', 'Cafés & matcha'], ['sucre', 'Pâtisseries & douceurs'], ['marches', 'Marchés']] },
  { title: 'Culture japonaise', items: [['temples', 'Temples & sanctuaires'], ['ghibli', 'Studio Ghibli'], ['anime', 'Anime & manga'], ['jeux', 'Jeux vidéo & arcades'], ['samourai', 'Châteaux & samouraïs'], ['tradition', 'Japon traditionnel (geishas, thé)'], ['festivals', 'Festivals & matsuri'], ['kawaii', 'Kawaii & insolite']] },
  { title: 'Nature & bien-être', items: [['marche', 'Marche & rando'], ['nature', 'Nature'], ['jardins', 'Jardins zen'], ['onsen', 'Onsen'], ['montagne', 'Montagne & neige'], ['mer', 'Mer & îles'], ['fleurs', 'Fleurs (prunier, sakura)']] },
  { title: 'Sorties & ville', items: [['nuit', 'Vie nocturne'], ['karaoke', 'Karaoké'], ['bars', 'Bars à cocktails'], ['shopping', 'Shopping'], ['vintage', 'Friperies & vintage'], ['design', 'Design & papeterie'], ['quartiers', 'Quartiers à flâner']] },
  { title: 'Art & découverte', items: [['musees', 'Musées'], ['artdigital', 'Art numérique (teamLab)'], ['archi', 'Architecture'], ['photo', 'Photo & points de vue'], ['ateliers', 'Ateliers (cuisine, artisanat)'], ['histoire', 'Histoire']] }
];
export const TASTES: [string, string][] = TASTE_GROUPS.flatMap((g) => g.items);
/** Préférence de foule (une seule à la fois, rangée avec les goûts). */
export const CROWD_PREFS: [string, string][] = [['foule-evite', 'On évite la foule'], ['foule-ok', 'Peu importe'], ['foule-ambiance', 'On aime l’ambiance']];

const CODE_RE = /ISLA-[A-Z0-9]{4}/;
const PENDING = 'tripisland:invite';

/** Extrait un code d'invitation d'un texte libre ou d'un lien (?code=ISLA-XXXX). */
export function parseInviteCode(input: string | null | undefined): string | null {
  if (!input) return null;
  const m = input.toUpperCase().match(CODE_RE);
  return m ? m[0] : null;
}

export function inviteLink(code: string, base = location.href.split('?')[0].split('#')[0]): string {
  return `${base}?code=${encodeURIComponent(code)}`;
}

/** Garde le code d'un lien d'invitation le temps de la connexion Google. */
export function rememberInviteFromUrl(): void {
  const code = parseInviteCode(new URLSearchParams(location.search).get('code'));
  if (code) { try { localStorage.setItem(PENDING, code); } catch { /* stockage indisponible */ } }
}
export function takePendingInvite(): string | null {
  try { const c = localStorage.getItem(PENDING); localStorage.removeItem(PENDING); return c; } catch { return null; }
}

export function commonTastes(a: string[], b: string[]): string[] {
  const s = new Set(b);
  return a.filter((t) => s.has(t));
}

export function daysUntil(date: string, now = new Date()): number {
  const d = new Date(date + 'T00:00:00');
  const n = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d.getTime() - n.getTime()) / 86400000);
}

/** Liste des jours (AAAA-MM-JJ) entre deux dates incluses. */
export function tripDays(start: string | null, end: string | null): string[] {
  if (!start || !end) return [];
  const out: string[] = [];
  const d = new Date(start + 'T12:00:00Z');
  const e = new Date(end + 'T12:00:00Z');
  while (d <= e && out.length < 120) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}

/** Trie les activités par heure, les sans-heure à la fin. */
export function byTime<T extends { time: string | null }>(list: T[]): T[] {
  return [...list].sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
}

export const mapsLink = (q: { title: string; address?: string | null; place_id?: string | null }) =>
  'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q.address ? `${q.title} ${q.address}` : q.title) +
  (q.place_id ? '&query_place_id=' + encodeURIComponent(q.place_id) : '');

/** Distance à vol d'oiseau en km. */
export function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = Math.PI / 180, dLat = (b.lat - a.lat) * R, dLon = (b.lon - a.lon) * R;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * R) * Math.cos(b.lat * R) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

export type Leg = { mode: 'walking' | 'transit' | 'train'; minutes: number; km: number };

/**
 * Estimation réaliste d'un trajet (sans horaires en direct) :
 * à pied jusqu'à ~1,6 km (4,5 km/h, rues pas droites) ; métro/train en ville
 * (≈ 28 km/h en moyenne + 12 min d'accès et d'attente) ; au-delà de 60 km, train rapide.
 */
export function estimateLeg(a: { lat: number; lon: number }, b: { lat: number; lon: number }): Leg {
  const d = km(a, b);
  if (d <= 1.6) return { mode: 'walking', minutes: Math.max(2, Math.round((d * 1.3) / 4.5 * 60)), km: d };
  if (d <= 60) return { mode: 'transit', minutes: Math.round(12 + (d * 1.25) / 28 * 60), km: d };
  return { mode: 'train', minutes: Math.round(25 + d / 150 * 60), km: d };
}

export const fmtMin = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`);
export const fmtKm = (d: number) => (d < 1 ? `${Math.round(d * 1000 / 50) * 50} m` : `${d.toFixed(d < 10 ? 1 : 0).replace('.', ',')} km`);

/** Itinéraire Google Maps entre deux points (ou depuis la position actuelle si pas de départ). */
export function dirLink(to: { lat: number | null; lon: number | null; title: string; address?: string | null }, from?: { lat: number | null; lon: number | null } | null, mode: Leg['mode'] = 'transit'): string {
  const dest = to.lat != null && to.lon != null ? `${to.lat},${to.lon}` : (to.address ? `${to.title} ${to.address}` : to.title);
  const o = from && from.lat != null && from.lon != null ? `&origin=${from.lat},${from.lon}` : '';
  return `https://www.google.com/maps/dir/?api=1${o}&destination=${encodeURIComponent(dest)}&travelmode=${mode === 'walking' ? 'walking' : 'transit'}`;
}
