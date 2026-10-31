import { supabase } from '../lib/supabase';

export type CrowdInfo = { level: number; label: string; hours: number[]; best: string; avoid: string; note: string; when?: string };

const COLORS = ['#1FAF5B', '#7DBB3C', '#E9A23B', '#F06A2A', '#C8331B'];
const TEXT = ['#11663A', '#3F6B12', '#8A5A06', '#A3300F', '#A3300F'];

/** Demande une estimation d'affluence (1 petit appel IA). Avec activityId, elle est gardée sur l'activité. */
export async function fetchCrowd(p: { name: string; address?: string | null; date?: string | null; activityId?: string }): Promise<{ crowd?: CrowdInfo; error?: string }> {
  const { data, error } = await supabase.functions.invoke('crowd', { body: { name: p.name, address: p.address ?? '', date: p.date ?? null, activity_id: p.activityId } });
  if (error) {
    let m: string | null = null;
    try { m = (await (error as { context?: Response }).context?.json())?.error ?? null; } catch { /* corps illisible */ }
    return { error: m ?? 'Estimation indisponible.' };
  }
  return data?.crowd ? { crowd: data.crowd as CrowdInfo } : { error: data?.error ?? 'Estimation indisponible.' };
}

/** Petit indicateur : 5 barres qui montent, couleur selon le niveau. */
export function CrowdBadge({ crowd, onClick, busy }: { crowd?: CrowdInfo | null; onClick: () => void; busy?: boolean }) {
  if (!crowd) {
    return <button type="button" className="crowd-badge empty" onClick={onClick} disabled={busy}>{busy ? 'Estimation…' : 'Affluence ?'}</button>;
  }
  const c = COLORS[crowd.level - 1];
  return (
    <button type="button" className="crowd-badge" onClick={onClick} aria-label={`Affluence : ${crowd.label}. Voir les meilleures heures`} style={{ color: TEXT[crowd.level - 1] }}>
      <span className="crowd-bars" aria-hidden="true">{[1, 2, 3, 4, 5].map((i) => <i key={i} style={{ height: 3 + i * 2, background: i <= crowd.level ? c : '#DAD8D1' }} />)}</span>
      {crowd.label}
    </button>
  );
}

/** Détail : courbe heure par heure (6 h → 23 h), meilleur créneau, à éviter. */
export function CrowdSheet({ title, crowd, onClose, onRefresh, busy }: { title: string; crowd: CrowdInfo; onClose: () => void; onRefresh?: () => void; busy?: boolean }) {
  const c = COLORS[crowd.level - 1];
  const max = Math.max(1, ...crowd.hours);
  const best = crowd.hours.reduce((b, v, i) => (v > 0 && (b < 0 || v < crowd.hours[b]) ? i : b), -1);
  return (
    <>
      <div className="sheet-back" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={`Affluence de ${title}`}>
        <p className="mono" style={{ margin: 0 }}>Affluence estimée{crowd.when ? ' · ' + crowd.when : ''}</p>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{title}</h2>
        <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: TEXT[crowd.level - 1] }}>{crowd.label}</p>
        <div className="crowd-chart" role="img" aria-label={`Fréquentation par heure. Le plus calme vers ${best + 6} h.`}>
          {crowd.hours.map((v, i) => (
            <div key={i} className="crowd-col">
              <span style={{ height: `${Math.max(3, (v / max) * 100)}%`, background: v === 0 ? '#ECEAE4' : i === best ? '#1FAF5B' : c, opacity: v === 0 ? 1 : 0.35 + 0.65 * (v / max) }} />
              <small>{(i + 6) % 3 === 0 ? `${i + 6}h` : ''}</small>
            </div>
          ))}
        </div>
        {crowd.best && <p className="crowd-line ok"><b>Le mieux</b> {crowd.best}</p>}
        {crowd.avoid && <p className="crowd-line bad"><b>À éviter</b> {crowd.avoid}</p>}
        {crowd.note && <p className="sub" style={{ margin: 0 }}>{crowd.note}</p>}
        <p className="mono" style={{ margin: 0, textTransform: 'none' }}>Estimation par l’IA selon la saison et le jour, pas une mesure en direct.</p>
        <div className="row">
          {onRefresh && <button className="btn ghost sm" onClick={onRefresh} disabled={busy}>{busy ? 'Estimation…' : 'Réestimer'}</button>}
          <button className="btn sm" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </>
  );
}
