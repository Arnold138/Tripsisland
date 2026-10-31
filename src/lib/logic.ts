export const TASTES: [string, string][] = [
  ['marche', 'Marche & rando'], ['street', 'Street food'], ['gastro', 'Gastronomie'], ['temples', 'Temples'],
  ['onsen', 'Onsen'], ['nuit', 'Vie nocturne'], ['shopping', 'Shopping'], ['musees', 'Musées'],
  ['anime', 'Anime & jeux'], ['photo', 'Photo'], ['ateliers', 'Ateliers'], ['nature', 'Nature']
];

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
