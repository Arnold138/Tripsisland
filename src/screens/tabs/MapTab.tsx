import { useEffect, useRef, useState } from 'react';
import maplibregl, { type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { cosyStyle } from '../../lib/mapstyle';
import { byTime, daysUntil, estimateLeg, fmtMin } from '../../lib/logic';
import type { Activity } from '../../lib/supabase';
import { ActivityCard } from './DaysTab';
import { shortDay, type TripData } from '../Trip';

type Pt = Activity & { lat: number; lon: number };

export default function MapTab({ d, day, setDay }: { d: TripData; day: string | null; setDay: (x: string | null) => void }) {
  const { acts, days, trip } = d;
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marks = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [all, setAll] = useState(false);

  const shown = byTime(acts.filter((a) => (all ? a.day : a.day === day))).sort((a, b) => (a.day ?? '').localeCompare(b.day ?? '')) as Activity[];
  const pts = shown.filter((a): a is Pt => a.lat != null && a.lon != null);
  const missing = shown.length - pts.length;
  const until = trip.start_date ? daysUntil(trip.start_date) : null;
  const legMin = pts.reduce((n, a, i) => (i && a.day === pts[i - 1].day ? n + estimateLeg(pts[i - 1], a).minutes : n), 0);
  const selected = shown.find((a) => a.id === sel) ?? null;

  useEffect(() => {
    let alive = true;
    cosyStyle('city').then((style) => {
      if (!alive || !box.current) return;
      const m = new maplibregl.Map({
        container: box.current, style, center: [trip.lon ?? 139.7, trip.lat ?? 35.68], zoom: trip.lat != null ? 5 : 2,
        attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, touchPitch: false
      });
      m.touchZoomRotate.disableRotation();
      m.on('load', () => {
        box.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
        m.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        m.addLayer({ id: 'route-halo', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#fff', 'line-width': 7 } });
        m.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#0E0E0E', 'line-width': 2.5, 'line-dasharray': [1, 2] } });
        setReady(true);
      });
      m.on('click', () => setSel(null));
      map.current = m;
    }).catch(() => { /* hors ligne */ });
    return () => { alive = false; map.current?.remove(); map.current = null; };
  }, [trip.id]);

  const key = pts.map((p) => p.id + p.lat + p.lon + (p.done ? 1 : 0)).join('|') + sel;
  useEffect(() => {
    const m = map.current; if (!m || !ready) return;
    // Un trait par jour, dans l'ordre des heures.
    const byDay = new Map<string, [number, number][]>();
    pts.forEach((p) => { const k = p.day ?? ''; byDay.set(k, [...(byDay.get(k) ?? []), [p.lon, p.lat]]); });
    (m.getSource('route') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: [...byDay.values()].filter((c) => c.length > 1).map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: c } }))
    });
    marks.current.forEach((k) => k.remove());
    let n = 0, prevDay: string | null = null;
    marks.current = pts.map((p) => {
      n = p.day === prevDay ? n + 1 : 1; prevDay = p.day;
      const el = document.createElement('button');
      el.className = 'mpin' + (p.done ? ' done' : '') + (p.id === sel ? ' sel' : '') + (p.created_by && p.created_by !== d.ctx.me.id ? ' partner' : '');
      el.textContent = all ? shortDay(p.day!).split(' ')[1] : String(n);
      el.setAttribute('aria-label', p.title);
      el.addEventListener('click', (e) => { e.stopPropagation(); setSel(p.id); });
      return new maplibregl.Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(m);
    });
    if (pts.length && !sel) {
      const b = new maplibregl.LngLatBounds();
      pts.forEach((p) => b.extend([p.lon, p.lat]));
      m.fitBounds(b, { padding: { top: 110, bottom: 70, left: 50, right: 50 }, maxZoom: 15, duration: 700 });
    }
  }, [key, ready, all]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="tab-body map-tab" aria-label="Carte du voyage">
      <div className="map-box">
        <div ref={box} style={{ position: 'absolute', inset: 0 }} />
        <div className="map-top">
          <div className="days" role="group" aria-label="Jour affiché sur la carte">
            <button className="chip sm" aria-pressed={all} onClick={() => { setAll(true); setSel(null); }}>Tout</button>
            {days.map((x) => (
              <button key={x} className="chip sm" aria-pressed={!all && day === x} onClick={() => { setAll(false); setDay(x); setSel(null); }}>{shortDay(x)}</button>
            ))}
          </div>
          <p className="map-info">
            {until != null && until > 0 && <b>Dans {until} jours · </b>}
            {pts.length ? `${pts.length} lieu${pts.length > 1 ? 'x' : ''}${legMin ? ` · ≈ ${fmtMin(legMin)} de trajets` : ''}` : 'Aucun lieu ce jour-là'}
            {missing > 0 && ` · ${missing} sans adresse`}
          </p>
        </div>
      </div>
      {selected ? (
        <div className="map-card"><ActivityCard a={selected} d={d} from={(() => { const i = shown.indexOf(selected); return i > 0 && shown[i - 1].day === selected.day ? shown[i - 1] : null; })()} /></div>
      ) : (
        <p className="mono" style={{ textAlign: 'center', margin: '10px 0 0', textTransform: 'none' }}>Touchez un numéro pour voir l’activité et lancer l’itinéraire.</p>
      )}
    </section>
  );
}
