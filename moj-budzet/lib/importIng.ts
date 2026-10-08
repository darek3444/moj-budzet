// Parser PDF "Lista transakcji" z ING (bankowość internetowa).
// Dokument to tabela: Data | Dane kontrahenta | Tytuł | Szczegóły | Kwota | Konto i saldo.
// Zamiast sklejać cały tekst, przypisujemy fragmenty do kolumn po pozycji X
// i dzielimy na transakcje po pustych odstępach w pionie.

export type ElementTekstu = { str: string; x: number; y: number };
export type StronaPdf = ElementTekstu[];

export type TransakcjaIng = {
  data: string; // YYYY-MM-DD
  kontrahent: string;
  kontrahentLinie: string[]; // nazwa w 1. linii, dalej adres
  tytul: string;
  szczegoly: string;
  kwota: number; // ze znakiem: ujemna = obciążenie
  konto: string;
};

type Kolumna = 'data' | 'kontrahent' | 'tytul' | 'szczegoly' | 'kwota' | 'konto';

const KWOTA = /^-?(?:\d{1,3}(?:[\s\u00A0]\d{3})+|\d+),\d{2} PLN$/; // ING grupuje tysiące spacją, ale nie zawsze
const DATA = /^\d{2}\.\d{2}\.\d{4}$/;
const ODSTEP_MIEDZY_TRANSAKCJAMI = 14; // linie w komórce co ~8-9 pt, między wierszami tabeli ~27 pt

type Granice = { kontrahent: number; tytul: number; szczegoly: number; kwota: number; konto: number };

// Granice kolumn bierzemy z nagłówka tabeli, z zapasem na wypadek innego układu
function granice(strona: StronaPdf): Granice | null {
  const x = (tekst: string) => strona.find(e => e.str.trim() === tekst)?.x;
  const kontrahent = x('Dane kontrahenta'), tytul = x('Tytuł'), szczegoly = x('Szczegóły / nr transakcji'), konto = x('Konto i saldo');
  if (kontrahent === undefined || tytul === undefined || szczegoly === undefined || konto === undefined) return null;
  // Kwoty są wyrównane do prawej, więc kolumna zaczyna się sporo przed nagłówkiem "Kwota"
  return { kontrahent: kontrahent - 4, tytul: tytul - 4, szczegoly: szczegoly - 4, kwota: konto - 80, konto: konto - 20 };
}

function kolumna(e: ElementTekstu, g: Granice): Kolumna {
  if (e.x < g.kontrahent) return 'data';
  if (e.x < g.tytul) return 'kontrahent';
  if (e.x < g.szczegoly) return 'tytul';
  if (e.x >= g.konto) return 'konto';
  // "Szczegóły" i "Kwota" częściowo się zazębiają – kwotę poznajemy po formacie
  if (e.x >= g.kwota && KWOTA.test(e.str.trim())) return 'kwota';
  return 'szczegoly';
}

type Blok = Record<Kolumna, string[]>;
const pustyBlok = (): Blok => ({ data: [], kontrahent: [], tytul: [], szczegoly: [], kwota: [], konto: [] });

function blokiZeStrony(strona: StronaPdf, g: Granice): Blok[] {
  const naglowek = strona.find(e => e.str.trim() === 'Dane kontrahenta')!.y;
  // Stopka tylko na dole strony (A4 ma ~842 pt wysokości)
  const stopka = strona.find(e => e.y < 150 && e.str.startsWith('Dokument ma charakter informacyjny'))?.y ?? 0;
  const tresc = strona
    .filter(e => e.str.trim() && e.y < naglowek - 4 && e.y > stopka + 4)
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const bloki: Blok[] = [];
  let poprzednieY = Infinity;
  for (const e of tresc) {
    if (poprzednieY - e.y > ODSTEP_MIEDZY_TRANSAKCJAMI) bloki.push(pustyBlok());
    bloki[bloki.length - 1][kolumna(e, g)].push(e.str.trim());
    poprzednieY = e.y;
  }
  return bloki;
}

const kwotaZTekstu = (s: string) => parseFloat(s.replace(/[\s ]|PLN/g, '').replace(',', '.'));

export function parsujListeIng(strony: StronaPdf[]): TransakcjaIng[] {
  const bloki: Blok[] = [];
  let g: Granice | null = null;
  for (const strona of strony) {
    g = granice(strona) ?? g;
    if (!g) continue;
    for (const blok of blokiZeStrony(strona, g)) {
      const poprzedni = bloki[bloki.length - 1];
      // Transakcja przecięta przez koniec strony: jedna z części nie ma kwoty
      if (poprzedni && (poprzedni.kwota.length === 0 || blok.kwota.length === 0)) {
        (Object.keys(blok) as Kolumna[]).forEach(k => poprzedni[k].push(...blok[k]));
      } else {
        bloki.push(blok);
      }
    }
  }

  return bloki.flatMap(b => {
    const data = b.data.find(d => DATA.test(d));
    if (!data || b.kwota.length === 0) return [];
    return [{
      data: data.split('.').reverse().join('-'),
      kontrahent: b.kontrahent.join(' '),
      kontrahentLinie: b.kontrahent,
      tytul: b.tytul.join(' '),
      szczegoly: b.szczegoly.join(' '),
      kwota: kwotaZTekstu(b.kwota[0]),
      konto: b.konto.filter(k => !KWOTA.test(k)).join(' '),
    }];
  });
}

// Imię i nazwisko właściciela z sekcji "Dane użytkownika" – do rozpoznawania przelewów własnych
export function wlascicielIng(strony: StronaPdf[]): string {
  const strona = strony[0] ?? [];
  const naglowek = strona.find(e => e.str.trim() === 'Dane użytkownika');
  if (!naglowek) return '';
  const ponizej = strona
    .filter(e => Math.abs(e.x - naglowek.x) < 2 && e.y < naglowek.y && e.str.trim())
    .sort((a, b) => b.y - a.y);
  return ponizej[0]?.str.trim() ?? '';
}

export const czyPrzelewWlasny = (t: TransakcjaIng, wlasciciel: string) =>
  /^przelew (własny|smart saver)/i.test(t.tytul) ||
  (!!wlasciciel && t.kontrahent.toUpperCase().startsWith(wlasciciel.toUpperCase()));

// Czytelna nazwa: kontrahent bez adresu, numerów kont i identyfikatorów terminali
export function nazwaTransakcji(t: TransakcjaIng): string {
  if (/^ING BANK/i.test(t.kontrahent) && /ODSET/i.test(t.tytul)) {
    return /PODATEK/i.test(t.tytul) ? 'Podatek od odsetek' : 'Odsetki';
  }
  // Pierwsza linia to nazwa; dalsze to adres, numer konta lub identyfikator terminala
  const [pierwsza = '', druga = ''] = t.kontrahentLinie;
  const nazwa = (pierwsza.length < 4 ? `${pierwsza} ${druga}` : pierwsza)
    .replace(/\d{26}.*$/, '')
    .replace(/\d{5,}\/\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return (nazwa || t.tytul || 'Transakcja z ING').substring(0, 60).trim();
}
