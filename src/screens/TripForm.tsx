import { useState } from 'react';
import { supabase, type Trip } from '../lib/supabase';

const COLORS = ['#FF4A1C', '#2F54EB', '#14B8A6', '#A855F7', '#E9A23B', '#0E0E0E'];

type Props = { islandId: string; trip?: Trip | null; past?: boolean; onClose: () => void; onDeleted?: () => void; onCreated?: (t: Trip) => void };

export default function TripForm({ islandId, trip, past: pastDefault, onClose, onDeleted, onCreated }: Props) {
  const [title, setTitle] = useState(trip?.title ?? '');
  const [start, setStart] = useState(trip?.start_date ?? '');
  const [end, setEnd] = useState(trip?.end_date ?? '');
  const [color, setColor] = useState(trip?.color ?? COLORS[0]);
  const [past, setPast] = useState(trip ? trip.status === 'past' : !!pastDefault);
  const [sure, setSure] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setErr('Donne un nom au voyage.'); return; }
    if (start && end && end < start) { setErr('La date de fin est avant le départ.'); return; }
    setBusy(true);
    // Place la destination sur le globe (une seule recherche, seulement si le nom change).
    let coords: { lat: number | null; lon: number | null } = { lat: trip?.lat ?? null, lon: trip?.lon ?? null };
    if (!trip || trip.title !== title.trim() || trip.lat == null) {
      const { data } = await supabase.functions.invoke('places-search', { body: { query: title.trim() } });
      const p = data?.places?.[0];
      if (p?.lat != null) coords = { lat: p.lat, lon: p.lon };
    }
    const row = { ...coords, title: title.trim(), start_date: start || null, end_date: end || null, color, status: past ? 'past' : 'upcoming', updated_at: new Date().toISOString() };
    if (trip) {
      const { error } = await supabase.from('trips').update(row).eq('id', trip.id);
      setBusy(false);
      if (error) setErr(error.message); else onClose();
      return;
    }
    const { data, error } = await supabase.from('trips').insert({ ...row, island_id: islandId }).select().single();
    setBusy(false);
    if (error) setErr(error.message); else { onClose(); if (data) onCreated?.(data as Trip); }
  };
  const remove = async () => {
    if (!trip) return;
    if (!sure) { setSure(true); return; } // deuxième appui pour confirmer, sans fenêtre système
    // Supprime aussi les fichiers photo du stockage (sinon ils resteraient sans voyage).
    const { data: ph } = await supabase.from('photos').select('path').eq('trip_id', trip.id);
    if (ph?.length) await supabase.storage.from('photos').remove(ph.map((p) => p.path));
    const { error } = await supabase.from('trips').delete().eq('id', trip.id);
    if (error) setErr(error.message); else { onClose(); onDeleted?.(); }
  };

  return (
    <>
      <div className="sheet-back" onClick={onClose} />
      <form className="sheet" onSubmit={save} aria-label={trip ? 'Modifier le voyage' : 'Nouveau voyage'}>
        <h2>{trip ? 'Modifier le voyage' : past ? 'Ancien voyage' : 'Nouveau voyage'}</h2>
        {!trip && past && <p className="sub" style={{ margin: 0 }}>Ajoutez-le, puis vos photos : leur lieu et leur date s’affichent sur le globe.</p>}
        <div className="field"><label htmlFor="tt">Destination</label>
          <input id="tt" className="input" placeholder="Japon, Islande, Lisbonne…" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="row">
          <div className="field" style={{ flex: 1 }}><label htmlFor="ts">Départ</label>
            <input id="ts" className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div className="field" style={{ flex: 1 }}><label htmlFor="te">Retour</label>
            <input id="te" className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        </div>
        <div className="field"><label>Couleur sur le globe</label>
          <div className="row" role="radiogroup" aria-label="Couleur">
            {COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)}
                style={{ width: 44, height: 44, borderRadius: '50%', border: color === c ? '3px solid var(--ink)' : '3px solid transparent', background: c, boxShadow: 'inset 0 0 0 3px #fff' }} />
            ))}
          </div>
        </div>
        <label className="card" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={past} onChange={(e) => setPast(e.target.checked)} style={{ width: 20, height: 20 }} />
          <span style={{ fontSize: 15 }}>Voyage déjà fait (souvenir)</span>
        </label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn" disabled={busy}>{trip ? 'Enregistrer' : 'Créer le voyage'}</button>
        {trip && <button type="button" className="btn danger sm" onClick={remove}>{sure ? `Oui, supprimer « ${trip.title} » et tout son contenu` : 'Supprimer ce voyage'}</button>}
      </form>
    </>
  );
}
