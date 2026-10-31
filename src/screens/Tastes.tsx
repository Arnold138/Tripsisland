import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CROWD_PREFS, TASTE_GROUPS, commonTastes } from '../lib/logic';
import type { Ctx } from '../App';

const PACES: [string, string][] = [['calme', 'Tranquille'], ['eq', 'Équilibré'], ['intense', 'Intense']];

export default function Tastes({ ctx, onDone }: { ctx: Ctx; onDone: () => void }) {
  const { me, partner } = ctx;
  const [who, setWho] = useState<'me' | 'partner'>('me');
  const [mine, setMine] = useState<string[]>(me.tastes);
  const [pace, setPace] = useState(me.pace);
  useEffect(() => { setMine(me.tastes); setPace(me.pace); }, [me.tastes, me.pace]);

  const theirs = partner?.tastes ?? [];
  const shown = who === 'me' ? mine : theirs;
  const other = who === 'me' ? theirs : mine;
  const common = commonTastes(mine, theirs).length;
  const color = who === 'me' ? 'var(--ink)' : 'var(--partner)';

  const save = async (tastes: string[], p = pace) => {
    setMine(tastes);
    await supabase.from('profiles').update({ tastes, pace: p, updated_at: new Date().toISOString() }).eq('id', me.id);
  };
  const crowd = CROWD_PREFS.find(([id]) => mine.includes(id))?.[0] ?? 'foule-ok';
  const setCrowd = (id: string) => save([...mine.filter((t) => !t.startsWith('foule-')), id]);
  const toggle = (id: string) => { if (who !== 'me') return; save(mine.includes(id) ? mine.filter((t) => t !== id) : [...mine, id]); };
  const setP = (p: typeof pace) => { setPace(p); save(mine, p); };

  return (
    <main className="screen">
      <p className="brand"><i aria-hidden="true" />TripIsland</p>
      <h1 className="h1" style={{ fontSize: 34 }}>Qu'est-ce qui vous fait vibrer ?</h1>
      <p className="sub">Chacun coche les siens. Les goûts communs passent en priorité.</p>

      <div className="seg" role="group" aria-label="Profil" style={{ marginTop: 20 }}>
        <button aria-pressed={who === 'me'} style={{ ['--c' as string]: 'var(--ink)' }} onClick={() => setWho('me')}>
          <span className="av">{(me.name ?? 'A')[0].toUpperCase()}</span>Toi<small>{mine.length} choix</small>
        </button>
        <button aria-pressed={who === 'partner'} style={{ ['--c' as string]: 'var(--partner)' }} onClick={() => setWho('partner')}>
          <span className="av">{(partner?.name ?? 'E')[0].toUpperCase()}</span>{partner?.name?.split(' ')[0] ?? 'Elle'}<small>{theirs.length} choix</small>
        </button>
      </div>

      {TASTE_GROUPS.map((g) => (
        <section key={g.title} aria-label={g.title}>
          <p className="mono" style={{ margin: '18px 0 8px' }}>{g.title}</p>
          <div className="chips">
            {g.items.map(([id, label]) => (
              <button key={id} className="chip" aria-pressed={shown.includes(id)} disabled={who !== 'me'}
                style={{ ['--c' as string]: color, opacity: 1 }} onClick={() => toggle(id)}>
                {label}{shown.includes(id) && other.includes(id) && <span className="both" aria-label="en commun" />}
              </button>
            ))}
          </div>
        </section>
      ))}
      <p className="sub" style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
        <span className="dot" style={{ width: 6, height: 6, background: 'var(--accent)' }} />
        {common} goût{common > 1 ? 's' : ''} en commun{who === 'partner' ? ' · ses choix se mettent à jour en direct' : ''}
      </p>

      <p className="mono" style={{ margin: '20px 0 8px' }}>La foule</p>
      <div className="seg">
        {CROWD_PREFS.map(([id, label]) => (
          <button key={id} aria-pressed={crowd === id} disabled={who !== 'me'} style={{ ['--c' as string]: 'var(--ink)', justifyContent: 'center', padding: '0 8px', fontSize: 14 }}
            onClick={() => setCrowd(id)}>{label}</button>
        ))}
      </div>

      <p className="mono" style={{ margin: '20px 0 8px' }}>Rythme</p>
      <div className="seg">
        {PACES.map(([id, label]) => (
          <button key={id} aria-pressed={pace === id} style={{ ['--c' as string]: 'var(--ink)', justifyContent: 'center', padding: 0 }}
            onClick={() => setP(id as typeof pace)}>{label}</button>
        ))}
      </div>

      <div className="spacer" style={{ paddingTop: 20 }}>
        <button className="btn" disabled={mine.filter((t) => !t.startsWith('foule-')).length === 0} onClick={onDone}>Continuer</button>
      </div>
    </main>
  );
}
