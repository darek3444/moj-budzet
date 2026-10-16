'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { zbudujKategorie, type Kategoria, type Kategorie } from '../lib/budzet';
import { regulyZPrzegladarki } from '../lib/kategoryzacja';
import * as magazyn from '../lib/magazyn';
import { uruchom } from '../lib/synchronizacja';

const MAX_REGUL = 1000;
const BRAK_KATEGORII: Kategoria[] = [];
const BRAK_REGUL: Record<string, string> = {};

type Kontekst = Kategorie & {
  reguly: Record<string, string>;
  zapiszWlasne: (wlasne: Kategoria[]) => Promise<string | null>;
  dodajReguly: (nowe: Record<string, string>) => Promise<void>;
};

const KategorieContext = createContext<Kontekst | null>(null);

export function KategorieProvider({ children }: { children: React.ReactNode }) {
  const wlasne = useSyncExternalStore(magazyn.subskrybuj, magazyn.wlasneKategorie, () => BRAK_KATEGORII);
  const reguly = useSyncExternalStore(magazyn.subskrybuj, magazyn.reguly, () => BRAK_REGUL);

  // Start synchronizacji z kontem (jeśli ktoś jest zalogowany) – w tle, bez blokowania widoków
  useEffect(() => { uruchom(); }, []);

  // Reguły z pierwszej wersji (osobny klucz w przeglądarce) dołączamy jednorazowo do magazynu
  useEffect(() => {
    const stare = regulyZPrzegladarki();
    if (Object.keys(stare).length === 0) return;
    if (!magazyn.zapiszReguly({ ...stare, ...magazyn.reguly() }).error) {
      try { localStorage.removeItem('moj_budzet_reguly_kategorii'); } catch {}
    }
  }, []);

  const zapiszWlasne = useCallback(async (nowe: Kategoria[]) => magazyn.zapiszWlasneKategorie(nowe).error?.message ?? null, []);

  const dodajReguly = useCallback(async (nowe: Record<string, string>) => {
    if (Object.keys(nowe).length === 0) return;
    // Nowsze reguły na koniec; przy przekroczeniu limitu wypadają najstarsze
    magazyn.zapiszReguly(Object.fromEntries(Object.entries({ ...magazyn.reguly(), ...nowe }).slice(-MAX_REGUL)));
  }, []);

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
