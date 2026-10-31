import { useEffect, useRef, useState } from 'react';
import { supabase, type Activity, type Place } from '../lib/supabase';
import { mapsLink } from '../lib/logic';

type Props = { tripId: string; days: string[]; day: string | null; activity?: Activity | null; onClose: () => void };

const dayLabel = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

export default function ActivitySheet({ tripId, days, day, activity, onClose }: Props) {
  const [title, setTitle] = useState(activity?.title ?? '');
  const [d, setD] = useState<string>(activity ? activity.day ?? '' : day ?? '');
  const [time, setTime] = useState(activity?.time ?? '');
  const [notes, setNotes] = useState(activity?.notes ?? '');
  const [place, setPlace] = useState<Pick<Place, 'id' | 'address' | 'lat' | 'lon'> | null>(
    activity?.place_id ? { id: activity.place_id, address: activity.address ?? '', lat: activity.lat, lon: activity.lon } : null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<number>();

  // Recherche de lieux réels, avec un délai pour économiser les appels.
  useEffect(() => {
    window.clearTimeout(timer.current);
    if (q.trim().length < 3) { setResults([]); return; }
    timer.current = window.setTimeout(async () => {
      setSearching(true);
      const { data, error } = await supabase.functions.invoke('places-search', { body: { query: q } });
      setSearching(false);
      if (error) {
        let m: string | null = null;
        try { m = (await (error as { context?: Response }).context?.json())?.error ?? null; } catch { /* corps illisible */ }
        setErr(m ?? 'Recherche indisponible pour le moment.'); return;
      }
      setErr(data?.error ?? null);
      setResults(data?.places ?? []);
    }, 600);
    return () => window.clearTimeout(timer.current);
  }, [q]);

  const pick = (p: Place) => { setTitle(p.name); setPlace(p); setQ(''); setResults([]); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setErr('Donne un nom à l’activité.'); return; }
    const row = {
      title: title.trim(), day: d || null, time: time || null, notes: notes.trim() || null,
      place_id: place?.id ?? null, address: place?.address ?? null, lat: place?.lat ?? null, lon: place?.lon ?? null,
      updated_at: new Date().toISOString()
    };
    const { error } = activity
      ? await supabase.from('activities').update(row).eq('id', activity.id)
      : await supabase.from('activities').insert({ ...row, trip_id: tripId });
    if (error) setErr(error.message); else onClose();
  };
  const remove = async () => {
    if (!activity) return;
    const { error } = await supabase.from('activities').delete().eq('id', activity.id);
    if (error) setErr(error.message); else onClose();
  };

  return (
    <>
      <div className="sheet-back" onClick={onClose} />
      <form className="sheet" onSubmit={save} aria-label={activity ? 'Modifier l’activité' : 'Ajouter une activité'}>
        <h2>{activity ? 'Modifier' : 'Ajouter une activité'}</h2>

        <div className="field"><label htmlFor="aq">Rechercher un lieu</label>
          <input id="aq" className="input" type="search" placeholder="Ramen Shibuya, Fushimi Inari, onsen…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {searching && <p className="mono" style={{ margin: 0 }}>Recherche…</p>}
        {results.map((p) => (
          <button type="button" key={p.id} className="result" onClick={() => pick(p)}>
            <span className="dot" style={{ background: p.status === 'OPERATIONAL' ? 'var(--ok)' : 'var(--alert)' }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: 'block', fontSize: 15 }}>{p.name}</b>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{p.type ? p.type + ' · ' : ''}{p.status && p.status !== 'OPERATIONAL' ? 'Fermé · ' : ''}{p.address}</span>
            </span>
          </button>
        ))}

        <div className="field"><label htmlFor="at">Activité</label>
          <input id="at" className="input" placeholder="ou écris-la toi-même" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        {place?.address && <p className="mono" style={{ margin: 0, textTransform: 'none' }}>Adresse · {place.address}</p>}
        <div className="row">
          <div className="field" style={{ flex: 2 }}><label htmlFor="ad">Jour</label>
            <select id="ad" className="input" value={d} onChange={(e) => setD(e.target.value)}>
              <option value="">À placer plus tard</option>
              {days.map((x, i) => <option key={x} value={x}>J{i + 1} · {dayLabel(x)}</option>)}
            </select></div>
          <div className="field" style={{ flex: 1 }}><label htmlFor="ah">Heure</label>
            <input id="ah" className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
        </div>
        <div className="field"><label htmlFor="an">Notes</label>
          <input id="an" className="input" placeholder="Conseil, réservation, prix…" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn">{activity ? 'Enregistrer' : 'Ajouter'}</button>
        {activity && (
          <div className="row">
            <a className="btn ghost sm" href={mapsLink(activity)} target="_blank" rel="noopener">Y aller (Maps)</a>
            <button type="button" className="btn danger sm" onClick={remove}>Supprimer</button>
          </div>
        )}
      </form>
    </>
  );
}
