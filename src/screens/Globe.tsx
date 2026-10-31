import { useEffect, useRef } from 'react';
import maplibregl, { type GeoJSONSource } from 'maplibre-gl';
import { cosyStyle } from '../lib/mapstyle';
import 'maplibre-gl/dist/maplibre-gl.css';

export type GlobePin = { id: string; name: string; lat: number; lon: number; color: string };
type Props = {
  pins: GlobePin[];
  photos: { lat: number; lon: number }[];
  focus: string | null;
  onPick?: (id: string) => void;
  home?: { lat: number; lon: number };
};

// Arc (grand cercle) entre la maison et la destination.
function arc(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = Math.PI / 180;
  const v = (p: { lat: number; lon: number }) => [Math.cos(p.lat * R) * Math.cos(p.lon * R), Math.cos(p.lat * R) * Math.sin(p.lon * R), Math.sin(p.lat * R)];
  const A = v(a), B = v(b);
  const om = Math.acos(Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])));
  if (om < 0.01) return [];
  const out: [number, number][] = [];
  for (let i = 0; i <= 64; i++) {
    const t = i / 64, s1 = Math.sin((1 - t) * om) / Math.sin(om), s2 = Math.sin(t * om) / Math.sin(om);
    const x = A[0] * s1 + B[0] * s2, y = A[1] * s1 + B[1] * s2, z = A[2] * s1 + B[2] * s2;
    out.push([Math.atan2(y, x) / R, Math.asin(z) / R]);
  }
  // Évite le saut à ±180° (traversée du Pacifique).
  for (let i = 1; i < out.length; i++) while (out[i][0] - out[i - 1][0] > 180) out[i][0] -= 360;
  for (let i = 1; i < out.length; i++) while (out[i - 1][0] - out[i][0] > 180) out[i][0] += 360;
  return out;
}

function pinEl(p: GlobePin, onPick?: (id: string) => void) {
  const el = document.createElement('button');
  el.className = 'gpin';
  el.style.setProperty('--c', p.color);
  el.setAttribute('aria-label', `Ouvrir ${p.name}`);
  el.innerHTML = `<i></i><span>${p.name.replace(/[<>&]/g, '')}</span>`;
  el.addEventListener('click', (e) => { e.stopPropagation(); onPick?.(p.id); });
  return el;
}

export default function Globe({ pins, photos, focus, onPick, home = { lat: 46.6, lon: 2.3 } }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const ready = useRef(false);
  const touched = useRef(0);
  const latest = useRef({ pins, photos, home, onPick, focus });
  latest.current = { pins, photos, home, onPick, focus };

  const fly = () => {
    const m = map.current; const { pins, focus } = latest.current;
    const p = pins.find((x) => x.id === focus);
    if (!m || !ready.current || !p) return;
    touched.current = performance.now();
    m.flyTo({ center: [p.lon, Math.max(-40, Math.min(50, p.lat))], zoom: 0.95, duration: 1600, essential: true });
  };

  const draw = () => {
    const m = map.current; if (!m || !ready.current) return;
    const { pins, photos, home, onPick } = latest.current;
    (m.getSource('arcs') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: pins.map((p) => ({ type: 'Feature', properties: { color: p.color }, geometry: { type: 'LineString', coordinates: arc(home, p) } }))
    });
    (m.getSource('photos') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: photos.map((p) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } }))
    });
    markers.current.forEach((k) => k.remove());
    markers.current = pins.map((p) => new maplibregl.Marker({ element: pinEl(p, onPick), anchor: 'bottom' }).setLngLat([p.lon, p.lat]).addTo(m));
    const h = document.createElement('span'); h.className = 'ghome'; h.setAttribute('aria-label', 'Maison');
    markers.current.push(new maplibregl.Marker({ element: h }).setLngLat([home.lon, home.lat]).addTo(m));
  };

  useEffect(() => {
    let alive = true, raf = 0;
    cosyStyle('globe').then((style) => {
      if (!alive || !box.current) return;
      const m = new maplibregl.Map({
        container: box.current, style, center: [60, 25], zoom: 0.35, minZoom: 0.1, maxZoom: 14,
        attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, touchPitch: false, renderWorldCopies: false
      });
      m.touchZoomRotate.disableRotation();
      map.current = m;
      const stop = () => { touched.current = performance.now(); };
      m.on('mousedown', stop); m.on('touchstart', stop); m.on('wheel', stop);
      m.on('load', () => {
        m.addSource('arcs', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        m.addSource('photos', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        m.addLayer({ id: 'arcs', type: 'line', source: 'arcs', layout: { 'line-cap': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-opacity': 0.75, 'line-dasharray': [0.1, 2.2] } });
        m.addLayer({ id: 'photos', type: 'circle', source: 'photos', paint: { 'circle-radius': 4, 'circle-color': '#F2B544', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } });
        box.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
        ready.current = true;
        draw(); fly();
      });
      // Rotation douce quand personne ne touche le globe (s'arrête dès qu'on zoome).
      let last = 0;
      const spin = (t: number) => {
        raf = requestAnimationFrame(spin);
        if (t - last < 50) return; last = t;
        if (!ready.current || m.isMoving() || m.getZoom() > 1.5 || t - touched.current < 4000) return;
        const c = m.getCenter(); m.setCenter([c.lng + 0.12, c.lat]);
      };
      raf = requestAnimationFrame(spin);
    }).catch(() => { /* carte indisponible hors ligne : on garde l'emplacement vide */ });
    return () => { alive = false; cancelAnimationFrame(raf); map.current?.remove(); map.current = null; ready.current = false; };
  }, []);

  useEffect(draw, [pins, photos, home.lat, home.lon]);

  useEffect(fly, [focus, pins]);

  return (
    <div ref={box} className="globe" role="region" aria-label={`Globe de vos voyages : ${pins.map((p) => p.name).join(', ') || 'aucun voyage placé'}`} />
  );
}
