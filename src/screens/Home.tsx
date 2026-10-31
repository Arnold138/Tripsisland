import { useCallback, useEffect, useState } from 'react';
import { supabase, type Trip } from '../lib/supabase';
import { daysUntil } from '../lib/logic';
import type { Ctx } from '../App';

const fmt = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export default function Home({ ctx, onTastes }: { ctx: Ctx; onTastes: () => void }) {
  const { island, me, partner } = ctx;
  const [trips, setTrips] = useState<Trip[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from('trips').select('*').eq('island_id', island.id).order('start_date');
    setTrips((data ?? []) as Trip[]);
  }, [island.id]);

  useEffect(() => {
    load();
    const ch = supabase.channel('trips-' + island.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `island_id=eq.${island.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [island.id, load]);

  const addJapan = async () => {
    await supabase.from('trips').insert({
      island_id: island.id, title: 'Japon', country: 'JP', start_date: '2027-02-17', end_date: '2027-03-11',
      status: 'upcoming', color: '#FF4A1C', lat: 36, lon: 138
    });
  };

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

      <p className="mono" style={{ marginTop: 24 }}>Le globe arrive au lot 2</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {trips.map((t) => (
          <div key={t.id} className="trip">
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="mono" style={{ color: '#B9B8B2' }}>{fmt(t.start_date)} → {fmt(t.end_date)}</span>
              <b>{t.title}</b>
            </span>
            {t.start_date && t.status === 'upcoming' && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                <span className="dot" style={{ background: t.color }} />Dans {daysUntil(t.start_date)} j
              </span>
            )}
          </div>
        ))}
        {trips.length === 0 && <button className="btn" onClick={addJapan}>Créer le voyage Japon · 17 fév → 11 mars</button>}
      </div>

      <div className="spacer" style={{ paddingTop: 20 }}>
        <button className="btn ghost" onClick={onTastes}>Nos goûts</button>
      </div>
    </main>
  );
}
