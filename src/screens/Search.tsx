import { useEffect, useRef, useState } from 'react';
import { supabase, type Place, type Trip } from '../lib/supabase';
import { tripDays } from '../lib/logic';
import { shortAddr } from './tabs/DaysTab';
import Icon from './Icon';
import { CrowdBadge, CrowdSheet, fetchCrowd, type CrowdInfo } from './Crowd';

type Props = { islandId: string; tripId?: string | null; onClose: () => void; onShow: (tripId: string, day: string | null) => void };

/** Nettoie un texte collé (TikTok, Instagram…) : liens, hashtags, emojis, mentions. */
export function cleanQuery(raw: string): string {
  return raw
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[#@]/g, ' ')
    .replace(/\p{Extended_Pictographic}|️/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

const EXAMPLES = ['Forêt de bambous d’Arashiyama', 'Ramen Ichiran Shibuya', 'Onsen avec vue sur le Fuji', 'Café chats Tokyo'];

/** Le petit avion qui traverse l'écran pendant la recherche. */
function Plane() {
  return (
    <div className="plane-loader" role="status" aria-label="Recherche en cours">
      <svg viewBox="0 0 320 120" width="100%" aria-hidden="true">
        <path id="flight" d="M10 100 C 90 10, 230 10, 310 70" fill="none" stroke="#CFCDC6" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
        <circle cx="10" cy="100" r="5" fill="var(--ink)" />
        <circle cx="310" cy="70" r="5" fill="var(--accent)"><animate attributeName="r" values="4;7;4" dur="1.2s" repeatCount="indefinite" /></circle>
        <g>
          <path d="M-9 0 L9 0 M2 0 L-3 -8 M2 0 L-3 8 M-7 0 L-9 -4 M-7 0 L-9 4" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" fill="none" />
          <animateMotion dur="2.2s" repeatCount="indefinite" rotate="auto" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.4 0 0.2 1">
            <mpath href="#flight" />
          </animateMotion>
        </g>
      </svg>
      <p>On cherche dans le monde entier…</p>
    </div>
  );
}

export default function Search({ islandId, tripId, onClose, onShow }: Props) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [results, setResults] = useState<Place[] | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [pick, setPick] = useState<Place | null>(null);
  const [tId, setTId] = useState<string>(tripId ?? '');
  const [day, setDay] = useState('');
  const [added, setAdded] = useState<{ text: string; tripId: string; day: string | null } | null>(null);
  const [crowd, setCrowd] = useState<Record<string, CrowdInfo>>({});
  const [crowdBusy, setCrowdBusy] = useState<string | null>(null);
  const [crowdOpen, setCrowdOpen] = useState<Place | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const last = useRef('');

  useEffect(() => {
    input.current?.focus();
    supabase.from('trips').select('*').eq('island_id', islandId).order('start_date').then(({ data }) => {
      const list = (data ?? []) as Trip[];
      setTrips(list);
      setTId((x) => x || list.find((t) => t.status === 'upcoming')?.id || list[0]?.id || '');
    });
  }, [islandId]);

  const search = async (text = q) => {
    const query = cleanQuery(text);
    if (query.length < 2 || busy || query === last.current) return; // pas de recherche payante en double
    last.current = query;
    setQ(query); setBusy(true); setErr(null); setResults(null); setPick(null); setAdded(null);
    const started = Date.now();
    const { data, error } = await supabase.functions.invoke('places-search', { body: { query } });
    await new Promise((r) => setTimeout(r, Math.max(0, 1100 - (Date.now() - started)))); // laisse l'avion décoller
    setBusy(false);
    if (error || data?.error) { setErr(data?.error ?? 'Recherche indisponible, réessaie.'); last.current = ''; return; }
    setResults((data?.places ?? []) as Place[]);
  };
  const paste = async () => {
    try { const t = await navigator.clipboard.readText(); if (t) { setQ(cleanQuery(t)); search(t); } }
    catch { input.current?.focus(); }
  };

  const trip = trips.find((t) => t.id === tId);
  const days = trip ? tripDays(trip.start_date, trip.end_date) : [];
  const add = async () => {
    if (!pick || !trip) return;
    const known = crowd[pick.id] ?? null;
    const { data: row, error } = await supabase.from('activities').insert({
      trip_id: trip.id, day: day || null, title: pick.name, address: pick.address, place_id: pick.id,
      lat: pick.lat, lon: pick.lon, geo_tried: true, query: pick.name, crowd: known, crowd_at: known ? new Date().toISOString() : null
    }).select('id').single();
    if (error) { setErr(error.message); return; }
    const p = pick;
    setAdded({ text: `${p.name} ajouté à ${trip.title} · ${day ? new Date(day + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' }) : 'à placer'}`, tripId: trip.id, day: day || null });
    setPick(null);
    // L'affluence est estimée tout de suite pour ce jour-là (1 petit appel IA), si pas déjà fait.
    if (!known && row?.id) fetchCrowd({ name: p.name, address: p.address, date: day || null, activityId: row.id });
  };

  return (
    <div className="search-screen" role="dialog" aria-label="Rechercher un lieu">
      <header className="row" style={{ alignItems: 'center' }}>
        <h2 style={{ margin: 0, flex: 1, fontSize: 28, letterSpacing: '-.035em' }}>Rechercher</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Fermer la recherche"><span aria-hidden="true" style={{ fontSize: 20 }}>✕</span></button>
      </header>

      <form className="ask" onSubmit={(e) => { e.preventDefault(); search(); }}>
        <textarea ref={input} rows={2} value={q} onChange={(e) => setQ(e.target.value)} maxLength={300}
          placeholder="Colle un nom vu sur TikTok, ou décris le lieu : « la forêt de bambous à Kyoto »"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); search(); } }} aria-label="Que cherchez-vous ?" />
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="pill" onClick={paste}>Coller</button>
          <button className="pill dark" disabled={busy || cleanQuery(q).length < 2}><Icon name="send" size={18} /> Chercher</button>
        </div>
      </form>

      {!busy && !results && !err && (
        <div className="chips" style={{ marginTop: 4 }}>
          {EXAMPLES.map((x) => <button key={x} className="chip sm" onClick={() => { setQ(x); search(x); }}>{x}</button>)}
        </div>
      )}
      {busy && <Plane />}
      {err && <p className="err" role="alert">{err}</p>}
      {added && (
        <div className="added" role="status">
          <Icon name="check" size={18} /><span style={{ flex: 1 }}>{added.text}</span>
          <button onClick={() => onShow(added.tripId, added.day)}>Voir dans Jours ›</button>
        </div>
      )}

      {results && results.length === 0 && <div className="empty"><p>Rien trouvé. Ajoute la ville, par exemple « … Kyoto ».</p></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {results?.map((p) => (
          <article key={p.id} className={'place' + (pick?.id === p.id ? ' on' : '')}>
            <button className="place-main" onClick={() => setPick(pick?.id === p.id ? null : p)}>
              <span className="dot" style={{ background: p.status && p.status !== 'OPERATIONAL' ? 'var(--alert)' : 'var(--ok)' }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <b>{p.name}</b>
                <small>{p.type ? p.type + ' · ' : ''}{p.status && p.status !== 'OPERATIONAL' ? 'Fermé · ' : ''}{shortAddr(p.address)}</small>
              </span>
              <span className="pill sm-pill">{pick?.id === p.id ? 'Fermer' : 'Ajouter'}</span>
            </button>
            {pick?.id === p.id && (
              <div className="place-add">
                <div className="row" style={{ alignItems: 'center' }}>
                  <CrowdBadge crowd={crowd[p.id]} busy={crowdBusy === p.id} onClick={async () => {
                    if (crowd[p.id]) { setCrowdOpen(p); return; }
                    setCrowdBusy(p.id);
                    const r = await fetchCrowd({ name: p.name, address: p.address, date: day || null });
                    setCrowdBusy(null);
                    if (r.crowd) { setCrowd((c) => ({ ...c, [p.id]: r.crowd! })); setCrowdOpen(p); } else setErr(r.error ?? null);
                  }} />
                  {trips.length > 1 && (
                    <select aria-label="Voyage" className="input" style={{ minHeight: 40, flex: 1, minWidth: 0 }} value={tId} onChange={(e) => { setTId(e.target.value); setDay(''); }}>
                      {trips.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </select>
                  )}
                </div>
                <p className="mono" style={{ margin: 0 }}>Quel jour ?</p>
                <div className="day-picker" role="group" aria-label="Jour">
                  <button className="tbd" aria-pressed={day === ''} onClick={() => setDay('')}><small>PAS SÛR</small>À définir</button>
                  {days.map((x) => (
                    <button key={x} aria-pressed={day === x} onClick={() => setDay(x)}>
                      <small>{new Date(x + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '').toUpperCase()}</small>{new Date(x + 'T12:00:00').getDate()}
                    </button>
                  ))}
                </div>
                <div className="row">
                  <a className="pill" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}&query_place_id=${p.id}`} target="_blank" rel="noopener"><Icon name="pin" size={18} /> Voir</a>
                  <button className="pill dark" onClick={add} disabled={!trip}><Icon name="plus" size={18} /> {day ? 'Ajouter ce jour-là' : 'Ajouter (à définir)'}</button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
      {crowdOpen && crowd[crowdOpen.id] && <CrowdSheet title={crowdOpen.name} crowd={crowd[crowdOpen.id]} onClose={() => setCrowdOpen(null)} />}
      <p className="mono" style={{ textAlign: 'center', textTransform: 'none', margin: '8px 0 0' }}>1 recherche = 1 appel Google (gratuit dans le quota mensuel)</p>
    </div>
  );
}
