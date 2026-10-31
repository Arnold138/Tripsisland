import { useCallback, useEffect, useState } from 'react';
import { readMeta } from '../lib/photo';
import { supabase, type Photo } from '../lib/supabase';

// Réduit fortement la photo (1280 px max, JPEG 0,7 ≈ 150 à 300 Ko) pour rester dans le stockage gratuit.
async function compress(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('compression'))), 'image/jpeg', 0.7));
}

export default function Photos({ tripId }: { tripId: string }) {
  const [photos, setPhotos] = useState<(Photo & { url?: string })[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<(Photo & { url?: string }) | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('photos').select('*').eq('trip_id', tripId).order('taken_at', { ascending: true, nullsFirst: false });
    const list = (data ?? []) as Photo[];
    if (!list.length) { setPhotos([]); return; }
    const { data: urls } = await supabase.storage.from('photos').createSignedUrls(list.map((p) => p.path), 3600);
    setPhotos(list.map((p, i) => ({ ...p, url: urls?.[i]?.signedUrl ?? undefined })));
  }, [tripId]);

  useEffect(() => {
    load();
    const ch = supabase.channel('photos-' + tripId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photos', filter: `trip_id=eq.${tripId}` }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tripId, load]);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    let withGps = 0, done = 0;
    for (const f of Array.from(files).slice(0, 60)) {
      setBusy(`Envoi ${++done} / ${Math.min(files.length, 60)}…`);
      try {
        const meta = await readMeta(f);
        const blob = await compress(f);
        const path = `${tripId}/${crypto.randomUUID()}.jpg`;
        const up = await supabase.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' });
        if (up.error) continue;
        if (meta.lat != null) withGps++;
        await supabase.from('photos').insert({
          trip_id: tripId, path, lat: meta.lat, lon: meta.lon, taken_at: meta.taken_at
        });
      } catch { /* photo illisible : on passe à la suivante */ }
    }
    setBusy(`${done} photo${done > 1 ? 's' : ''} ajoutée${done > 1 ? 's' : ''} · ${withGps} avec lieu GPS`);
    load();
  };
  const remove = async (p: Photo) => {
    await supabase.storage.from('photos').remove([p.path]);
    await supabase.from('photos').delete().eq('id', p.id);
    setOpen(null);
  };

  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label className="btn" style={{ cursor: 'pointer' }}>
        + Ajouter des photos (compressées)
        <input type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      </label>
      <p className="mono" style={{ margin: 0, textTransform: 'none' }}>{busy ?? 'Le lieu et la date de chaque photo s’affichent sur le globe, chez vous deux. Sur iPhone : dans le choix des photos, touchez « Options » et activez « Lieu ».'}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4 }}>
        {photos.map((p) => (
          <button key={p.id} onClick={() => setOpen(p)} style={{ border: 0, padding: 0, aspectRatio: '1', borderRadius: 10, overflow: 'hidden', background: '#E4E2DC', position: 'relative' }} aria-label="Voir la photo">
            {p.url && <img src={p.url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            {p.lat != null && <span className="dot" style={{ position: 'absolute', right: 6, top: 6, background: '#FFD23F', boxShadow: '0 0 0 2px #fff' }} />}
          </button>
        ))}
      </div>
      {photos.length === 0 && !busy && <p className="sub" style={{ textAlign: 'center' }}>Pas encore de souvenirs pour ce voyage.</p>}
      {open && (
        <div role="dialog" aria-label="Photo" style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(14,14,14,.92)', display: 'flex', flexDirection: 'column', padding: 'calc(env(safe-area-inset-top) + 16px) 16px calc(env(safe-area-inset-bottom) + 16px)', gap: 12 }}>
          <img src={open.url} alt="" style={{ flex: 1, minHeight: 0, objectFit: 'contain', width: '100%' }} />
          <p className="mono" style={{ color: '#D6D4CD', textAlign: 'center', margin: 0 }}>
            {open.taken_at ? new Date(open.taken_at).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }) : 'Date inconnue'}{open.lat != null ? ' · lieu GPS enregistré' : ' · sans lieu GPS'}
          </p>
          <div className="row">
            <button className="btn ghost sm" onClick={() => setOpen(null)}>Fermer</button>
            <button className="btn danger sm" onClick={() => remove(open)}>Supprimer</button>
          </div>
        </div>
      )}
    </div>
  );
}
