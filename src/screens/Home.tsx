import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { supabase, type Trip } from '../lib/supabase';
import { daysUntil } from '../lib/logic';
import TripForm from './TripForm';
import type { Ctx } from '../App';

const Globe = lazy(() => import('./Globe'));

const fmt = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export default function Home({ ctx, onTastes, onOpen }: { ctx: Ctx; onTastes: () => void; onOpen: (t: Trip) => void }) {
  const { island, me, partner } = ctx;
  const [trips, setTrips] = useState<Trip[]>([]);
  const [adding, setAdding] = useState<null | 'new' | 'past'>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [photoPts, setPhotoPts] = useState<{ lat: number; lon: number }[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from('trips').select('*').eq('island_id', island.id).order('start_date');
    const list = (data ?? []) as Trip[];
    setTrips(list);
    if (list.length) {
      const { data: ph } = await supabase.from('photos').select('lat,lon').in('trip_id', list.map((t) => t.id)).not('lat', 'is', null).limit(500);
      setPhotoPts((ph ?? []) as { lat: number; lon: number }[]);
    }
    setFocus((f) => f ?? list.find((t) => t.status === 'upcoming')?.id ?? list[0]?.id ?? null);
  }, [island.id]);

  useEffect(() => {
    load();
    const ch = supabase.channel('trips-' + island.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `island_id=eq.${island.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [island.id, load]);

  const upcoming = trips.filter((t) => t.status === 'upcoming');
  const past = trips.filter((t) => t.status === 'past');

  const card = (t: Trip) => (
    <button key={t.id} className="trip" onClick={() => onOpen(t)} style={{ border: 0, width: '100%', textAlign: 'left', background: t.status === 'past' ? 'var(--surface)' : 'var(--ink)', color: t.status === 'past' ? 'var(--ink)' : '#fff' }}>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="mono" style={{ color: t.status === 'past' ? 'var(--muted)' : '#B9B8B2' }}>{fmt(t.start_date)}{t.end_date ? ' → ' + fmt(t.end_date) : ''}</span>
        <b>{t.title}</b>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
        <span className="dot" style={{ background: t.color }} />
        {t.status === 'upcoming' && t.start_date ? (daysUntil(t.start_date) > 0 ? `Dans ${daysUntil(t.start_date)} j` : 'En cours') : 'Souvenir'}
        <span aria-hidden="true">›</span>
      </span>
    </button>
  );

  return (
    <main className="screen">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <p className="brand" style={{ fontSize: 14 }}><i aria-hidden="true" />TripIsland</p>
          <h1 className="h1" style={{ marginTop: 8, fontSize: 34 }}>Vos voyages</h1>
        </div>
        <div role="img" aria-label="Vous deux" style={{ display: 'flex' }}>
          <span className="avatar" style={{ width: 36, height: 36, fontSize: 14, boxShadow: '0 0 0 2px var(--bg)' }}>{(me.name ?? 'A')[0]}</span>
          <span className="avatar" style={{ width: 36, height: 36, fontSize: 14, marginLeft: -10, background: 'var(--partner)', boxShadow: '0 0 0 2px var(--bg)' }}>{(partner?.name ?? 'E')[0]}</span>
        </div>
      </header>

      <div style={{ marginTop: 8 }}>
        <Suspense fallback={<div className="globe" />}>
          <Globe pins={trips.filter((t) => t.lat != null && t.lon != null).map((t) => ({ id: t.id, name: t.title, lat: t.lat!, lon: t.lon!, color: t.color }))} photos={photoPts} focus={focus}
            onPick={(id) => { const t = trips.find((x) => x.id === id); if (t) onOpen(t); }} />
        </Suspense>
      </div>
      <div className="days" role="group" aria-label="Voir sur le globe" style={{ marginTop: 4 }}>
        {trips.map((t) => (
          <button key={t.id} className="chip" aria-pressed={focus === t.id} style={{ flex: 'none', ['--c' as string]: 'var(--ink)' }} onClick={() => setFocus(t.id)}>
            <span className="dot" style={{ background: t.color }} />{t.title}
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        {[['Pays', new Set(trips.map((t) => t.title)).size], ['Jours', trips.reduce((n, t) => n + (t.start_date && t.end_date ? Math.round((+new Date(t.end_date) - +new Date(t.start_date)) / 864e5) + 1 : 0), 0)], ['Photos', photoPts.length]].map(([k, v]) => (
          <div key={k} className="card" style={{ flex: 1, flexDirection: 'column', alignItems: 'center', gap: 0, padding: '10px 6px' }}>
            <b style={{ fontSize: 22, letterSpacing: '-.03em' }}>{v}</b><span className="mono" style={{ fontSize: 10 }}>{k}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
        {upcoming.length > 0 && <p className="mono" style={{ margin: 0 }}>À venir</p>}
        {upcoming.map(card)}
        {past.length > 0 && <p className="mono" style={{ margin: '12px 0 0' }}>Souvenirs</p>}
        {past.map(card)}
        <div className="row">
          <button className="btn ghost" style={{ borderStyle: 'dashed' }} onClick={() => setAdding('new')}>+ Nouveau voyage</button>
          <button className="btn ghost" style={{ borderStyle: 'dashed' }} onClick={() => setAdding('past')}>+ Ancien voyage</button>
        </div>
      </div>

      <div className="spacer" style={{ paddingTop: 20 }}>
        <button className="btn ghost sm" onClick={onTastes}>Nos goûts</button>
        <p className="mono" style={{ textAlign: 'center', margin: '12px 0 0' }}>Version {__APP_VERSION__}</p>
      </div>
      {adding && <TripForm islandId={island.id} past={adding === 'past'} onClose={() => setAdding(null)} onCreated={(t) => { if (t.status === 'past') onOpen(t); }} />}
    </main>
  );
}
