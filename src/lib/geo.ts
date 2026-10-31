import { supabase, type Activity } from './supabase';

/**
 * Place une activité sur la carte (1 seule recherche Google par activité, jamais répétée) :
 * on « réserve » d'abord la ligne (geo_tried) pour que les deux téléphones ne cherchent pas en double.
 */
export async function geocodeActivity(a: Activity, tripTitle: string): Promise<boolean> {
  if (a.lat != null || a.geo_tried) return false;
  const { data: claimed } = await supabase.from('activities').update({ geo_tried: true }).eq('id', a.id).eq('geo_tried', false).select('id');
  if (!claimed?.length) return false;
  const query = a.query ?? `${a.title} ${tripTitle}`;
  const { data } = await supabase.functions.invoke('places-search', { body: { query } });
  const p = data?.places?.[0];
  if (!p || p.lat == null) return false;
  await supabase.from('activities').update({ lat: p.lat, lon: p.lon, address: a.address ?? p.address, place_id: a.place_id ?? p.id }).eq('id', a.id);
  return true;
}
