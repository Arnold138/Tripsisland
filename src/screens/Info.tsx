import { useState } from 'react';
import { paragraphs } from '../lib/logic';
import Icon from './Icon';

/** Fiche « Pourquoi » : explique un choix du programme pour ne pas l'oublier. */
export function InfoSheet({ kicker, title, text, onClose }: { kicker: string; title: string; text: string; onClose: () => void }) {
  return (
    <>
      <div className="sheet-back" onClick={onClose} />
      <section className="sheet info-sheet" role="dialog" aria-label={`Pourquoi : ${title}`}>
        <p className="mono" style={{ margin: 0 }}>{kicker}</p>
        <h2>{title}</h2>
        {paragraphs(text).map((p, i) => <p key={i} className="info-p">{p}</p>)}
        <button className="btn ghost" onClick={onClose}>Compris</button>
      </section>
    </>
  );
}

/** Petit bouton « i » qui ouvre l'explication. N'apparaît que s'il y a quelque chose à dire. */
export default function InfoButton({ kicker, title, text, label = 'Pourquoi' }: { kicker: string; title: string; text?: string | null; label?: string }) {
  const [open, setOpen] = useState(false);
  if (!text?.trim()) return null;
  return (
    <>
      <button className="info-btn" onClick={(e) => { e.stopPropagation(); setOpen(true); }} aria-label={`${label} : ${title}`}>
        <Icon name="info" size={16} /><span>{label}</span>
      </button>
      {open && <InfoSheet kicker={kicker} title={title} text={text} onClose={() => setOpen(false)} />}
    </>
  );
}
