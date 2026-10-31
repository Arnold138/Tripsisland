import type { StyleSpecification } from 'maplibre-gl';

// Carte gratuite et sans clé (OpenFreeMap). Palette « cosy » : terre crème, mer sauge, parcs vert tendre.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
const PALETTE = { land: '#F4EEE3', water: '#B9D3D2', park: '#DCE4C9', ice: '#FBF9F4', border: '#CDBFA9', label: '#8A7D6B', halo: '#F4EEE3', road: '#FFFFFF' };

let cache: StyleSpecification | null = null;

/** globe : vue du monde sans noms. city : carte de ville avec rues, gares et noms de quartiers. */
export async function cosyStyle(kind: 'globe' | 'city'): Promise<StyleSpecification> {
  cache ??= (await (await fetch(STYLE_URL)).json()) as StyleSpecification;
  const s = structuredClone(cache);
  if (kind === 'globe') {
    s.projection = { type: 'globe' };
    s.sky = { 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.6, 5, 0.2, 7, 0] } as StyleSpecification['sky'];
  }
  s.layers = s.layers.filter((l) => {
    if (kind === 'globe') return l.type !== 'symbol' && !/railway|aeroway|tunnel|building|bridge|pier|boundary_3|boundary_disputed/.test(l.id);
    // En ville : on garde rues, voies ferrées et noms utiles ; on retire les panneaux routiers.
    return !/shield|aeroway|boundary_disputed|highway-name-path/.test(l.id);
  });
  for (const l of s.layers) {
    const p = (l.paint ??= {}) as Record<string, unknown>;
    if (l.id === 'background') p['background-color'] = PALETTE.land;
    else if (l.id === 'water') p['fill-color'] = PALETTE.water;
    else if (l.id === 'waterway') p['line-color'] = PALETTE.water;
    else if (l.id === 'park' || l.id === 'landcover_wood') { p['fill-color'] = PALETTE.park; p['fill-opacity'] = 0.8; }
    else if (l.id.startsWith('landcover_')) p['fill-color'] = PALETTE.ice;
    else if (l.id === 'landuse_residential') p['fill-opacity'] = 0;
    else if (l.id === 'building') p['fill-color'] = '#EDE5D6';
    else if (l.id.startsWith('boundary')) { p['line-color'] = PALETTE.border; delete p['line-dasharray']; }
    else if (/^railway/.test(l.id) && l.type === 'line') p['line-color'] = '#C9B9A2';
    else if (/^highway_.*(inner|minor|subtle)$/.test(l.id) && l.type === 'line') p['line-color'] = PALETTE.road;
    else if (l.type === 'symbol') { p['text-color'] = PALETTE.label; p['text-halo-color'] = PALETTE.halo; p['text-halo-width'] = 1.4; }
  }
  return s;
}
