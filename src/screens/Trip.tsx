import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, type Activity, type Idea, type Swipe, type Trip as TripT } from '../lib/supabase';
import { byTime, mapsLink, tripDays } from '../lib/logic';
import ActivitySheet from './ActivitySheet';
import TripForm from './TripForm';
import Photos from './Photos';

const CATS = ['Restaurant', 'Street food', 'Randonnée', 'Balade', 'Sortie', 'Bar', 'Shopping', 'Culture', 'Onsen', 'Nature', 'Atelier'];
import type { Ctx } from '../App';

const short = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '').toUpperCase();
const num = (d: string) => new Date(d + 'T12:00:00').getDate();
const long = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

export default function Trip({ ctx, trip: initial, onBack }: { ctx: Ctx; trip: TripT; onBack: () => void }) {
  const { me, partner, island } = ctx;
  const [trip, setTrip] = useState(initial);
  const [tab, setTab] = useState<'plan' | 'ideas' | 'photos'>('plan');
  const [cats, setCats] = useState<string[]>([]);
  const [city, setCity] = useState('');
  const [ideaDay, setIdeaDay] = useState('');
  const days = useMemo(() => tripDays(trip.start_date, trip.end_date), [trip.start_date, trip.end_date]);
  const [day, setDay] = useState<string | null>(() => {
    const today = new Date().toISOString().slice(0, 10);
    return days.includes(today) ? today : days[0] ?? null;
  });
  const [acts, setActs] = useState<Activity[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [swipes, setSwipes] = useState<Swipe[]>([]);
  const [sheet, setSheet] = useState<Activity | 'new' | null>(null);
  const [editTrip, setEditTrip] = useState(false);
  const [gen, setGen] = useState<string | null>(null);
  const [match, setMatch] = useState<Idea | null>(null);

  const load = useCallback(async () => {
    const [t, a, i] = await Promise.all([
      supabase.from('trips').select('*').eq('id', trip.id).single(),
      supabase.from('activities').select('*').eq('trip_id', trip.id),
      supabase.from('ideas').select('*').eq('trip_id', trip.id).order('created_at')
    ]);
    if (t.data) setTrip(t.data as TripT);
    setActs((a.data ?? []) as Activity[]);
    const list = (i.data ?? []) as Idea[];
    setIdeas(list);
    if (list.length) {
      const { data } = await supabase.from('swipes').select('idea_id,user_id,vote').in('idea_id', list.map((x) => x.id));
      setSwipes((data ?? []) as Swipe[]);
    }
  }, [trip.id]);

  useEffect(() => {
    load();
    const f = `trip_id=eq.${trip.id}`;
    const ch = supabase.channel('trip-' + trip.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities', filter: f }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ideas', filter: f }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'swipes' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${trip.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [trip.id, load]);

  useEffect(() => { if (day && !days.includes(day)) setDay(days[0] ?? null); }, [days, day]);

  const unplaced = acts.filter((a) => !a.day);
  const shown = byTime(day === null ? unplaced : acts.filter((a) => a.day === day));
  const voted = new Set(swipes.filter((s) => s.user_id === me.id).map((s) => s.idea_id));
  const queue = ideas.filter((i) => !i.matched && !voted.has(i.id));
  const current = queue[0];
  const pName = partner?.name?.split(' ')[0] ?? 'ton binôme';
  const myYes = ideas.filter((i) => !i.matched && swipes.some((s) => s.idea_id === i.id && s.user_id === me.id && s.vote === 'yes'));
  const partnerVote = (id: string) => swipes.find((s) => s.idea_id === id && s.user_id === partner?.id)?.vote;
  const busyGen = useRef(false);
  const [adding, setAdding] = useState<string | null>(null);
  // Ajout direct au programme, sans attendre le oui de l'autre (le match automatique reste actif).
  const addNow = async (i: Idea) => {
    setAdding(i.id);
    await supabase.from('ideas').update({ matched: true }).eq('id', i.id);
    await supabase.from('activities').insert({ trip_id: trip.id, day: i.day, title: i.title, notes: i.why, tag: i.tag, created_by: me.id });
    setAdding(null);
    load();
  };
  const dayLabel = (d: string | null) => d ? new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' }) : 'À placer';
  const partnerYes = (id: string) => swipes.some((s) => s.idea_id === id && s.user_id === partner?.id && s.vote === 'yes');

  const vote = async (v: 'yes' | 'no') => {
    if (!current) return;
    const willMatch = v === 'yes' && partnerYes(current.id);
    await supabase.from('swipes').upsert({ idea_id: current.id, user_id: me.id, vote: v });
    if (willMatch) setMatch(current);
    load();
  };
  const generate = async () => {
    if (busyGen.current) return; // un seul appel payant à la fois, même en tapant deux fois
    busyGen.current = true;
    setGen('Recherche d’idées…');
    const { data, error } = await supabase.functions.invoke('ideas', { body: { trip_id: trip.id, city: city.trim() || null, day: ideaDay || null, categories: cats } });
    let msg: string | null = data?.error ?? null;
    if (error) {
      // Le serveur renvoie un message précis : on l'affiche au lieu d'un message générique.
      try { msg = (await (error as { context?: Response }).context?.json())?.error ?? null; } catch { /* corps illisible */ }
      msg = msg ?? 'IA indisponible pour le moment, réessaie dans un instant.';
    }
    setGen(msg);
    busyGen.current = false;
    load();
  };
  const toggleDone = async (a: Activity) => { await supabase.from('activities').update({ done: !a.done }).eq('id', a.id); };

  return (
    <main className="screen" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 96px)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <button className="btn ghost sm" style={{ width: 44, padding: 0 }} onClick={onBack} aria-label="Retour aux voyages">‹</button>
        <button className="btn ghost sm" style={{ width: 'auto', padding: '0 14px' }} onClick={() => setEditTrip(true)}>Modifier</button>
      </header>
      <p className="mono" style={{ margin: '16px 0 0' }}>{trip.start_date && trip.end_date ? `${long(trip.start_date)} → ${long(trip.end_date)} · ${days.length} jours` : 'Dates à définir'}</p>
      <h1 className="h1" style={{ margin: '4px 0 0', fontSize: 38, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="dot" style={{ width: 12, height: 12, background: trip.color }} />{trip.title}
      </h1>

      <div className="tabs" role="group" aria-label="Vue" style={{ marginTop: 16 }}>
        <button aria-pressed={tab === 'plan'} onClick={() => setTab('plan')}>Programme</button>
        <button aria-pressed={tab === 'ideas'} onClick={() => setTab('ideas')}>Idées{queue.length ? ` (${queue.length})` : ''}</button>
        <button aria-pressed={tab === 'photos'} onClick={() => setTab('photos')}>Souvenirs</button>
      </div>

      {tab === 'plan' && (
        <>
          <div className="days" role="group" aria-label="Jours" style={{ marginTop: 12 }}>
            {days.map((d, i) => (
              <button key={d} className="day" aria-pressed={day === d} onClick={() => setDay(d)} aria-label={`Jour ${i + 1}, ${long(d)}`}>
                <small>{short(d)}</small><b>{num(d)}</b>
              </button>
            ))}
            <button className="day" aria-pressed={day === null} onClick={() => setDay(null)} style={{ minWidth: 72 }}>
              <small>À PLACER</small><b>{unplaced.length}</b>
            </button>
          </div>
          <p className="mono" style={{ margin: '12px 0 8px' }}>{day ? `Jour ${days.indexOf(day) + 1} · ${long(day)}` : 'Idées gardées, à placer dans un jour'}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {shown.map((a) => (
              <div key={a.id} style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                <button className="act" onClick={() => setSheet(a)} style={{ opacity: a.done ? 0.55 : 1 }}>
                  <span className="t">{a.time ?? '—'}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ textDecoration: a.done ? 'line-through' : 'none' }}>{a.title}</b>
                    {(a.notes || a.address) && <span className="m">{a.notes ?? a.address}</span>}
                    {a.created_by && a.created_by !== me.id && <span className="m" style={{ color: 'var(--partner)' }}>Ajouté par {partner?.name?.split(' ')[0] ?? 'ton binôme'}</span>}
                  </span>
                  {a.tag && <span className="tag">{a.tag}</span>}
                </button>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button className="btn ghost sm" style={{ width: 44, padding: 0, flex: 1 }} aria-label={a.done ? 'Marquer à faire' : 'Marquer fait'} onClick={() => toggleDone(a)}>{a.done ? '↺' : '✓'}</button>
                  <a className="btn sm" style={{ width: 44, padding: 0, flex: 1 }} href={mapsLink(a)} target="_blank" rel="noopener" aria-label="Y aller avec Google Maps">↗</a>
                </div>
              </div>
            ))}
            {shown.length === 0 && <p className="sub" style={{ textAlign: 'center', margin: '16px 0' }}>Rien de prévu ici pour l’instant.</p>}
          </div>
        </>
      )}

      {tab === 'photos' && <Photos tripId={trip.id} />}

      {tab === 'ideas' && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {current ? (
            <>
              <article className="idea">
                <div className="top">
                  <span style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '.08em' }}>
                    <span>{current.tag ?? 'IDÉE'}</span><span>{(current.city ?? '').toUpperCase()}</span>
                  </span>
                  <p>{current.title.split(' ').slice(0, 3).join(' ')}</p>
                </div>
                <div className="body">
                  <h2 style={{ margin: 0, fontSize: 22, letterSpacing: '-.02em' }}>{current.title}</h2>
                  <span className="mono">{[current.duration, current.price, current.day ? 'prévu le ' + new Date(current.day + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' }) : null].filter(Boolean).join(' · ')}</span>
                  {current.why && <p className="sub" style={{ margin: 0 }}>{current.why}</p>}
                  {partnerYes(current.id) && <p style={{ margin: 0, color: 'var(--partner)', fontWeight: 600, fontSize: 14 }}>{partner?.name?.split(' ')[0] ?? 'Ton binôme'} a déjà dit oui</p>}
                </div>
              </article>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24 }}>
                <button className="round" onClick={() => vote('no')} aria-label="Pas pour nous">✕</button>
                <button className="round yes" onClick={() => vote('yes')} aria-label="On veut le faire" style={{ fontSize: 28 }}>♥</button>
              </div>
            </>
          ) : (
            <p className="sub" style={{ textAlign: 'center' }}>{ideas.length ? `Tu as tout swipé. Quand ${pName} dit oui aussi, l’idée arrive toute seule dans son jour — ou touche « Ajouter » ci-dessous.` : 'Pas encore d’idées pour ce voyage.'}</p>
          )}
          {myYes.length > 0 && (
            <section aria-label="Tes coups de cœur" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p className="mono" style={{ margin: '4px 0 0' }}>Tes coups de cœur · {myYes.length}</p>
              {myYes.map((i) => {
                const pv = partnerVote(i.id);
                return (
                  <div key={i.id} className="liked">
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b>{i.title}</b>
                      <span className="m" style={{ color: pv === 'no' ? 'var(--alert)' : pv === 'yes' ? 'var(--ok-text)' : 'var(--partner)' }}>
                        {pv === 'no' ? `${pName} a dit non` : pv === 'yes' ? `${pName} a dit oui` : `En attente de ${pName}`} · {dayLabel(i.day)}
                      </span>
                    </span>
                    <button className="btn sm" style={{ width: 'auto', padding: '0 12px', flex: 'none' }} disabled={adding === i.id} onClick={() => addNow(i)}>
                      {adding === i.id ? '…' : 'Ajouter'}
                    </button>
                  </div>
                );
              })}
            </section>
          )}
          <section className="card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12, padding: 16 }} aria-label="Filtres des idées">
            <p className="mono" style={{ margin: 0 }}>Quel type ? (rien = un mélange de tout)</p>
            <div className="chips">
              {CATS.map((c) => (
                <button key={c} className="chip" aria-pressed={cats.includes(c)} style={{ minHeight: 38, fontSize: 14, padding: '0 12px' }}
                  onClick={() => setCats((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]))}>{c}</button>
              ))}
            </div>
            <div className="row">
              <div className="field" style={{ flex: 1 }}><label htmlFor="icity">Ville ou quartier</label>
                <input id="icity" className="input" list="icities" placeholder="Partout" value={city} onChange={(e) => setCity(e.target.value)} />
                <datalist id="icities">{[...new Set(ideas.map((i) => i.city).filter(Boolean))].map((c) => <option key={c!} value={c!} />)}</datalist></div>
              <div className="field" style={{ flex: 1 }}><label htmlFor="iday">Pour quel jour</label>
                <select id="iday" className="input" value={ideaDay} onChange={(e) => setIdeaDay(e.target.value)}>
                  <option value="">N’importe quand</option>
                  {days.map((d, i) => <option key={d} value={d}>J{i + 1} · {new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</option>)}
                </select></div>
            </div>
          </section>
          <button className="btn" onClick={generate} disabled={!!gen && gen.startsWith('Recherche')}>{gen?.startsWith('Recherche') ? gen : 'Proposer 8 idées avec ces filtres'}</button>
          <p className="mono" style={{ margin: 0, textAlign: 'center', textTransform: 'none' }}>1 appui = 1 seule recherche (8 idées) · moins d’1 centime{queue.length ? ` · encore ${queue.length} à swiper` : ''}</p>
          {gen && !gen.startsWith('Recherche') && <p className="err" role="alert">{gen}</p>}
        </div>
      )}

      {tab === 'plan' && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '12px 20px calc(env(safe-area-inset-bottom) + 16px)', background: 'linear-gradient(transparent, var(--bg) 30%)', maxWidth: 480, margin: '0 auto' }}>
          <button className="btn" onClick={() => setSheet('new')}>+ Ajouter une activité</button>
        </div>
      )}

      {sheet && <ActivitySheet tripId={trip.id} days={days} day={day} activity={sheet === 'new' ? null : sheet} onClose={() => setSheet(null)} />}
      {editTrip && <TripForm islandId={island.id} trip={trip} onClose={() => setEditTrip(false)} onDeleted={onBack} />}
      {match && (
        <div role="dialog" aria-label="C'est un match" style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'var(--ink)', color: '#fff', padding: '120px 28px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p className="mono" style={{ color: 'var(--accent)' }}>Vous avez dit oui tous les deux</p>
          <h2 style={{ margin: 0, fontSize: 52, lineHeight: .95, letterSpacing: '-.04em' }}>C’est un match.</h2>
          <p style={{ color: '#D6D4CD', fontSize: 17 }}>{match.title} est ajouté {match.day ? 'au ' + dayLabel(match.day) : 'dans « À placer »'}.</p>
          <button className="btn" style={{ marginTop: 'auto', background: '#fff', color: 'var(--ink)' }} onClick={() => { setMatch(null); setTab('plan'); setDay(match.day ?? null); }}>Voir dans le programme</button>
          <button className="btn ghost" style={{ background: 'transparent', color: '#fff', borderColor: '#4A4945' }} onClick={() => setMatch(null)}>Continuer à swiper</button>
        </div>
      )}
    </main>
  );
}
