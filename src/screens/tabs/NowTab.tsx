import { byTime, daysUntil } from '../../lib/logic';
import Icon from '../Icon';
import Photos from '../Photos';
import { ActivityCard, LegRow } from './DaysTab';
import { longDay, type TripData } from '../Trip';

export default function NowTab({ d }: { d: TripData }) {
  const { trip, days, acts, ideas, swipes, ctx, partnerName } = d;
  const today = new Date().toISOString().slice(0, 10);
  const until = trip.start_date ? daysUntil(trip.start_date) : null;
  const during = days.includes(today);
  const past = trip.status === 'past' || (trip.end_date != null && daysUntil(trip.end_date) < 0);
  const filled = days.filter((x) => acts.some((a) => a.day === x)).length;
  const firstEmpty = days.find((x) => !acts.some((a) => a.day === x));
  const voted = new Set(swipes.filter((s) => s.user_id === ctx.me.id).map((s) => s.idea_id));
  const toSwipe = ideas.filter((i) => !i.matched && !voted.has(i.id)).length;
  const done = acts.filter((a) => a.done).sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''));
  const focusDay = during ? today : days[0];
  const dayActs = focusDay ? byTime(acts.filter((a) => a.day === focusDay)) : [];
  const next = during ? dayActs.find((a) => !a.done) : null;
  const others = d.messages.filter((m) => m.user_id !== ctx.me.id);
  const lastMsg = others[others.length - 1];

  return (
    <section className="tab-body" aria-label={past ? 'Souvenirs' : 'Maintenant'}>
      {!past && !during && until != null && (
        <div className="hero">
          <p className="mono" style={{ color: '#B9B8B2', margin: 0 }}>Départ {longDay(trip.start_date!)}</p>
          <p className="big">{until > 0 ? <>J-{until}</> : 'C’est parti'}</p>
          <p style={{ margin: 0, color: '#D6D4CD' }}>{until > 1 ? `Encore ${until} jours avant le ${trip.title}.` : 'Bon voyage à vous deux.'}</p>
          <div className="meter" aria-label={`Programme rempli : ${filled} jours sur ${days.length}`}>
            <span style={{ width: `${days.length ? (filled / days.length) * 100 : 0}%` }} />
          </div>
          <p className="mono" style={{ color: '#B9B8B2', margin: 0 }}>Programme : {filled} / {days.length} jours remplis</p>
        </div>
      )}

      {during && (
        <div className="hero">
          <p className="mono" style={{ color: '#B9B8B2', margin: 0 }}>Aujourd’hui · Jour {days.indexOf(today) + 1}</p>
          <p className="big" style={{ fontSize: 40 }}>{next ? 'Prochaine étape' : 'Journée terminée'}</p>
          {next && <p style={{ margin: 0, color: '#fff', fontSize: 20, fontWeight: 600 }}>{next.time ? next.time + ' · ' : ''}{next.title}</p>}
        </div>
      )}

      {past && (
        <div className="hero">
          <p className="mono" style={{ color: '#B9B8B2', margin: 0 }}>Souvenir</p>
          <p className="big" style={{ fontSize: 40 }}>{trip.title}</p>
          <p style={{ margin: 0, color: '#D6D4CD' }}>{done.length} activité{done.length > 1 ? 's' : ''} faite{done.length > 1 ? 's' : ''} · ajoutez vos photos, leur lieu s’affiche sur le globe.</p>
        </div>
      )}

      {!past && acts.some((a) => !a.day) && (
        <button className="todo-bar" onClick={() => d.go('days', null)}>
          <b>{acts.filter((a) => !a.day).length}</b> lieu{acts.filter((a) => !a.day).length > 1 ? 'x' : ''} à placer dans un jour <span>Organiser ›</span>
        </button>
      )}
      {!past && (
        <div className="shortcuts">
          <button onClick={() => d.edit('new', firstEmpty ?? focusDay ?? null)}><Icon name="plus" /><b>Ajouter</b><span>{firstEmpty ? `Jour ${days.indexOf(firstEmpty) + 1} est vide` : 'une activité'}</span></button>
          <button onClick={() => d.go('match')}><Icon name="heart" /><b>Idées</b><span>{toSwipe ? `${toSwipe} à swiper` : 'en proposer'}</span></button>
          <button onClick={() => d.go('map', focusDay ?? null)}><Icon name="map" /><b>Carte</b><span>{(() => { const n = acts.filter((a) => a.lat != null).length; return n > 1 ? `${n} lieux placés` : n ? '1 lieu placé' : 'aucun lieu'; })()}</span></button>
          <button onClick={() => d.go('us')}><Icon name="chat" /><b>{partnerName}</b><span>{lastMsg ? '« ' + lastMsg.body.slice(0, 22) + (lastMsg.body.length > 22 ? '… »' : ' »') : 'lui écrire'}</span></button>
        </div>
      )}

      {!past && focusDay && (
        <>
          <div className="sec-head"><h2>{during ? 'Aujourd’hui' : 'Premier jour'}</h2><button onClick={() => d.go('days', focusDay)}>Tout le jour ›</button></div>
          {dayActs.length === 0 && <div className="empty"><p>Rien de prévu pour l’instant.</p></div>}
          {dayActs.slice(0, during ? 20 : 3).map((a, i) => (
            <div key={a.id}>{i > 0 && <LegRow a={dayActs[i - 1]} b={a} />}<ActivityCard a={a} d={d} from={i > 0 ? dayActs[i - 1] : null} /></div>
          ))}
        </>
      )}

      <div className="sec-head"><h2>Ce qu’on a fait</h2><span className="mono">{done.length}</span></div>
      {done.length === 0 ? (
        <div className="empty"><p>Touchez « C’est fait » sur une activité : elle arrive ici, avec la date.</p></div>
      ) : (
        <ul className="done-list">
          {done.map((a) => (
            <li key={a.id}>
              <Icon name="check" size={16} />
              <span style={{ flex: 1, minWidth: 0 }}><b>{a.title}</b><small>{a.day ? longDay(a.day) : ''}{a.done_at ? ' · coché le ' + new Date(a.done_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}</small></span>
              <button onClick={() => d.toggleDone(a)} aria-label={`Remettre « ${a.title} » à faire`}><Icon name="undo" size={16} /></button>
            </li>
          ))}
        </ul>
      )}

      <div className="sec-head"><h2>Photos souvenirs</h2></div>
      <Photos tripId={trip.id} />
    </section>
  );
}
