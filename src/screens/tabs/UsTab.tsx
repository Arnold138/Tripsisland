import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Icon from '../Icon';
import { shortDay, TAB_LABEL, type TripData } from '../Trip';

type Item = { id: string; at: string; who: string; kind: 'msg' | 'event'; text: string };

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'à l’instant';
  if (m < 60) return `il y a ${m} min`;
  if (m < 1440) return `il y a ${Math.round(m / 60)} h`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

/** « Nous » : la discussion du voyage + ce que chacun a fait, au même endroit, en direct. */
export default function UsTab({ d }: { d: TripData }) {
  const { ctx, acts, ideas, swipes, messages, partnerName, partnerHere } = d;
  const me = ctx.me, partner = ctx.partner;
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const name = (id: string | null) => (id === me.id ? 'Toi' : partnerName);

  const items: Item[] = [
    ...messages.map((m) => ({ id: 'm' + m.id, at: m.created_at, who: m.user_id, kind: 'msg' as const, text: m.body })),
    ...acts.filter((a) => a.created_by).map((a) => ({ id: 'a' + a.id, at: a.created_at, who: a.created_by!, kind: 'event' as const, text: `a ajouté « ${a.title} »${a.day ? ' au ' + shortDay(a.day) : ''}` })),
    ...acts.filter((a) => a.done && a.done_at).map((a) => ({ id: 'd' + a.id, at: a.done_at!, who: '', kind: 'event' as const, text: `« ${a.title} » est fait` })),
    ...swipes.filter((s) => s.vote === 'yes' && s.created_at).map((s) => ({ id: 's' + s.idea_id + s.user_id, at: s.created_at!, who: s.user_id, kind: 'event' as const, text: `aime « ${ideas.find((i) => i.id === s.idea_id)?.title ?? 'une idée'} »` }))
  ].sort((a, b) => a.at.localeCompare(b.at)).slice(-120);

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [items.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const { error } = await supabase.from('messages').insert({ trip_id: d.trip.id, body });
    setSending(false);
    if (error) setErr('Message non envoyé, réessaie.'); else { setText(''); setErr(null); d.reload(); }
  };
  const lastSeen = (partner as { last_seen?: string | null } | null)?.last_seen;

  return (
    <section className="tab-body" aria-label={`Toi et ${partnerName}`}>
      <div className={'presence' + (partnerHere ? ' on' : '')}>
        <span className="avatar sm" style={{ background: 'var(--partner)' }}>{partnerName[0]?.toUpperCase()}</span>
        <span style={{ flex: 1 }}>
          <b>{partnerName}</b>
          <small>{partnerHere ? `Dans l’app · regarde ${TAB_LABEL[partnerHere.tab]}${partnerHere.day ? ', ' + shortDay(partnerHere.day) : ''}` : lastSeen ? `Vue ${ago(lastSeen)}` : 'Pas encore venue dans ce voyage'}</small>
        </span>
        {partnerHere && <button className="pill" onClick={() => d.go(partnerHere.tab, partnerHere.day ?? undefined)}><Icon name="eye" size={16} /> Voir</button>}
      </div>

      <div className="feed" aria-live="polite">
        {items.length === 0 && <div className="empty"><p>Écrivez-vous ici : idées, réservations, « on part à 9 h ? ». Tout ce que vous ajoutez s’affiche aussi.</p></div>}
        {items.map((it) => it.kind === 'msg' ? (
          <div key={it.id} className={'bubble' + (it.who === me.id ? ' me' : '')}>
            <p>{it.text}</p><small>{ago(it.at)}</small>
          </div>
        ) : (
          <p key={it.id} className="event"><b>{it.who ? name(it.who) : ''}</b> {it.text} · {ago(it.at)}</p>
        ))}
        <div ref={end} />
      </div>

      <form className="composer" onSubmit={send}>
        <input className="input" placeholder={`Écrire à ${partnerName}…`} value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} aria-label={`Message à ${partnerName}`} />
        <button className="icon-btn dark" disabled={!text.trim() || sending} aria-label="Envoyer"><Icon name="send" /></button>
      </form>
      {err && <p className="err" role="alert">{err}</p>}
    </section>
  );
}
