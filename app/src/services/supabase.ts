// Client Supabase centralizzato: unico punto che legge le variabili d'ambiente.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configured = Boolean(url && anonKey);

export const supabase = configured ? createClient(url as string, anonKey as string) : null;

export const supabaseUrl = url ?? "";
export const supabaseAnonKey = anonKey ?? "";
