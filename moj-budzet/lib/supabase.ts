// Supabase służy już tylko do jednorazowego przeniesienia danych z dawnego konta do przeglądarki.
// Biblioteka ładuje się dopiero po kliknięciu, więc nie obciąża zwykłego działania aplikacji.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const klucz = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const kontoDostepne = !!(url && klucz);

export async function klientSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url!, klucz!);
}
