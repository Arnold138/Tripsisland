// Recherche de lieux réels (Google Places API New, Text Search, champs Pro uniquement).
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const key = Deno.env.get('GOOGLE_PLACES_KEY');
  if (!key) return json({ error: 'Clé Google absente côté serveur.' }, 503);
  let body: { query?: string; lat?: number; lon?: number };
  try { body = await req.json(); } catch { return json({ error: 'Requête invalide.' }, 400); }
  const query = (body.query ?? '').toString().trim().slice(0, 120);
  if (query.length < 2) return json({ places: [] });

  const payload: Record<string, unknown> = { textQuery: query, languageCode: 'fr', maxResultCount: 8 };
  if (typeof body.lat === 'number' && typeof body.lon === 'number') {
    payload.locationBias = { circle: { center: { latitude: body.lat, longitude: body.lon }, radius: 30000 } };
  }
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.businessStatus,places.primaryTypeDisplayName'
    },
    body: JSON.stringify(payload)
  });
  if (!r.ok) return json({ error: r.status === 429 ? 'Quota du jour atteint, réessaie demain.' : 'Recherche indisponible.' }, r.status === 429 ? 429 : 502);
  const data = await r.json();
  const places = (data.places ?? []).map((p: any) => ({
    id: p.id,
    name: p.displayName?.text ?? '',
    address: p.formattedAddress ?? '',
    lat: p.location?.latitude ?? null,
    lon: p.location?.longitude ?? null,
    status: p.businessStatus ?? null,
    type: p.primaryTypeDisplayName?.text ?? null
  }));
  return json({ places });
});
