'use client';

import useSWR from 'swr';
import { supabase } from './supabase';
import type { Transakcja } from './budzet';

const KOLUMNY = 'id, nazwa, kwota, typ, kategoria, data_transakcji, notatki';
const ROZMIAR_STRONY = 1000;

// Supabase zwraca domyślnie max 1000 wierszy na zapytanie – dociągamy kolejne strony,
// inaczej przy większej historii bilanse po cichu by się nie zgadzały.
async function pobierzTransakcje(): Promise<Transakcja[]> {
  const wszystkie: Transakcja[] = [];
  for (let od = 0; ; od += ROZMIAR_STRONY) {
    const { data, error } = await supabase
      .from('transactions')
      .select(KOLUMNY)
      .order('data_transakcji', { ascending: false })
      .order('id', { ascending: false })
      .range(od, od + ROZMIAR_STRONY - 1);
    if (error) throw error;
    wszystkie.push(...(data as Transakcja[]));
    if (data.length < ROZMIAR_STRONY) return wszystkie;
  }
}

// Wspólny klucz dla wszystkich stron: dane pobierają się raz, a mutate() odświeża je wszędzie
export function useTransakcje() {
  return useSWR('transakcje', pobierzTransakcje);
}
