'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { zbudujKategorie, type Kategoria, type Kategorie } from '../lib/budzet';
import { regulyZPrzegladarki } from '../lib/kategoryzacja';

// Własne kategorie i nauczone reguły trzymamy w user_metadata konta Supabase:
// synchronizują się między urządzeniami i nie wymagają nowej tabeli w bazie.
const MAX_REGUL = 400; // metadata trafia do tokenu sesji, więc nie może rosnąć bez końca

type Kontekst = Kategorie & {
  reguly: Record<string, string>;
  zapiszWlasne: (wlasne: Kategoria[]) => Promise<string | null>;
  dodajReguly: (nowe: Record<string, string>) => Promise<void>;
};

const KategorieContext = createContext<Kontekst | null>(null);

export function KategorieProvider({ children }: { children: React.ReactNode }) {
  const [wlasne, setWlasne] = useState<Kategoria[]>([]);
  const [reguly, setReguly] = useState<Record<string, string>>({});

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const meta = session?.user?.user_metadata ?? {};
      setWlasne(Array.isArray(meta.kategorie) ? meta.kategorie : []);
      const naKoncie = meta.reguly_kategorii ?? {};
      setReguly(naKoncie);

      // Jednorazowo przenosimy reguły zapisane wcześniej w przeglądarce
      const zPrzegladarki = regulyZPrzegladarki();
      if (event === 'INITIAL_SESSION' && session && Object.keys(zPrzegladarki).length && !meta.reguly_kategorii) {
        supabase.auth.updateUser({ data: { reguly_kategorii: { ...zPrzegladarki, ...naKoncie } } }).then(({ error }) => {
          if (!error) try { localStorage.removeItem('moj_budzet_reguly_kategorii'); } catch {}
        });
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const zapiszWlasne = useCallback(async (nowe: Kategoria[]) => {
    const { error } = await supabase.auth.updateUser({ data: { kategorie: nowe } });
    if (error) return error.message;
    setWlasne(nowe);
    return null;
  }, []);

  const dodajReguly = useCallback(async (nowe: Record<string, string>) => {
    if (Object.keys(nowe).length === 0) return;
    // Nowsze reguły na koniec; przy przekroczeniu limitu wypadają najstarsze
    const polaczone = Object.entries({ ...reguly, ...nowe }).slice(-MAX_REGUL);
    const wynik = Object.fromEntries(polaczone);
    setReguly(wynik);
    await supabase.auth.updateUser({ data: { reguly_kategorii: wynik } });
  }, [reguly]);

  const wartosc = useMemo(
    () => ({ ...zbudujKategorie(wlasne), reguly, zapiszWlasne, dodajReguly }),
    [wlasne, reguly, zapiszWlasne, dodajReguly]
  );

  return <KategorieContext.Provider value={wartosc}>{children}</KategorieContext.Provider>;
}

export function useKategorie() {
  const kontekst = useContext(KategorieContext);
  if (!kontekst) throw new Error('useKategorie musi być użyte wewnątrz KategorieProvider');
  return kontekst;
}
