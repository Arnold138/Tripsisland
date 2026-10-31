// Estimation d'affluence (Claude Haiku) : niveau 1 à 5, courbe par heure, meilleurs créneaux.
// Ce n'est PAS une mesure en direct : l'app l'affiche comme une estimation.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'Clé Claude absente côté serveur.' }, 503);
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }
  });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: 'Connexion requise.' }, 401);

  let body: { name?: string; address?: string; date?: string; activity_id?: string };
  try { body = await req.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }
  const name = (body.name ?? '').toString().trim().slice(0, 120);
  const address = (body.address ?? '').toString().trim().slice(0, 160);
  if (name.length < 2) return json({ error: 'Lieu manquant.' }, 400);
  const date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? new Date(body.date + 'T12:00:00Z') : null;
  const when = date ? `un ${DAYS[date.getUTCDay()]} de ${MONTHS[date.getUTCMonth()]}` : 'en général';

  const prompt = `Lieu : "${name}"${address ? ` (${address})` : ''}. Visite prévue ${when}.
Estime l'affluence habituelle de ce lieu (fréquentation touristique et locale, saison, vacances au Japon, jour de la semaine).
Réponds UNIQUEMENT par un objet JSON, sans texte autour :
{"level":1-5 (1 très calme, 5 bondé),"label":"Calme|Modérée|Fréquentée|Très fréquentée|Bondée","hours":[18 nombres de 0 à 100 pour 6h,7h,…,23h, 0 si fermé],"best":"meilleur créneau en une phrase courte, ex. Avant 8 h ou après 17 h","avoid":"créneau à éviter, phrase courte","note":"une phrase sur la saison ou un conseil concret"}`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 700, thinking: { type: 'disabled' }, messages: [{ role: 'user', content: prompt }] })
  });
  if (!r.ok) { console.error('anthropic', r.status, (await r.text()).slice(0, 300)); return json({ error: 'Estimation indisponible pour le moment.' }, 502); }
  const out = await r.json();
  const text: string = (out.content ?? []).filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('\n');
  let x: any;
  try { x = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)); } catch { console.error('parse', text.slice(0, 300)); return json({ error: 'Estimation illisible, réessaie.' }, 502); }

  // Validation stricte avant écriture.
  const s = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const level = Math.max(1, Math.min(5, Math.round(Number(x.level) || 3)));
  const hours = Array.isArray(x.hours) ? x.hours.slice(0, 18).map((h: unknown) => Math.max(0, Math.min(100, Math.round(Number(h) || 0)))) : [];
  while (hours.length < 18) hours.push(0);
  const crowd = { level, label: s(x.label, 30) || ['Calme', 'Modérée', 'Fréquentée', 'Très fréquentée', 'Bondée'][level - 1], hours, best: s(x.best, 120), avoid: s(x.avoid, 120), note: s(x.note, 200), when };

  if (typeof body.activity_id === 'string') {
    // RLS : n'écrit que si l'utilisateur est membre du voyage.
    await sb.from('activities').update({ crowd, crowd_at: new Date().toISOString() }).eq('id', body.activity_id);
  }
  return json({ crowd });
});
