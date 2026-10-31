import { createClient } from '@supabase/supabase-js';

// Clé publiable : prévue pour le navigateur, les données sont protégées par RLS.
const url = 'https://hoegrbocscopeautmsvh.supabase.co';
const key = 'sb_publishable_E2GLnC_Icf0Df0asHix4VQ_MW8012W_';

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

export type Profile = { id: string; name: string | null; avatar_url: string | null; tastes: string[]; pace: 'calme' | 'eq' | 'intense' };
export type Island = { id: string; name: string; invite_code: string; created_by: string };
export type Trip = {
  id: string; island_id: string; title: string; country: string | null;
  start_date: string | null; end_date: string | null; status: 'upcoming' | 'past'; color: string;
};
