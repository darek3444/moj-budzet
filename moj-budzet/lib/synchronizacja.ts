'use client';

// Synchronizacja z kontem (opcjonalna), na wzór Kaizena:
// - lokalny magazyn jest źródłem prawdy, aplikacja nigdy nie czeka na sieć,
// - po zalogowaniu każda zmiana trafia do kolejki (zapisanej w localStorage) i jest wysyłana w tle,
// - przy starcie, powrocie do karty i odzyskaniu internetu pobieramy zmiany z innych urządzeń.
// Transakcje lądują w tabeli `transactions`, własne kategorie i reguły w user_metadata konta.

import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Kategoria, Transakcja } from './budzet';
import * as magazyn from './magazyn';
import { kontoDostepne, klientSupabase } from './supabase';

const KLUCZ = 'moj_budzet_sync_v1';
const KOLUMNY = 'id, nazwa, kwota, typ, kategoria, data_transakcji, notatki';
const OPOZNIENIE_WYSYLKI = 800;
const PORCJA = 500;

export type StatusSynchronizacji = 'lokalnie' | 'oczekuje' | 'zapisywanie' | 'zsynchronizowano' | 'offline' | 'blad' | 'wylogowano';

type Stan = {
  uid: string | null;
  email: string;
  zsynchronizowane: string[]; // id transakcji, które na pewno są w bazie
  doWyslania: string[];       // nowe lub zmienione lokalnie
  doUsuniecia: string[];      // usunięte lokalnie, a obecne w bazie
  metaDoWyslania: boolean;    // własne kategorie / reguły
  pobrano: boolean;           // czy to urządzenie choć raz pobrało dane z konta
};

const pustyStan = (): Stan => ({ uid: null, email: '', zsynchronizowane: [], doWyslania: [], doUsuniecia: [], metaDoWyslania: false, pobrano: false });

function wczytajStan(): Stan {
  try { return { ...pustyStan(), ...JSON.parse(localStorage.getItem(KLUCZ) || '{}') }; } catch { return pustyStan(); }
}

let stan: Stan = typeof window !== 'undefined' ? wczytajStan() : pustyStan();
let zsynchronizowane = new Set(stan.zsynchronizowane);
let doWyslania = new Set(stan.doWyslania);
let doUsuniecia = new Set(stan.doUsuniecia);

let aktywna = false; // true, gdy mamy zweryfikowaną sesję tego konta
let status: StatusSynchronizacji = stan.uid ? 'oczekuje' : 'lokalnie';
let szczegoly = '';
let klient: SupabaseClient | null = null;
let timerWysylki: ReturnType<typeof setTimeout> | undefined;
let timerPonowienia: ReturnType<typeof setTimeout> | undefined;
let opoznieniePonowienia = 5000;
let trwa = false;
let wersja = 0; // licznik lokalnych zmian – nie gubimy edycji zrobionych w trakcie wysyłki
const sluchacze = new Set<() => void>();

function zapiszStan() {
  stan = { ...stan, zsynchronizowane: [...zsynchronizowane], doWyslania: [...doWyslania], doUsuniecia: [...doUsuniecia] };
  try { localStorage.setItem(KLUCZ, JSON.stringify(stan)); } catch {}
}

function ustawStatus(s: StatusSynchronizacji, opis = '') {
  status = s; szczegoly = opis;
  migawka = { status, szczegoly, email: stan.email, zalogowany: !!stan.uid };
  sluchacze.forEach(f => f());
}

type Migawka = { status: StatusSynchronizacji; szczegoly: string; email: string; zalogowany: boolean };
let migawka: Migawka = { status, szczegoly, email: stan.email, zalogowany: !!stan.uid };
export const subskrybujStatus = (f: () => void) => { sluchacze.add(f); return () => { sluchacze.delete(f); }; };
export const pobierzStatus = () => migawka;
const STATUS_SERWERA: Migawka = { status: 'lokalnie', szczegoly: '', email: '', zalogowany: false };
export const statusSerwera = () => STATUS_SERWERA;

const maOczekujace = () => doWyslania.size > 0 || doUsuniecia.size > 0 || stan.metaDoWyslania;

async function pobierzKlienta() {
  klient ??= await klientSupabase();
  return klient;
}

// --- rejestrowanie lokalnych zmian ---
function poZmianie(z: magazyn.Zmiana) {
  if (!stan.uid) return; // tryb bez konta: nic nie kolejkujemy
  wersja++;
  z.zapisane?.forEach(id => doWyslania.add(id));
  z.usuniete?.forEach(id => {
    doWyslania.delete(id);
    if (zsynchronizowane.has(id)) doUsuniecia.add(id);
  });
  if (z.meta) stan.metaDoWyslania = true;
  zapiszStan();
  ustawStatus(navigator.onLine ? 'oczekuje' : 'offline');
  clearTimeout(timerWysylki);
  timerWysylki = setTimeout(wyslij, OPOZNIENIE_WYSYLKI);
}

function niepowodzenie(blad: unknown) {
  const opis = (blad as { message?: string })?.message ?? String(blad);
  console.error('Błąd synchronizacji', blad);
  ustawStatus(navigator.onLine ? 'blad' : 'offline', opis);
  clearTimeout(timerPonowienia);
  timerPonowienia = setTimeout(() => (maOczekujace() ? wyslij() : pobierz()), opoznieniePonowienia);
  opoznieniePonowienia = Math.min(opoznieniePonowienia * 2, 60000);
}

function udane() {
  clearTimeout(timerPonowienia);
  opoznieniePonowienia = 5000;
}

const wiersz = (t: Transakcja) => ({
  nazwa: t.nazwa, kwota: Number(t.kwota), typ: t.typ, kategoria: t.kategoria,
  data_transakcji: t.data_transakcji, notatki: t.notatki,
});

// --- wysyłanie ---
export async function wyslij(): Promise<void> {
  clearTimeout(timerWysylki);
  if (!aktywna || trwa || !maOczekujace()) return;
  trwa = true;
  ustawStatus('zapisywanie');
  const wersjaStart = wersja;
  try {
    const supabase = await pobierzKlienta();

    // 1. Usunięcia
    const usun = [...doUsuniecia];
    for (let i = 0; i < usun.length; i += PORCJA) {
      const porcja = usun.slice(i, i + PORCJA);
      const { error } = await supabase.from('transactions').delete().in('id', porcja);
      if (error) throw error;
      porcja.forEach(id => { doUsuniecia.delete(id); zsynchronizowane.delete(id); });
      zapiszStan();
    }

    // 2. Nowe i zmienione transakcje
    const lokalne = new Map(magazyn.transakcje().map(t => [t.id, t]));
    const ids = [...doWyslania].filter(id => lokalne.has(id));
    [...doWyslania].filter(id => !lokalne.has(id)).forEach(id => doWyslania.delete(id));
    const zmienione = ids.filter(id => zsynchronizowane.has(id));
    const nowe = ids.filter(id => !zsynchronizowane.has(id));

    for (let i = 0; i < zmienione.length; i += PORCJA) {
      const porcja = zmienione.slice(i, i + PORCJA);
      const { error } = await supabase.from('transactions').upsert(porcja.map(id => ({ id, ...wiersz(lokalne.get(id)!) })));
      if (error) throw error;
      porcja.forEach(id => doWyslania.delete(id));
      zapiszStan();
    }

    for (let i = 0; i < nowe.length; i += PORCJA) {
      const porcja = nowe.slice(i, i + PORCJA);
      // Bez id – baza nadaje własne (RETURNING zachowuje kolejność wstawianych wierszy)
      const { data, error } = await supabase.from('transactions').insert(porcja.map(id => wiersz(lokalne.get(id)!))).select('id');
      if (error) throw error;
      const mapa = new Map<string, string>();
      porcja.forEach((id, j) => {
        const noweId = String(data[j].id);
        mapa.set(id, noweId);
        doWyslania.delete(id);
        zsynchronizowane.add(noweId);
      });
      magazyn.zmienId(mapa);
      zapiszStan();
    }

    // 3. Własne kategorie i reguły
    if (stan.metaDoWyslania) {
      stan.metaDoWyslania = false;
      const { error } = await supabase.auth.updateUser({ data: { kategorie: magazyn.wlasneKategorie(), reguly_kategorii: magazyn.reguly() } });
      if (error) { stan.metaDoWyslania = true; throw error; }
      zapiszStan();
    }

    udane();
    trwa = false;
    if (maOczekujace() && wersja !== wersjaStart) return wyslij();
    ustawStatus('zsynchronizowano');
  } catch (blad) {
    trwa = false;
    zapiszStan();
    niepowodzenie(blad);
  }
}

// --- pobieranie zmian z innych urządzeń ---
export async function pobierz(): Promise<void> {
  if (!aktywna || trwa) return;
  trwa = true;
  try {
    const supabase = await pobierzKlienta();
    const zdalne: Transakcja[] = [];
    for (let od = 0; ; od += 1000) {
      const { data, error } = await supabase.from('transactions').select(KOLUMNY).order('id').range(od, od + 999);
      if (error) throw error;
      zdalne.push(...data.map(r => ({ ...r, id: String(r.id), kwota: Number(r.kwota) }) as Transakcja));
      if (data.length < 1000) break;
    }
    const { data: { user } } = await supabase.auth.getUser();
    trwa = false;
    scal(zdalne, user);
    udane();
    if (maOczekujace()) await wyslij();
    else ustawStatus('zsynchronizowano');
  } catch (blad) {
    trwa = false;
    niepowodzenie(blad);
  }
}

function scal(zdalne: Transakcja[], user: User | null) {
  const lokalne = magazyn.pobierzDane();
  const zdalneId = new Set(zdalne.map(t => t.id));
  const lokalnePoId = new Map(lokalne.transakcje.map(t => [t.id, t]));

  // Z serwera bierzemy wszystko poza tym, co lokalnie czeka na wysłanie lub usunięcie
  const wynik: Transakcja[] = zdalne
    .filter(t => !doUsuniecia.has(t.id))
    .map(t => (doWyslania.has(t.id) && lokalnePoId.has(t.id) ? lokalnePoId.get(t.id)! : t));

  for (const t of lokalne.transakcje) {
    if (zdalneId.has(t.id)) continue;
    if (zsynchronizowane.has(t.id) && !doWyslania.has(t.id)) continue; // usunięta na innym urządzeniu
    wynik.push(t);
    doWyslania.add(t.id); // jeszcze nie ma jej w bazie (np. dodana bez konta) – wyślemy
  }
  zsynchronizowane = new Set([...zdalneId].filter(id => !doUsuniecia.has(id)));

  // Kategorie i reguły: niewysłane lokalne zmiany wygrywają; przy pierwszym połączeniu urządzenia
  // łączymy obie strony; w pozostałych przypadkach obowiązuje stan z konta
  const meta = user?.user_metadata ?? {};
  const zdalneKategorie: Kategoria[] = Array.isArray(meta.kategorie) ? meta.kategorie : [];
  const zdalneReguly: Record<string, string> = meta.reguly_kategorii ?? {};
  let kategorie = zdalneKategorie, reguly = zdalneReguly;
  if (stan.metaDoWyslania) {
    kategorie = lokalne.kategorie; reguly = lokalne.reguly;
  } else if (!stan.pobrano) {
    kategorie = [...lokalne.kategorie, ...zdalneKategorie.filter(z => !lokalne.kategorie.some(l => l.id === z.id))];
    reguly = { ...zdalneReguly, ...lokalne.reguly };
    if (kategorie.length !== zdalneKategorie.length || Object.keys(reguly).length !== Object.keys(zdalneReguly).length) stan.metaDoWyslania = true;
  }
  stan.pobrano = true;

  magazyn.zastapDane({ transakcje: wynik, kategorie, reguly });
  zapiszStan();
}

// --- konto ---
async function polacz(user: User) {
  if (stan.uid && stan.uid !== user.id) {
    // Wcześniej w tej przeglądarce było inne konto – nie mieszamy jego danych z nowym
    magazyn.wyczyscDane();
    zsynchronizowane = new Set(); doWyslania = new Set(); doUsuniecia = new Set();
    stan = pustyStan();
  }
  stan.uid = user.id;
  stan.email = user.email ?? '';
  zapiszStan();
  aktywna = true;
  ustawStatus('oczekuje');
  await pobierz();
}

export async function zaloguj(email: string, haslo: string): Promise<string | null> {
  const supabase = await pobierzKlienta();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: haslo });
  if (error) return error.message;
  await polacz(data.user);
  return null;
}

export async function zarejestruj(email: string, haslo: string): Promise<{ blad: string | null; zalogowano: boolean }> {
  const supabase = await pobierzKlienta();
  const { data, error } = await supabase.auth.signUp({ email, password: haslo });
  if (error) return { blad: error.message, zalogowano: false };
  if (data.session && data.user) { await polacz(data.user); return { blad: null, zalogowano: true }; }
  return { blad: null, zalogowano: false }; // potrzebne potwierdzenie maila
}

// Zwraca false, jeśli zostały niewysłane zmiany i użytkownik nie potwierdził
export async function wyloguj(potwierdz: (pytanie: string) => boolean): Promise<boolean> {
  await wyslij();
  if (maOczekujace() && !potwierdz('Część zmian nie została jeszcze wysłana na konto (brak połączenia?). Wylogować mimo to? Te zmiany przepadną.')) return false;
  const supabase = await pobierzKlienta();
  aktywna = false;
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  // Dane należą do konta – po wylogowaniu przeglądarka zostaje pusta (tryb bez konta)
  magazyn.wyczyscDane();
  zsynchronizowane = new Set(); doWyslania = new Set(); doUsuniecia = new Set();
  stan = pustyStan();
  zapiszStan();
  ustawStatus('lokalnie');
  return true;
}

// --- start aplikacji ---
let uruchomiona = false;
export function uruchom() {
  if (uruchomiona || typeof window === 'undefined') return;
  uruchomiona = true;
  magazyn.ustawSluchaczaZmian(poZmianie);
  if (!kontoDostepne) return;

  window.addEventListener('online', () => (maOczekujace() ? wyslij() : pobierz()));
  let ostatnioPobrano = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) wyslij();
    else if (Date.now() - ostatnioPobrano > 30000) { ostatnioPobrano = Date.now(); pobierz(); }
  });

  if (!stan.uid) return;

  // Aplikacja już działa na lokalnych danych; sesję sprawdzamy w tle
  pobierzKlienta().then(async supabase => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id === stan.uid) {
      aktywna = true;
      await pobierz();
    } else {
      ustawStatus('wylogowano', 'Sesja wygasła – zaloguj się ponownie, żeby dokończyć synchronizację.');
    }
  }).catch(niepowodzenie);
}
