import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { registerSW } from 'virtual:pwa-register';

// Mise à jour automatique : l'iPhone vérifie une nouvelle version à chaque retour dans l'app et chaque minute.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    setInterval(() => reg.update(), 60_000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update(); });
  }
});

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
