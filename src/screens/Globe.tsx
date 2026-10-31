import { useEffect, useMemo, useRef, useState } from 'react';
import { LAND } from '../lib/land';

export type GlobePin = { id: string; name: string; lat: number; lon: number; color: string };
type Props = { pins: GlobePin[]; photos: { lat: number; lon: number }[]; focus: string | null; home?: { lat: number; lon: number } };

const R = Math.PI / 180;
const SIZE = 340, CX = SIZE / 2, CY = SIZE / 2, RAD = 150;

// Points de terre (vrais continents, grille de 3°), espacés selon la latitude.
function landPoints() {
  const pts: { la: number; lo: number; lat: number; lon: number }[] = [];
  LAND.split('|').forEach((row, i) => {
    const lat = 84 - i * 3;
    const k = Math.max(1, Math.round(1 / Math.max(0.2, Math.cos(lat * R))));
    const bits = row.split('').map((h) => parseInt(h, 16).toString(2).padStart(4, '0')).join('');
    for (let j = 0; j < 120; j++) if (bits[j] === '1' && j % k === 0) {
      const lon = -180 + j * 3;
      pts.push({ la: lat * R, lo: lon * R, lat, lon });
    }
  });
  return pts;
}

export default function Globe({ pins, photos, focus, home = { lat: 46.6, lon: 2.3 } }: Props) {
  const pts = useMemo(landPoints, []);
  const [view, setView] = useState({ lon: 60, lat: 22 });
  const target = useRef<{ lon: number; lat: number } | null>(null);
  const drag = useRef<{ x: number; y: number; lon: number; lat: number } | null>(null);
  const idle = useRef(0);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const p = pins.find((x) => x.id === focus);
    if (p) target.current = { lon: p.lon, lat: Math.max(-35, Math.min(45, p.lat)) };
  }, [focus, pins]);

  useEffect(() => {
    let raf = 0, last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 40) return; // ~25 images/s, léger pour la batterie
      last = t;
      setPhase((p) => (p + 0.015) % 1);
      if (drag.current) return;
      setView((v) => {
        const tg = target.current;
        if (tg) {
          const d = ((tg.lon - v.lon + 540) % 360) - 180;
          if (Math.abs(d) < 0.3 && Math.abs(tg.lat - v.lat) < 0.3) { target.current = null; idle.current = t; return v; }
          return { lon: v.lon + d * 0.1, lat: v.lat + (tg.lat - v.lat) * 0.1 };
        }
        return t - idle.current > 3000 ? { ...v, lon: v.lon + 0.25 } : v;
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const l0 = view.lon * R, p0 = view.lat * R, sp = Math.sin(p0), cp = Math.cos(p0);
  const proj = (la: number, lo: number, lift = 1) => {
    const cl = Math.cos(la), d = lo - l0;
    return { x: CX + RAD * lift * cl * Math.sin(d), y: CY - RAD * lift * (cp * Math.sin(la) - sp * cl * Math.cos(d)), z: sp * Math.sin(la) + cp * cl * Math.cos(d) };
  };
  const near = (lat: number, lon: number) => pins.find((p) => Math.abs(lat - p.lat) < 12 && Math.abs(((lon - p.lon + 540) % 360) - 180) < 18);

  const vec = (lat: number, lon: number) => [Math.cos(lat * R) * Math.cos(lon * R), Math.cos(lat * R) * Math.sin(lon * R), Math.sin(lat * R)];
  const arc = (p: GlobePin) => {
    const a = vec(home.lat, home.lon), b = vec(p.lat, p.lon);
    const om = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
    if (om < 0.01) return { d: '', m: null as null | { x: number; y: number } };
    let d = '', pen = false, m: null | { x: number; y: number } = null;
    for (let s = 0; s <= 40; s++) {
      const t = s / 40, s1 = Math.sin((1 - t) * om) / Math.sin(om), s2 = Math.sin(t * om) / Math.sin(om);
      const v = [a[0] * s1 + b[0] * s2, a[1] * s1 + b[1] * s2, a[2] * s1 + b[2] * s2];
      const q = proj(Math.asin(v[2]), Math.atan2(v[1], v[0]), 1 + 0.15 * Math.sin(Math.PI * t));
      if (q.z > -0.1) { d += (pen ? 'L' : 'M') + q.x.toFixed(1) + ' ' + q.y.toFixed(1); pen = true; } else pen = false;
      if (s === Math.round(phase * 40) && q.z > -0.1) m = q;
    }
    return { d, m };
  };

  const onDown = (e: React.PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, ...view }; target.current = null; (e.target as Element).setPointerCapture?.(e.pointerId); };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    setView({ lon: d.lon - (e.clientX - d.x) * 0.4, lat: Math.max(-60, Math.min(70, d.lat + (e.clientY - d.y) * 0.4)) });
  };
  const onUp = () => { drag.current = null; idle.current = performance.now(); };

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" style={{ maxWidth: 380, display: 'block', margin: '0 auto', touchAction: 'none' }}
      role="img" aria-label={`Globe de vos voyages : ${pins.map((p) => p.name).join(', ')}`}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <defs>
        <radialGradient id="gOcean" cx="0.38" cy="0.32" r="0.78"><stop offset="0" stopColor="#3D6BFF" /><stop offset="0.6" stopColor="#1A3FBF" /><stop offset="1" stopColor="#0B1E66" /></radialGradient>
        <radialGradient id="gAtmo" cx="0.5" cy="0.5" r="0.5"><stop offset="0.84" stopColor="#6E8FFF" stopOpacity="0" /><stop offset="0.9" stopColor="#6E8FFF" stopOpacity="0.35" /><stop offset="1" stopColor="#6E8FFF" stopOpacity="0" /></radialGradient>
        <radialGradient id="gShine" cx="0.32" cy="0.26" r="0.45"><stop offset="0" stopColor="#fff" stopOpacity="0.35" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
      </defs>
      <circle cx={CX} cy={CY} r={RAD + 22} fill="url(#gAtmo)" />
      <circle cx={CX} cy={CY} r={RAD} fill="url(#gOcean)" />
      {pts.map((p, i) => {
        const q = proj(p.la, p.lo);
        if (q.z <= 0.02) return null;
        const pin = near(p.lat, p.lon);
        const c = pin ? pin.color : Math.abs(p.lat) > 60 ? '#E8F1FF' : Math.abs(p.lat) < 25 ? '#5BE08D' : '#34C46E';
        return <circle key={i} cx={q.x} cy={q.y} r={1.05 + q.z} fill={c} fillOpacity={0.25 + 0.75 * q.z} />;
      })}
      <circle cx={CX} cy={CY} r={RAD} fill="url(#gShine)" />
      <circle cx={CX} cy={CY} r={RAD} fill="none" stroke="#9DB4FF" strokeOpacity="0.5" />
      {photos.map((ph, i) => { const q = proj(ph.lat * R, ph.lon * R); return q.z > 0.05 ? <circle key={'ph' + i} cx={q.x} cy={q.y} r={2.2} fill="#FFD23F" stroke="#fff" strokeWidth="0.8" /> : null; })}
      {pins.map((p) => { const a = arc(p); return (
        <g key={'a' + p.id}>
          {a.d && <path d={a.d} fill="none" stroke={p.color} strokeWidth="2" strokeLinecap="round" strokeDasharray="1 5" />}
          {a.m && <circle cx={a.m.x} cy={a.m.y} r="3" fill="#fff" stroke={p.color} strokeWidth="2" />}
        </g>
      ); })}
      {pins.map((p) => {
        const q = proj(p.lat * R, p.lon * R);
        if (q.z < 0.08) return null;
        const on = p.id === focus;
        return (
          <g key={'p' + p.id} transform={`translate(${q.x.toFixed(1)} ${q.y.toFixed(1)})`}>
            <circle r="10" fill="none" stroke={p.color} strokeWidth="1.5"><animate attributeName="r" values="6;22" dur="2.2s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.9;0" dur="2.2s" repeatCount="indefinite" /></circle>
            <circle r={on ? 7 : 5} fill={p.color} stroke="#fff" strokeWidth="2.5" />
            {on && <g transform="translate(12 -30)"><rect rx="9" height="22" width={p.name.length * 7.4 + 18} fill="#fff" /><text x="9" y="15" fontSize="12" fontWeight="600" fill="#0E0E0E" fontFamily="Inter Tight, sans-serif">{p.name}</text></g>}
          </g>
        );
      })}
      {(() => { const q = proj(home.lat * R, home.lon * R); return q.z > 0.08 ? <circle cx={q.x} cy={q.y} r="4" fill="#fff" stroke="#0E0E0E" strokeWidth="2" /> : null; })()}
    </svg>
  );
}
