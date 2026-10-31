import { useState } from 'react';
import { supabase, type Activity } from '../../lib/supabase';
import { CrowdBadge, CrowdSheet, fetchCrowd, type CrowdInfo } from '../Crowd';
import { byTime, dirLink, estimateLeg, fmtKm, fmtMin, type Leg } from '../../lib/logic';
import Icon from '../Icon';
import { longDay, type TripData } from '../Trip';

const short = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '').toUpperCase();
const num = (d: string) => new Date(d + 'T12:00:00').getDate();
const MODE: Record<Leg['mode'], [string, string]> = { walking: ['walk', 'à pied'], transit: ['metro', 'en métro / train'], train: ['train', 'en train rapide'] };
/** Adresse courte : sans « Japon », sans code postal. */
export const shortAddr = (s: string) => s.replace(/^Japon,\s*/, '').replace(/,?\s*Japon$/, '').replace(/〒?\s*\d{3}-\d{4}\s*/, '').trim();
const has = (a: Activity): a is Activity & { lat: number; lon: number } => a.lat != null && a.lon != null;

/** Une activité : on voit tout de suite quoi faire (Itinéraire, C'est fait), et on la touche pour la modifier. */
export function ActivityCard({ a, d, from }: { a: Activity; d: TripData; from?: Activity | null }) {
  const mine = a.created_by === d.ctx.me.id;
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const crowd = (a as Activity & { crowd?: CrowdInfo | null }).crowd ?? null;
  const estimate = async () => {
    setBusy(true); setErr(null);
    const r = await fetchCrowd({ name: a.title, address: a.address, date: a.day, activityId: a.id });
    setBusy(false);
    if (r.error) setErr(r.error); else { setOpen(true); d.reload(); }
  };
  const place = async (day: string) => { await supabase.from('activities').update({ day }).eq('id', a.id); d.reload(); };
  return (
    <article className={'act2' + (a.done ? ' done' : '')}>
      <button className="act2-main" onClick={() => d.edit(a)} aria-label={`Modifier ${a.title}`}>
        <span className="act2-top">
          <span className="act2-time">{a.time ?? 'Libre'}</span>
          {a.tag && <span className="tag">{a.tag}</span>}
          {!mine && a.created_by && <span className="by">Ajouté par {d.partnerName}</span>}
        </span>
        <b>{a.title}</b>
        {a.notes && <span className="m clamp">{a.notes}</span>}
        {(a.station || a.address) && (
          <span className="where"><Icon name={a.station ? 'metro' : 'pin'} size={15} />{a.station ? `Station la plus proche : ${a.station}` : shortAddr(a.address!)}</span>
        )}
      </button>
      <div className="act2-meta">
        <CrowdBadge crowd={crowd} busy={busy} onClick={() => (crowd ? setOpen(true) : estimate())} />
        {err && <span className="err" style={{ margin: 0, fontSize: 12 }}>{err}</span>}
      </div>
      {!a.day && d.days.length > 0 && (
        <div className="place-days" role="group" aria-label={`Placer ${a.title} dans un jour`}>
          <span className="mono" style={{ flex: 'none' }}>Placer :</span>
          {d.days.map((x) => <button key={x} onClick={() => place(x)}>{new Date(x + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }).replace('.', '')}</button>)}
        </div>
      )}
      <div className="act2-actions">
        <a className="pill" href={dirLink(a, from && has(from) ? from : null)} target="_blank" rel="noopener">
          <Icon name="walk" size={18} /> Itinéraire
        </a>
        <button className={'pill' + (a.done ? ' ok' : ' dark')} onClick={() => d.toggleDone(a)} aria-pressed={a.done}>
          <Icon name={a.done ? 'check' : 'check'} size={18} /> {a.done ? 'Fait' : 'C’est fait'}
        </button>
      </div>
      {open && crowd && <CrowdSheet title={a.title} crowd={crowd} busy={busy} onClose={() => setOpen(false)} onRefresh={estimate} />}
    </article>
  );
}

/** Trajet estimé entre deux activités, avec lien Google Maps depuis l'une vers l'autre. */
export function LegRow({ a, b }: { a: Activity; b: Activity }) {
  if (!has(a) || !has(b)) {
    return <div className="leg muted"><span className="leg-line" /><span>Trajet : lieu à préciser</span></div>;
  }
  const l = estimateLeg(a, b);
  const [ic, label] = MODE[l.mode];
  return (
    <a className="leg" href={dirLink(b, a, l.mode)} target="_blank" rel="noopener" aria-label={`Trajet estimé ${fmtMin(l.minutes)} ${label}, ouvrir l'itinéraire`}>
      <span className="leg-line" /><Icon name={ic} size={16} />
      <span><b>≈ {fmtMin(l.minutes)}</b> {label} · {fmtKm(l.km)}</span><span className="leg-go">Itinéraire ›</span>
    </a>
  );
}

export default function DaysTab({ d, day, setDay }: { d: TripData; day: string | null; setDay: (x: string | null) => void }) {
  const { acts, days } = d;
  const unplaced = acts.filter((a) => !a.day);
  const list = byTime(day === null ? unplaced : acts.filter((a) => a.day === day));
  const count = (x: string) => acts.filter((a) => a.day === x).length;
  const first = list.find((a) => a.station) ?? null;
  const idx = day ? days.indexOf(day) : -1;
  const total = list.reduce((n, a, i) => { const p = list[i - 1]; return i && has(a) && has(p) ? n + estimateLeg(p, a).minutes : n; }, 0);

  return (
    <section className="tab-body" aria-label="Programme jour par jour">
      <div className="days" role="group" aria-label="Jours">
        <button className={'day todo' + (unplaced.length ? ' has' : '')} aria-pressed={day === null} onClick={() => setDay(null)} style={{ minWidth: 76 }} aria-label={`À placer : ${unplaced.length} activités sans jour`}>
          <small>À PLACER</small><b>{unplaced.length}</b><span className="pips" />
        </button>
        {days.map((x, i) => (
          <button key={x} className="day" aria-pressed={day === x} onClick={() => setDay(x)} aria-label={`Jour ${i + 1}, ${longDay(x)}, ${count(x)} activités`}>
            <small>{short(x)}</small><b>{num(x)}</b>
            <span className="pips">{Array.from({ length: Math.min(3, count(x)) }).map((_, k) => <i key={k} />)}</span>
          </button>
        ))}
      </div>
      {day !== null && unplaced.length > 0 && (
        <button className="todo-bar" onClick={() => setDay(null)}>
          <b>{unplaced.length}</b> lieu{unplaced.length > 1 ? 'x' : ''} à placer dans un jour <span>Organiser ›</span>
        </button>
      )}

      <div className="day-head">
        <div>
          <p className="mono" style={{ margin: 0 }}>{day ? `Jour ${idx + 1} sur ${days.length}` : 'Pas encore de jour'}</p>
          <h2>{day ? longDay(day) : 'À placer'}</h2>
          {!day && <p className="sub" style={{ margin: '2px 0 0', fontSize: 14 }}>Touchez un jour sous chaque lieu pour le planifier.</p>}
        </div>
        {day && <div className="row" style={{ gap: 6 }}>
          <button className="icon-btn" disabled={idx <= 0} onClick={() => setDay(days[idx - 1])} aria-label="Jour précédent"><Icon name="back" /></button>
          <button className="icon-btn" disabled={idx >= days.length - 1} onClick={() => setDay(days[idx + 1])} aria-label="Jour suivant" style={{ transform: 'scaleX(-1)' }}><Icon name="back" /></button>
        </div>}
      </div>

      {list.length > 0 && day && (
        <div className="day-sum">
          <span><b>{list.length}</b> activité{list.length > 1 ? 's' : ''}</span>
          {total > 0 && <span>≈ <b>{fmtMin(total)}</b> de trajets</span>}
          <button onClick={() => d.go('map', day)}><Icon name="map" size={16} /> Voir sur la carte</button>
        </div>
      )}
      {first && day && (
        <div className="start"><Icon name="metro" size={18} /><span>Départ conseillé : <b>{first.station}</b></span></div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {list.map((a, i) => (
          <div key={a.id}>
            {i > 0 && day && <LegRow a={list[i - 1]} b={a} />}
            {i > 0 && !day && <div style={{ height: 8 }} />}
            <ActivityCard a={a} d={d} from={i > 0 ? list[i - 1] : null} />
          </div>
        ))}
      </div>
      {list.length === 0 && (
        <div className="empty">
          <p>{day ? 'Rien de prévu ce jour-là.' : 'Les idées gardées sans jour arrivent ici.'}</p>
        </div>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => d.edit('new', day)}><Icon name="plus" /> Ajouter</button>
        <button className="btn ghost" onClick={() => d.go('match')}><Icon name="heart" /> Depuis les idées</button>
      </div>
    </section>
  );
}
