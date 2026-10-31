import { useState } from 'react';
import { supabase } from '../lib/supabase';

const redirect = () => location.href.split('#')[0];

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect() } });
    if (error) setErr('Connexion Google indisponible pour le moment. Utilise le lien par e-mail.');
  };
  const magic = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect() } });
    if (error) setErr(error.message); else setSent(true);
  };

  return (
    <main className="screen">
      <p className="brand"><i aria-hidden="true" />TripIsland</p>
      <h1 className="h1">Votre île<br />à deux.</h1>
      <p className="sub">Un seul espace pour vos voyages passés et à venir, synchronisé entre vos deux téléphones.</p>
      <div className="spacer" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button className="btn" onClick={google}>Continuer avec Google</button>
        {sent ? (
          <p className="card" role="status"><span className="dot" style={{ background: 'var(--ok)' }} />Lien envoyé à {email}. Ouvre-le sur ce téléphone.</p>
        ) : (
          <form onSubmit={magic} style={{ display: 'flex', gap: 8 }}>
            <label htmlFor="mail" className="mono" style={{ position: 'absolute', left: -9999 }}>E-mail</label>
            <input id="mail" className="input" type="email" required placeholder="ou ton e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn ghost" style={{ width: 'auto', padding: '0 18px' }}>Lien</button>
          </form>
        )}
        {err && <p className="err" role="alert">{err}</p>}
      </div>
    </main>
  );
}
