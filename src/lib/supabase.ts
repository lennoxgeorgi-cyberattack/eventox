import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null | undefined;

export function supabaseConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";
  return { url, anonKey, ready: Boolean(url && anonKey) };
}

export function supabaseBrowser() {
  if (browserClient !== undefined) return browserClient;
  const { url, anonKey, ready } = supabaseConfig();
  browserClient = ready ? createClient(url, anonKey) : null;
  return browserClient;
}

export function serverSupabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  return { url, anonKey, serviceKey };
}

export function supabaseAsUser(accessToken: string) {
  const { url, anonKey } = serverSupabaseConfig();
  if (!url || !anonKey || !accessToken) return null;
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function supabaseService() {
  const { url, serviceKey } = serverSupabaseConfig();
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function supabasePublic() {
  const { url, anonKey } = serverSupabaseConfig();
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
