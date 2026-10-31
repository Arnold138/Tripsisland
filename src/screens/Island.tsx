import { useState } from 'react';
import { supabase, type Island, type Profile } from '../lib/supabase';
import { inviteLink, parseInviteCode } from '../lib/logic';

type Props = { island: Island | null; me: Profile | null; error: string | null; onDone: () => void };

function Avatar({ p, letter, color, empty }: { p?: Profile | null; letter: string; color?: string; empty?: boolean }) {
  return (
    <span className={'avatar' + (empty ? ' empty' : '')} style={color ? { background: color } : undefined}>
      {p?.avatar_url ? <img src={p.avatar_url} alt="" /> : letter}
    </span>
  );
}

export default function IslandScreen({ island, me, error, onDone }: Props) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(error);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const create = async () => {
    setBusy(true);
    const { error } = await supabase.rpc('create_island', { p_name: 'Notre île' });
    setBusy(false);
    if (error) setErr(error.message); else onDone();
  };
  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = parseInviteCode(code);
    if (!c) { setErr('Code au format ISLA-XXXX.'); return; }
    setBusy(true);
    const { error } = await supabase.rpc('join_island', { p_code: c });
    setBusy(false);
    if (error) setErr(error.message); else onDone();
  };
  const share = async () => {
    if (!island) return;
    const url = inviteLink(island.invite_code);
    try {
      if (navigator.share) await navigator.share({ title: 'TripIsland', text: 'Rejoins notre île sur TripIsland', url });
      else { await navigator.clipboard.writeText(url); setCopied(true); }
    } catch { /* partage annulé */ }
  };
  const initial = (me?.name ?? 'A').slice(0, 1).toUpperCase();

  return (
    <main className="screen">
      <p className="brand"><i aria-hidden="true" />TripIsland</p>
      <h1 className="h1">Votre île à deux.</h1>
      <p className="sub">{island ? 'Envoie le lien à ta copine : elle se connecte, et vous êtes liés.' : 'Crée votre île, ou rejoins celle de ton binôme avec son code.'}</p>

      <div className="link-zone" aria-hidden="true">
        <svg width="100%" height="220" viewBox="0 0 350 220" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 0 }}>
          <path d="M95 110 Q 175 40 255 110" stroke="#B9B8B2" strokeWidth="2.5" strokeDasharray="2 8" strokeLinecap="round" fill="none" />
        </svg>
        <span className="pulse" style={{ position: 'absolute', left: 'calc(50% - 9px)', top: 66, width: 18, height: 18, borderRadius: '50%', background: 'var(--accent)' }} />
        <div style={{ position: 'absolute', left: '16%', top: 70 }}><Avatar p={me} letter={initial} /></div>
        <div style={{ position: 'absolute', right: '16%', top: 70 }}><Avatar letter="?" empty /></div>
      </div>

      {island && (
        <div className="card" style={{ marginTop: 16 }}>
          <span className="dot" style={{ background: 'var(--accent)' }} />
          <p style={{ margin: 0, flex: 1, fontSize: 14, fontWeight: 500 }}>En attente de ton binôme</p>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, letterSpacing: '0.06em' }}>{island.invite_code}</span>
        </div>
      )}

      <div className="spacer" style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 16 }}>
        {island ? (
          <>
            <button className="btn" onClick={share}>{copied ? 'Lien copié' : 'Envoyer le lien à ta copine'}</button>
            <p className="sub" style={{ textAlign: 'center', fontSize: 13, margin: 0 }}>Cet écran s'ouvrira tout seul dès qu'elle aura rejoint.</p>
          </>
        ) : (
          <>
            <button className="btn" onClick={create} disabled={busy}>Créer notre île</button>
            <form onSubmit={join} style={{ display: 'flex', gap: 8 }}>
              <label htmlFor="code" style={{ position: 'absolute', left: -9999 }}>Code d'invitation</label>
              <input id="code" className="input" placeholder="ISLA-XXXX" autoCapitalize="characters" value={code} onChange={(e) => setCode(e.target.value)} />
              <button className="btn ghost" style={{ width: 'auto', padding: '0 18px' }} disabled={busy}>Rejoindre</button>
            </form>
          </>
        )}
        {err && <p className="err" role="alert">{err}</p>}
      </div>
    </main>
  );
}
