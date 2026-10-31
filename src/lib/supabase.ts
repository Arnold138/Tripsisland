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
export type Activity = {
  id: string; trip_id: string; day: string | null; time: string | null; title: string; place_id: string | null;
  address: string | null; lat: number | null; lon: number | null; notes: string | null; tag: string | null; done: boolean;
  created_by: string | null;
};
export type Idea = {
  id: string; trip_id: string; title: string; city: string | null; why: string | null; tag: string | null;
  price: string | null; duration: string | null; query: string | null; matched: boolean;
};
export type Place = { id: string; name: string; address: string; lat: number | null; lon: number | null; status: string | null; type: string | null };
export type Swipe = { idea_id: string; user_id: string; vote: 'yes' | 'no' };
