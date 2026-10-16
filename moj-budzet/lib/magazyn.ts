'use client';

// Lokalny magazyn danych: transakcje, własne kategorie i nauczone reguły leżą w localStorage.
// To źródło prawdy dla widoków – aplikacja działa bez konta i bez internetu.
// Po zalogowaniu lib/synchronizacja.ts dostaje informację o każdej zmianie i wysyła ją w tle.
// API zwraca { error } jak wcześniej Supabase, więc miejsca wywołań zostały prawie bez zmian.

import type { Kategoria, Transakcja } from './budzet';

const KLUCZ = 'moj_budzet_dane_v1';
const KLUCZ_LIMITOW = 'moj_budzet_limity';

type Dane = { wersja: 1; transakcje: Transakcja[]; kategorie: Kategoria[]; reguly: Record<string, string> };
type Wynik = { error: { message: string } | null };

const pusteDane = (): Dane => ({ wersja: 1, transakcje: [], kategorie: [], reguly: {} });

// Co się zmieniło – dla synchronizacji (zapisane: nowe lub zmienione transakcje)
export type Zmiana = { zapisane?: string[]; usuniete?: string[]; meta?: boolean };
let sluchaczZmian: ((z: Zmiana) => void) | null = null;
export const ustawSluchaczaZmian = (f: ((z: Zmiana) => void) | null) => { sluchaczZmian = f; };

let pamiec: Dane | null = null;
let posortowane: Transakcja[] = [];
const sluchacze = new Set<() => void>();

const sortuj = (t: Transakcja[]) =>
  [...t].sort((a, b) => b.data_transakcji.localeCompare(a.data_transakcji) || b.id.localeCompare(a.id));

function dane(): Dane {
  if (pamiec) return pamiec;
  try {
    const surowe = localStorage.getItem(KLUCZ);
    pamiec = surowe ? { ...pusteDane(), ...JSON.parse(surowe) } : pusteDane();
  } catch {
    pamiec = pusteDane();
  }
  posortowane = sortuj(pamiec!.transakcje);
  return pamiec!;
}

function zapisz(zmiana: (d: Dane) => Dane, zdarzenie?: () => Zmiana): Wynik {
  const nowe = zmiana(dane());
  try {
    localStorage.setItem(KLUCZ, JSON.stringify(nowe));
  } catch {
    return { error: { message: 'Brak miejsca w pamięci przeglądarki. Pobierz kopię zapasową i usuń stare transakcje.' } };
  }
  if (nowe.transakcje !== pamiec?.transakcje) posortowane = sortuj(nowe.transakcje);
  pamiec = nowe;
  if (zdarzenie) sluchaczZmian?.(zdarzenie());
  sluchacze.forEach(f => f());
  return { error: null };
}

if (typeof window !== 'undefined') {
  // Zmiany z innej karty
  window.addEventListener('storage', e => {
    if (e.key === KLUCZ || e.key === null) { pamiec = null; dane(); sluchacze.forEach(f => f()); }
  });
  // Prosimy przeglądarkę, żeby nie czyściła danych przy braku miejsca na dysku
  navigator.storage?.persist?.().catch(() => {});
}

export const subskrybuj = (f: () => void) => { sluchacze.add(f); return () => { sluchacze.delete(f); }; };

// --- odczyt (stabilne referencje dla useSyncExternalStore) ---
export const transakcje = () => { dane(); return posortowane; };
export const wlasneKategorie = () => dane().kategorie;
export const reguly = () => dane().reguly;

// --- transakcje ---
const noweId = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);

type NowaTransakcja = Omit<Transakcja, 'id' | 'notatki'> & { notatki?: string | null };

export const dodajTransakcje = (nowe: NowaTransakcja[]): Wynik => {
  const zId = nowe.map(t => ({ ...t, notatki: t.notatki ?? null, kwota: Number(t.kwota), id: noweId() }));
  return zapisz(d => ({ ...d, transakcje: [...d.transakcje, ...zId] }), () => ({ zapisane: zId.map(t => t.id) }));
};

export const edytujTransakcje = (id: string, zmiany: Partial<Transakcja>): Wynik =>
  zapisz(d => ({ ...d, transakcje: d.transakcje.map(t => t.id === id ? { ...t, ...zmiany, id } : t) }), () => ({ zapisane: [id] }));

export const usunTransakcje = (ids: string[]): Wynik => {
  const doUsuniecia = new Set(ids);
  return zapisz(d => ({ ...d, transakcje: d.transakcje.filter(t => !doUsuniecia.has(t.id)) }), () => ({ usuniete: ids }));
};

export const ustawKategorie = (ids: string[], kategoria: string): Wynik => {
  const wybrane = new Set(ids);
  return zapisz(d => ({ ...d, transakcje: d.transakcje.map(t => wybrane.has(t.id) ? { ...t, kategoria } : t) }), () => ({ zapisane: ids }));
};

export const zamienKategorie = (z: string, na: string): Wynik => {
  const dotyczy = dane().transakcje.filter(t => t.kategoria === z).map(t => t.id);
  return ustawKategorie(dotyczy, na);
};

// --- kategorie i reguły ---
export const zapiszWlasneKategorie = (kategorie: Kategoria[]): Wynik => zapisz(d => ({ ...d, kategorie }), () => ({ meta: true }));
export const zapiszReguly = (nowe: Record<string, string>): Wynik => zapisz(d => ({ ...d, reguly: nowe }), () => ({ meta: true }));

// --- dla synchronizacji: zmiany przychodzące z serwera, bez zgłaszania ich z powrotem ---
export const zastapDane = (nowe: Omit<Dane, 'wersja'>): Wynik => zapisz(() => ({ wersja: 1, ...nowe }));

// Po wysłaniu nowej transakcji baza nadaje jej własne id
export const zmienId = (mapa: Map<string, string>): Wynik =>
  zapisz(d => ({ ...d, transakcje: d.transakcje.map(t => mapa.has(t.id) ? { ...t, id: mapa.get(t.id)! } : t) }));

export const wyczyscDane = (): Wynik => zapisz(() => pusteDane());

export const pobierzDane = () => dane();

// --- kopia zapasowa ---
export function kopiaZapasowa() {
  let limity: unknown = [];
  try { limity = JSON.parse(localStorage.getItem(KLUCZ_LIMITOW) || '[]'); } catch {}
  return { aplikacja: 'moj-budzet', utworzono: new Date().toISOString(), ...dane(), limity };
}

// Dołącza dane z kopii lub z konta: transakcje o tym samym id są pomijane, kategorie i reguły scalane
export function wczytajDane(zrodlo: { transakcje?: unknown; kategorie?: unknown; reguly?: unknown; limity?: unknown }): Wynik & { dodano: number } {
  const lista = Array.isArray(zrodlo.transakcje) ? zrodlo.transakcje : null;
  if (!lista) return { error: { message: 'Plik nie wygląda na kopię Mojego Budżetu.' }, dodano: 0 };

  const poprawne: Transakcja[] = lista.flatMap((t: any) =>
    t && typeof t.nazwa === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.data_transakcji) && (t.typ === 'przychod' || t.typ === 'wydatek') && !isNaN(Number(t.kwota))
      ? [{ id: String(t.id ?? noweId()), nazwa: t.nazwa, kwota: Number(t.kwota), typ: t.typ, kategoria: t.kategoria ?? null, data_transakcji: t.data_transakcji, notatki: t.notatki ?? null }]
      : []);

  let dodano = 0;
  let dodaneId: string[] = [];
  const wynik = zapisz(d => {
    const istniejace = new Set(d.transakcje.map(t => t.id));
    const nowe = poprawne.filter(t => !istniejace.has(t.id));
    dodano = nowe.length;
    dodaneId = nowe.map(t => t.id);
    const kategorieZrodla = Array.isArray(zrodlo.kategorie) ? zrodlo.kategorie as Kategoria[] : [];
    const znaneKategorie = new Set(d.kategorie.map(k => k.id));
    return {
      ...d,
      transakcje: [...d.transakcje, ...nowe],
      kategorie: [...d.kategorie, ...kategorieZrodla.filter(k => k?.id && !znaneKategorie.has(k.id))],
      reguly: { ...(zrodlo.reguly && typeof zrodlo.reguly === 'object' ? zrodlo.reguly as Record<string, string> : {}), ...d.reguly },
    };
  }, () => ({ zapisane: dodaneId, meta: true }));

  if (!wynik.error && Array.isArray(zrodlo.limity) && zrodlo.limity.length) {
    try { if (!localStorage.getItem(KLUCZ_LIMITOW)) localStorage.setItem(KLUCZ_LIMITOW, JSON.stringify(zrodlo.limity)); } catch {}
  }
  return { ...wynik, dodano };
}
