'use client';

import { useSyncExternalStore } from 'react';
import { subskrybuj, transakcje } from './magazyn';
import type { Transakcja } from './budzet';

const BRAK: Transakcja[] = [];
const nic = () => () => {};

// Transakcje z lokalnego magazynu; komponenty odświeżają się same po każdej zmianie (także z innej karty)
export function useTransakcje() {
  const data = useSyncExternalStore(subskrybuj, transakcje, () => BRAK);
  // Przy prerenderze i pierwszym renderze po stronie klienta localStorage jeszcze nie jest czytany
  const gotowe = useSyncExternalStore(nic, () => true, () => false);
  return { data, isLoading: !gotowe };
}
