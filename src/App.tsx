import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, type Island, type Profile } from './lib/supabase';
import { rememberInviteFromUrl, takePendingInvite } from './lib/logic';
import Login from './screens/Login';
import IslandScreen from './screens/Island';
import Tastes from './screens/Tastes';
import Home from './screens/Home';

rememberInviteFromUrl();

export type Ctx = { me: Profile; partner: Profile | null; island: Island; reload: () => void };

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [island, setIsland] = useState<Island | null | undefined>(undefined);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [view, setView] = useState<'home' | 'tastes'>('home');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const load = useCallback(async () => {
    if (!session) return;
    const pending = takePendingInvite();
    if (pending) {
      const { error } = await supabase.rpc('join_island', { p_code: pending });
      setJoinError(error ? error.message : null);
    }
    const { data: mem } = await supabase.from('island_members').select('island_id').eq('user_id', session.user.id).limit(1);
    const id = mem?.[0]?.island_id;
    if (!id) { setIsland(null); return; }
    const [{ data: isl }, { data: members }] = await Promise.all([
      supabase.from('islands').select('*').eq('id', id).single(),
      supabase.from('island_members').select('user_id').eq('island_id', id)
    ]);
    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profs } = await supabase.from('profiles').select('*').in('id', ids);
    setIsland(isl as Island);
    setProfiles((profs ?? []) as Profile[]);
  }, [session]);

  useEffect(() => { load(); }, [load]);

  // Synchro temps réel : arrivée du binôme, changement de goûts.
  useEffect(() => {
    if (!island) return;
    const ch = supabase.channel('island-' + island.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'island_members', filter: `island_id=eq.${island.id}` }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [island, load]);

  if (session === undefined) return null;
  if (!session) return <Login />;
  if (island === undefined) return null;

  const me = profiles.find((p) => p.id === session.user.id);
  const partner = profiles.find((p) => p.id !== session.user.id) ?? null;
  if (!island || !me || !partner) return <IslandScreen island={island ?? null} me={me ?? null} error={joinError} onDone={load} />;

  const ctx: Ctx = { me, partner, island, reload: load };
  if (view === 'tastes' || me.tastes.length === 0) return <Tastes ctx={ctx} onDone={() => setView('home')} />;
  return <Home ctx={ctx} onTastes={() => setView('tastes')} />;
}
