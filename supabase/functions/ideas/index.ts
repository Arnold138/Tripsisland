// Génère des idées d'activités (Claude Haiku) selon les goûts du couple, puis les enregistre pour le swipe.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const TASTE: Record<string, string> = {
  street: 'street food', gastro: 'gastronomie', ramen: 'ramen et sushi', izakaya: 'izakaya et saké', cafe: 'cafés et matcha', sucre: 'pâtisseries', marches: 'marchés',
  temples: 'temples et sanctuaires', ghibli: 'Studio Ghibli', anime: 'anime et manga', jeux: 'jeux vidéo et arcades', samourai: 'châteaux et samouraïs',
  tradition: 'Japon traditionnel (geishas, cérémonie du thé)', festivals: 'festivals et matsuri', kawaii: 'kawaii et insolite',
  marche: 'marche et randonnée', nature: 'nature', jardins: 'jardins zen', onsen: 'onsen', montagne: 'montagne et neige', mer: 'mer et îles', fleurs: 'fleurs (pruniers, sakura)',
  nuit: 'vie nocturne', karaoke: 'karaoké', bars: 'bars à cocktails', shopping: 'shopping', vintage: 'friperies et vintage', design: 'design et papeterie', quartiers: 'quartiers à flâner',
  musees: 'musées', artdigital: 'art numérique (teamLab)', archi: 'architecture', photo: 'photo et points de vue', ateliers: 'ateliers (cuisine, artisanat)', histoire: 'histoire'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'Clé Claude absente côté serveur.' }, 503);

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }
  });
  let body: { trip_id?: string; city?: string; day?: string; categories?: string[] };
  try { body = await req.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }
  if (!body.trip_id) return json({ error: 'Voyage manquant.' }, 400);

  // RLS : ne renvoie le voyage que si l'utilisateur en est membre.
  const { data: trip } = await sb.from('trips').select('id, island_id, title, start_date, end_date').eq('id', body.trip_id).single();
  if (!trip) return json({ error: 'Voyage introuvable.' }, 404);
  const { data: members } = await sb.from('island_members').select('user_id').eq('island_id', trip.island_id);
  const { data: profs } = await sb.from('profiles').select('tastes, pace').in('id', (members ?? []).map((m) => m.user_id));
  const { data: existing } = await sb.from('ideas').select('title').eq('trip_id', trip.id);

  const cats = (Array.isArray(body.categories) ? body.categories : []).filter((c) => typeof c === 'string').slice(0, 10).map((c) => c.slice(0, 30));
  const city = typeof body.city === 'string' ? body.city.trim().slice(0, 60) : '';
  const day = typeof body.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.day) ? body.day : null;
  const raw = (profs ?? []).flatMap((p) => p.tastes ?? []);
  const crowdPref = raw.includes('foule-evite') ? 'Ils évitent la foule : privilégie les lieux moins connus et indique les heures calmes.' : raw.includes('foule-ambiance') ? 'Ils aiment les lieux animés et vivants.' : '';
  const all = raw.filter((t) => !t.startsWith('foule-'));
  const common = all.filter((t, i) => all.indexOf(t) !== i);
  const tastes = [...new Set(all)].map((t) => TASTE[t] ?? t);
  const prompt = `Tu aides un couple à préparer son voyage "${trip.title}" (${trip.start_date} → ${trip.end_date}).
Leurs goûts : ${tastes.join(', ') || 'non précisés'}. Goûts communs prioritaires : ${[...new Set(common)].map((t) => TASTE[t] ?? t).join(', ') || 'aucun'}.
${crowdPref}
Déjà proposé (à ne pas répéter) : ${(existing ?? []).map((e) => e.title).join(' ; ') || 'rien'}.
${cats.length ? `Types d'activités demandés UNIQUEMENT : ${cats.join(', ')}.` : 'Mélange obligatoirement les types : restaurants, street food, balades, randonnée, culture, sorties, shopping, bars…'}
${city ? `Lieu imposé : ${city} et ses environs proches.` : ''}${day ? ` Pour la journée du ${day} (tiens compte du jour de la semaine et des fermetures habituelles).` : ''}
Propose 8 activités réelles avec le NOM PROPRE exact d'un lieu qui existe (pas de lieu générique inventé), variées, adaptées à la saison. Réponds UNIQUEMENT par un tableau JSON, sans texte autour :
[{"title":"…","city":"quartier, ville (ex. Shinjuku, Tokyo)","why":"une phrase qui relie l'activité à leurs goûts","tag":"RESTAURANT|STREET FOOD|RANDONNÉE|BALADE|SORTIE|BAR|SHOPPING|CULTURE|ONSEN|NATURE|ATELIER","price":"estimation en yens, ex. ≈ 2 000 ¥ / pers, ou Gratuit","duration":"ex. 2 h","query":"nom exact du lieu + ville, pour une recherche Google Maps","station":"gare ou station de métro la plus proche (nom exact, ex. Shinjuku-gyoemmae)"}]`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 3000, thinking: { type: 'disabled' }, messages: [{ role: 'user', content: prompt }] })
  });
  if (!r.ok) {
    const detail = await r.text();
    console.error('anthropic', r.status, detail.slice(0, 300));
    const msg = r.status === 401 ? 'Clé Claude refusée (vérifie le secret ANTHROPIC_API_KEY).'
      : r.status === 400 && detail.includes('credit') ? 'Crédit Claude insuffisant sur ce compte.'
      : r.status === 404 ? 'Modèle Claude introuvable.' : `IA indisponible (erreur ${r.status}).`;
    return json({ error: msg }, 502);
  }
  const out = await r.json();
  // La réponse peut contenir plusieurs blocs (réflexion, texte) : on ne garde que le texte.
  const text: string = (out.content ?? []).filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('\n');
  let list: any[] = [];
  try { list = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)); } catch { console.error('parse', out.stop_reason, JSON.stringify((out.content ?? []).map((b: any) => b?.type)), text.slice(0, 300)); return json({ error: 'Réponse IA illisible, réessaie.' }, 502); }

  // Validation stricte avant écriture.
  const s = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : null);
  const rows = list.filter((x) => x && typeof x.title === 'string').slice(0, 8).map((x) => ({
    trip_id: trip.id, title: s(x.title, 120)!, city: s(x.city, 60), why: s(x.why, 300), tag: s(x.tag, 20),
    price: s(x.price, 40), duration: s(x.duration, 30), query: s(x.query, 120), station: s(x.station, 60), day
  }));
  if (!rows.length) return json({ error: 'Aucune idée reçue, réessaie.' }, 502);
  const { error } = await sb.from('ideas').insert(rows);
  if (error) return json({ error: error.message }, 400);
  return json({ count: rows.length });
});
