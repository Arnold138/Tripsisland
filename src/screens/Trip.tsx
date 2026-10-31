import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, type Activity, type Idea, type Message, type Swipe, type Trip as TripT } from '../lib/supabase';
import { tripDays } from '../lib/logic';
import { geocodeActivity } from '../lib/geo';
import ActivitySheet from './ActivitySheet';
import TripForm from './TripForm';
import Search from './Search';
import Icon from './Icon';
import NowTab from './tabs/NowTab';
import DaysTab from './tabs/DaysTab';
import MatchTab from './tabs/MatchTab';
import UsTab from './tabs/UsTab';
import type { Ctx } from '../App';

const MapTab = lazy(() => import('./tabs/MapTab'));

export type Tab = 'now' | 'days' | 'map' | 'match' | 'us';
export type Presence = { tab: Tab; day: string | null; at: number } | null;
export type TripData = {
  ctx: Ctx; trip: TripT; days: string[]; acts: Activity[]; ideas: Idea[]; swipes: Swipe[]; messages: Message[];
  partnerName: string; partnerHere: Presence;
  go: (tab: Tab, day?: string | null) => void; edit: (a: Activity | 'new', day?: string | null) => void;
  reload: () => void; toggleDone: (a: Activity) => void;
};

export const TAB_LABEL: Record<Tab, string> = { now: 'Maintenant', days: 'Jours', map: 'Carte', match: 'Match', us: 'Nous' };
export const longDay = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
export const shortDay = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }).replace('.', '');

export default function Trip({ ctx, trip: initial, onBack, initialTab, initialDay }: { ctx: Ctx; trip: TripT; onBack: () => void; initialTab?: Tab; initialDay?: string | null }) {
  const { me, partner, island } = ctx;
  const [trip, setTrip] = useState(initial);
  const [tab, setTab] = useState<Tab>(initialTab ?? 'now');
  const days = useMemo(() => tripDays(trip.start_date, trip.end_date), [trip.start_date, trip.end_date]);
  const [day, setDay] = useState<string | null>(() => {
    if (initialDay !== undefined) return initialDay;
    const today = new Date().toISOString().slice(0, 10);
    const all = tripDays(initial.start_date, initial.end_date);
    return all.includes(today) ? today : all[0] ?? null;
  });
  const [acts, setActs] = useState<Activity[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [swipes, setSwipes] = useState<Swipe[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sheet, setSheet] = useState<{ a: Activity | null; day: string | null } | null>(null);
  const [editTrip, setEditTrip] = useState(false);
  const [searching, setSearching] = useState(false);
  const [partnerHere, setPartnerHere] = useState<Presence>(null);
  const presence = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const geoBusy = useRef(false);
  const partnerName = partner?.name?.split(' ')[0] ?? 'ton binôme';

  const load = useCallback(async () => {
    const [t, a, i, m] = await Promise.all([
      supabase.from('trips').select('*').eq('id', trip.id).single(),
      supabase.from('activities').select('*').eq('trip_id', trip.id),
      supabase.from('ideas').select('*').eq('trip_id', trip.id).order('created_at'),
      supabase.from('messages').select('*').eq('trip_id', trip.id).order('created_at', { ascending: false }).limit(150)
    ]);
    if (t.data) setTrip(t.data as TripT);
    const list = (a.data ?? []) as Activity[];
    setActs(list);
    const il = (i.data ?? []) as Idea[];
    setIdeas(il);
    setMessages(((m.data ?? []) as Message[]).reverse());
    if (il.length) {
      const { data } = await supabase.from('swipes').select('idea_id,user_id,vote,created_at').in('idea_id', il.map((x) => x.id));
      setSwipes((data ?? []) as Swipe[]);
    }
    // Les lieux pas encore placés sur la carte sont cherchés une seule fois (5 max à la fois).
    if (!geoBusy.current) {
      const todo = list.filter((x) => x.lat == null && !x.geo_tried).slice(0, 5);
      if (todo.length) {
        geoBusy.current = true;
        for (const x of todo) await geocodeActivity(x, t.data?.title ?? trip.title).catch(() => false);
        geoBusy.current = false;
      }
    }
  }, [trip.id, trip.title]);

  useEffect(() => {
    load();
    const f = `trip_id=eq.${trip.id}`;
    const ch = supabase.channel('trip-' + trip.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities', filter: f }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ideas', filter: f }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: f }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'swipes' }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips', filter: `id=eq.${trip.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [trip.id, load]);

  // Présence en direct : chacun voit où est l'autre dans l'app.
  useEffect(() => {
    const ch = supabase.channel('here-' + trip.id, { config: { presence: { key: me.id } } });
    ch.on('presence', { event: 'sync' }, () => {
      const st = ch.presenceState<{ tab: Tab; day: string | null; at: number }>();
      const p = partner ? st[partner.id]?.[0] : undefined;
      setPartnerHere(p ? { tab: p.tab, day: p.day, at: p.at } : null);
    }).subscribe((s) => { if (s === 'SUBSCRIBED') ch.track({ tab: 'now', day: null, at: Date.now() }); });
    presence.current = ch;
    supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', me.id).then(() => {});
    return () => { supabase.removeChannel(ch); presence.current = null; };
  }, [trip.id, me.id, partner]);
  useEffect(() => { presence.current?.track({ tab, day: tab === 'days' || tab === 'map' ? day : null, at: Date.now() }); }, [tab, day]);

  useEffect(() => { if (day && days.length && !days.includes(day)) setDay(days[0]); }, [days, day]);

  const go = (t: Tab, d?: string | null) => { if (d !== undefined) setDay(d); setTab(t); window.scrollTo({ top: 0 }); };
  const toggleDone = async (a: Activity) => {
    setActs((l) => l.map((x) => (x.id === a.id ? { ...x, done: !a.done, done_at: a.done ? null : new Date().toISOString() } : x))); // réponse immédiate
    await supabase.from('activities').update({ done: !a.done, done_at: a.done ? null : new Date().toISOString() }).eq('id', a.id);
  };
  const data: TripData = {
    ctx, trip, days, acts, ideas, swipes, messages, partnerName, partnerHere, go,
    edit: (a, d) => setSheet({ a: a === 'new' ? null : a, day: d === undefined ? day : d }), reload: load, toggleDone
  };
  const myVoted = new Set(swipes.filter((s) => s.user_id === me.id).map((s) => s.idea_id));
  const toSwipe = ideas.filter((i) => !i.matched && !myVoted.has(i.id)).length;
  const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  return (
    <main className="screen trip-screen">
      <header className="trip-head">
        <button className="icon-btn" onClick={onBack} aria-label="Retour aux voyages"><Icon name="back" /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1><span className="dot" style={{ width: 10, height: 10, background: trip.color }} />{trip.title}</h1>
          <p className="mono" style={{ margin: 0 }}>{trip.start_date && trip.end_date ? `${fmt(trip.start_date)} → ${fmt(trip.end_date)} · ${days.length} j` : 'Dates à définir'}</p>
        </div>
        <button className={'here' + (partnerHere ? ' on' : '')} onClick={() => go('us')} aria-label={partnerHere ? `${partnerName} est dans l'app` : `${partnerName} n'est pas connectée`}>
          <span className="avatar sm" style={{ background: 'var(--partner)' }}>{partnerName[0]?.toUpperCase()}</span>
        </button>
        <button className="icon-btn" onClick={() => setSearching(true)} aria-label="Rechercher un lieu à ajouter"><Icon name="search" /></button>
        <button className="icon-btn" onClick={() => setEditTrip(true)} aria-label="Modifier le voyage"><Icon name="edit" /></button>
      </header>
      {partnerHere && (
        <button className="here-bar" onClick={() => go(partnerHere.tab, partnerHere.day ?? day)}>
          <i /> {partnerName} est là · {TAB_LABEL[partnerHere.tab]}{partnerHere.day ? ' · ' + shortDay(partnerHere.day) : ''} <span>Rejoindre ›</span>
        </button>
      )}

      {tab === 'now' && <NowTab d={data} />}
      {tab === 'days' && <DaysTab d={data} day={day} setDay={setDay} />}
      {tab === 'map' && <Suspense fallback={<div className="map-box" />}><MapTab d={data} day={day} setDay={setDay} /></Suspense>}
      {tab === 'match' && <MatchTab d={data} />}
      {tab === 'us' && <UsTab d={data} />}

      <nav className="tabbar" aria-label="Sections du voyage">
        {([['now', trip.status === 'past' ? 'photo' : 'now'], ['days', 'days'], ['map', 'map'], ['match', 'heart'], ['us', 'chat']] as [Tab, string][]).map(([t, ic]) => (
          <button key={t} aria-current={tab === t ? 'page' : undefined} onClick={() => go(t)}>
            <Icon name={ic} size={22} />
            <span>{t === 'now' && trip.status === 'past' ? 'Souvenirs' : TAB_LABEL[t]}</span>
            {t === 'match' && toSwipe > 0 && <b className="badge">{toSwipe}</b>}
            {t === 'us' && partnerHere && <b className="badge live" aria-label="en ligne" />}
          </button>
        ))}
      </nav>

      {sheet && <ActivitySheet tripId={trip.id} days={days} day={sheet.day} activity={sheet.a} onClose={() => { setSheet(null); load(); }} />}
      {searching && <Search islandId={island.id} tripId={trip.id} onClose={() => { setSearching(false); load(); }} onShow={(_id, d) => { setSearching(false); load(); go('days', d); }} />}
      {editTrip && <TripForm islandId={island.id} trip={trip} onClose={() => setEditTrip(false)} onDeleted={onBack} />}
    </main>
  );
}
