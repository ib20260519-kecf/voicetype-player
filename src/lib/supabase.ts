import { createClient } from '@supabase/supabase-js';

// Default / fallback credentials or read from LocalStorage / Env
const metaEnv = (import.meta as any).env || {};
const DEFAULT_SUPABASE_URL = metaEnv.VITE_SUPABASE_URL || localStorage.getItem('vt_supabase_url') || '';
const DEFAULT_SUPABASE_KEY = metaEnv.VITE_SUPABASE_ANON_KEY || localStorage.getItem('vt_supabase_key') || '';

export let supabase = (DEFAULT_SUPABASE_URL && DEFAULT_SUPABASE_KEY)
  ? createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY)
  : null;

export const initSupabaseClient = (url: string, key: string) => {
  if (url && key) {
    localStorage.setItem('vt_supabase_url', url);
    localStorage.setItem('vt_supabase_key', key);
    supabase = createClient(url, key);
    return supabase;
  }
  return null;
};
