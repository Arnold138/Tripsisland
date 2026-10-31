// Petites icônes au trait (pas d'emoji), 24 px, couleur = texte.
const P: Record<string, string> = {
  walk: 'M13 4.5a1.5 1.5 0 1 0 0-.01M10 21l2-6 2.5 2.5V21M8 12l2.5-4h3l2 4 2.5 1M9.5 8 7 13',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  undo: 'M9 7 5 11l4 4M5 11h9a5 5 0 0 1 0 10h-3',
  map: 'M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4zM9 4v13M15 6.5v13',
  days: 'M4 7h16v13H4zM4 11h16M8 3v4M16 3v4',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  chat: 'M4 5h16v11H9l-5 4z',
  now: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  plus: 'M12 5v14M5 12h14',
  pin: 'M12 21s-6-5.7-6-11a6 6 0 0 1 12 0c0 5.3-6 11-6 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  train: 'M7 4h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM5 11h14M8 21l2-4M16 21l-2-4M8.5 14h.01M15.5 14h.01',
  metro: 'M6 18 4 21M18 18l2 3M7 3h10a2 2 0 0 1 2 2v11H5V5a2 2 0 0 1 2-2zM5 11h14',
  back: 'M15 5l-7 7 7 7',
  photo: 'M4 8h3l2-3h6l2 3h3v11H4zM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  send: 'M4 12l16-8-6 16-2-7z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'
};

export default function Icon({ name, size = 20, stroke = 2 }: { name: keyof typeof P | string; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
      <path d={P[name] ?? ''} />
    </svg>
  );
}
