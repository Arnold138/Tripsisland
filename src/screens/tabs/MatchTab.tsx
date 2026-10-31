import { useRef, useState } from 'react';
import { supabase, type Idea } from '../../lib/supabase';
import Icon from '../Icon';
import type { TripData } from '../Trip';

const CATS = ['Restaurant', 'Street food', 'Randonnée', 'Balade', 'Sortie', 'Bar', 'Shopping', 'Culture', 'Onsen', 'Nature', 'Atelier'];
const dayLabel = (d: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' }) : 'à placer');

export default function MatchTab({ d }: { d: TripData }) {
  const { trip, days, ideas, swipes, ctx, partnerName } = d;
  const me = ctx.me, partner = ctx.partner;
  const [cats, setCats] = useState<string[]>([]);
  const [city, setCity] = useState('');
  const [ideaDay, setIdeaDay] = useState('');
  const [gen, setGen] = useState<string | null>(null);
  const [match, setMatch] = useState<Idea | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const busyGen = useRef(false);

  const voted = new Set(swipes.filter((s) => s.user_id === me.id).map((s) => s.idea_id));
  const queue = ideas.filter((i) => !i.matched && !voted.has(i.id));
  const current = queue[0];
  const partnerVote = (id: string) => swipes.find((s) => s.idea_id === id && s.user_id === partner?.id)?.vote;
  const myYes = ideas.filter((i) => !i.matched && swipes.some((s) => s.idea_id === i.id && s.user_id === me.id && s.vote === 'yes'));
  const matched = ideas.filter((i) => i.matched);

  const vote = async (v: 'yes' | 'no') => {
    if (!current) return;
    const willMatch = v === 'yes' && partnerVote(current.id) === 'yes';
    await supabase.from('swipes').upsert({ idea_id: current.id, user_id: me.id, vote: v });
    if (willMatch) setMatch(current);
    d.reload();
  };
  // Ajout direct au programme, sans attendre le oui de l'autre.
  const addNow = async (i: Idea) => {
    setAdding(i.id);
    await supabase.from('ideas').update({ matched: true }).eq('id', i.id);
    await supabase.from('activities').insert({
      trip_id: trip.id, day: i.day, title: i.title, notes: i.why, tag: i.tag, created_by: me.id,
      station: i.station, query: (i.query ?? i.title) + (i.city ? ' ' + i.city : '')
    });
    setAdding(null);
    d.reload();
  };
  const generate = async () => {
    if (busyGen.current) return; // un seul appel payant à la fois
    busyGen.current = true;
    setGen('Recherche d’idées…');
    const { data, error } = await supabase.functions.invoke('ideas', { body: { trip_id: trip.id, city: city.trim() || null, day: ideaDay || null, categories: cats } });
    let msg: string | null = data?.error ?? null;
    if (error) {
      try { msg = (await (error as { context?: Response }).context?.json())?.error ?? null; } catch { /* corps illisible */ }
      msg = msg ?? 'IA indisponible pour le moment, réessaie dans un instant.';
    }
    setGen(msg);
    busyGen.current = false;
    setShowFilters(false);
    d.reload();
  };

  return (
    <section className="tab-body" aria-label="Match des idées">
      {current ? (
        <>
          <article className="idea">
            <div className="top">
              <span className="where-pill"><Icon name="pin" size={16} />{current.city ?? 'Lieu à préciser'}</span>
              <p>{current.title}</p>
              <span className="mono" style={{ color: 'var(--ink)' }}>{current.tag ?? 'IDÉE'}</span>
            </div>
            <div className="body">
              <span className="facts">
                {current.duration && <span>{current.duration}</span>}
                {current.price && <span>{current.price}</span>}
                <span>{current.day ? 'Prévu ' + dayLabel(current.day) : 'Jour libre'}</span>
              </span>
              {current.station && <span className="where"><Icon name="metro" size={16} />Départ conseillé : <b>{current.station}</b></span>}
              {current.why && <p className="sub" style={{ margin: 0 }}>{current.why}</p>}
              {partnerVote(current.id) === 'yes' && <p style={{ margin: 0, color: 'var(--partner)', fontWeight: 600, fontSize: 14 }}>{partnerName} a déjà dit oui</p>}
            </div>
          </article>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24 }}>
            <button className="round" onClick={() => vote('no')} aria-label="Pas pour nous"><span aria-hidden="true" style={{ fontSize: 22 }}>✕</span></button>
            <button className="round yes" onClick={() => vote('yes')} aria-label="On veut le faire"><Icon name="heart" size={30} stroke={2.4} /></button>
          </div>
          <p className="mono" style={{ textAlign: 'center', margin: 0 }}>{queue.length} idée{queue.length > 1 ? 's' : ''} à swiper</p>
        </>
      ) : (
        <div className="empty"><p>{ideas.length ? `Tu as tout swipé. Quand ${partnerName} dit oui aussi, l’idée arrive dans son jour — ou touche « Ajouter » ci-dessous.` : 'Pas encore d’idées : choisis un type et une ville, puis lance la recherche.'}</p></div>
      )}

      {myYes.length > 0 && (
        <>
          <div className="sec-head"><h2>Tes coups de cœur</h2><span className="mono">{myYes.length}</span></div>
          {myYes.map((i) => {
            const pv = partnerVote(i.id);
            return (
              <div key={i.id} className="liked">
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b>{i.title}</b>
                  <span className="m"><span style={{ color: pv === 'no' ? 'var(--alert)' : pv === 'yes' ? 'var(--ok-text)' : 'var(--partner)', fontWeight: 600 }}>
                    {pv === 'no' ? `${partnerName} a dit non` : pv === 'yes' ? `${partnerName} a dit oui` : `En attente de ${partnerName}`}</span> · {i.city ? i.city + ' · ' : ''}{dayLabel(i.day)}</span>
                </span>
                <button className="btn sm" style={{ width: 'auto', padding: '0 14px', flex: 'none' }} disabled={adding === i.id} onClick={() => addNow(i)}>
                  {adding === i.id ? '…' : <><Icon name="plus" size={16} /> Ajouter</>}
                </button>
              </div>
            );
          })}
        </>
      )}

      <div className="sec-head"><h2>Nouvelles idées</h2><button onClick={() => setShowFilters((x) => !x)}>{showFilters ? 'Masquer' : 'Filtres'}</button></div>
      {(showFilters || !ideas.length) && (
        <section className="card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12, padding: 16 }} aria-label="Filtres des idées">
          <p className="mono" style={{ margin: 0 }}>Quel type ? (rien = un mélange)</p>
          <div className="chips">
            {CATS.map((c) => (
              <button key={c} className="chip" aria-pressed={cats.includes(c)} style={{ minHeight: 38, fontSize: 14, padding: '0 12px' }}
                onClick={() => setCats((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]))}>{c}</button>
            ))}
          </div>
          <div className="row">
            <div className="field" style={{ flex: 1, minWidth: 0 }}><label htmlFor="icity">Ville ou quartier</label>
              <input id="icity" className="input" list="icities" placeholder="Partout" value={city} onChange={(e) => setCity(e.target.value)} />
              <datalist id="icities">{[...new Set(ideas.map((i) => i.city).filter(Boolean))].map((c) => <option key={c!} value={c!} />)}</datalist></div>
            <div className="field" style={{ flex: 1, minWidth: 0 }}><label htmlFor="iday">Pour quel jour</label>
              <select id="iday" className="input" value={ideaDay} onChange={(e) => setIdeaDay(e.target.value)}>
                <option value="">N’importe quand</option>
                {days.map((x, i) => <option key={x} value={x}>J{i + 1} · {new Date(x + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</option>)}
              </select></div>
          </div>
        </section>
      )}
      <button className="btn" onClick={generate} disabled={!!gen && gen.startsWith('Recherche')}>{gen?.startsWith('Recherche') ? gen : 'Proposer 8 idées' + (cats.length || city || ideaDay ? ' avec ces filtres' : '')}</button>
      <p className="mono" style={{ margin: 0, textAlign: 'center', textTransform: 'none' }}>1 appui = 1 seule recherche (8 idées) · moins d’1 centime</p>
      {gen && !gen.startsWith('Recherche') && <p className="err" role="alert">{gen}</p>}

      {matched.length > 0 && <p className="mono" style={{ textAlign: 'center', margin: '8px 0 0' }}>{matched.length} idée{matched.length > 1 ? 's' : ''} déjà dans le programme</p>}

      {match && (
        <div role="dialog" aria-label="C'est un match" className="match-full">
          <p className="mono" style={{ color: 'var(--accent)' }}>Vous avez dit oui tous les deux</p>
          <h2>C’est un match.</h2>
          <p style={{ color: '#D6D4CD', fontSize: 17 }}>{match.title} est ajouté {match.day ? 'au ' + dayLabel(match.day) : 'dans « À placer »'}.</p>
          <button className="btn" style={{ marginTop: 'auto', background: '#fff', color: 'var(--ink)' }} onClick={() => { setMatch(null); d.go('days', match.day ?? null); }}>Voir dans le programme</button>
          <button className="btn ghost" style={{ background: 'transparent', color: '#fff', borderColor: '#4A4945' }} onClick={() => setMatch(null)}>Continuer à swiper</button>
        </div>
      )}
    </section>
  );
}
