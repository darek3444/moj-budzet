// Parser CSV "Elektroniczne zestawienie operacji" z mBanku.
// Kolumny: Data księgowania; Data operacji; Opis operacji; Tytuł; Nadawca/Odbiorca; Numer konta; Kwota; Saldo po operacji

import Papa from 'papaparse';
import type { StronaPdf } from './importIng';

export type TransakcjaMbank = {
  data: string; // YYYY-MM-DD (dla kart: faktyczna data zakupu)
  nazwa: string;
  opis: string; // tekst do kategoryzacji
  kwota: number; // ze znakiem
  wlasny: boolean; // przelew między własnymi kontami / doładowanie
};

export type KontrolaSum = { uznania: number; obciazenia: number }; // z podsumowania banku, obie dodatnie

const kwotaZTekstu = (s: string) => parseFloat(s.replace(/[\s ]|PLN/g, '').replace(',', '.'));
const scisnij = (s: string) => s.replace(/\s+/g, ' ').trim();

// Pola mBanku są wyrównane spacjami do stałej szerokości – kolejne "kolumny" oddziela 2+ spacji
const pierwszaCzesc = (s: string) => scisnij(s.replace(/"/g, '').split(/\s{2,}/)[0] ?? '');

function nazwaIOpis(rodzaj: string, tytul: string, kontrahent: string, kwota: number): { nazwa: string; data?: string } {
  const r = rodzaj.toUpperCase();

  if (r.includes('KARTY')) {
    // "UBER   *EATS       /HELP.UBER.      DATA TRANSAKCJI: 2026-08-30" → "UBER *EATS"
    const data = tytul.match(/DATA TRANSAKCJI:\s*(\d{4}-\d{2}-\d{2})/)?.[1];
    return { nazwa: scisnij(tytul.split('/')[0]), data };
  }
  if (r.includes('P2P')) {
    const od = tytul.match(/\bOd\s+(.+)$/i)?.[1];
    if (kwota > 0) return { nazwa: od ? `BLIK od ${scisnij(od)}` : 'BLIK na telefon' };
    return { nazwa: scisnij(tytul) || 'BLIK na telefon' }; // wychodzący: tytuł wpisany przy przelewie
  }
  if (r.includes('E-COMMERCE')) {
    const nazwa = scisnij(tytul);
    return { nazwa: r.includes('KOR.') ? `Zwrot: ${nazwa}` : nazwa };
  }
  // Przelewy: liczy się nadawca/odbiorca, bez adresu
  const odbiorca = pierwszaCzesc(kontrahent)
    .replace(/\s(UL\.|AL\.|OS\.|PL\.)\s.*$/i, '')
    .replace(/\s\d{2}-\d{3}(\s.*)?$/, '')
    .replace(/^((?:\S+\s+){2,}?)\S*\d\S*(\s.*)?$/, '$1') // od numeru domu dalej to adres (w PDF nie ma odstępów)
    .trim();
  return { nazwa: odbiorca.replace(/\s+\.$/, '') || scisnij(tytul) || scisnij(rodzaj) };
}

type Wiersz = { dataOperacji: string; rodzaj: string; tytul: string; kontrahent: string; kwota: number };

function zbudujTransakcje(wiersze: Wiersz[], wlasciciel: string): TransakcjaMbank[] {
  return wiersze.flatMap(({ dataOperacji, rodzaj, tytul, kontrahent, kwota }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataOperacji)) return []; // stopka, saldo końcowe itp.
    if (isNaN(kwota) || kwota === 0) return [];

    const { nazwa, data } = nazwaIOpis(rodzaj, tytul, kontrahent, kwota);
    const wlasny =
      /revolut/i.test(tytul) || // doładowanie własnego konta w Revolut
      (!!wlasciciel && pierwszaCzesc(kontrahent).toUpperCase().startsWith(wlasciciel)) ||
      /PRZELEW WŁASNY|PRZELEW WEWNĘTRZNY/i.test(rodzaj);

    return [{
      data: data ?? dataOperacji,
      nazwa: (wlasny && /revolut/i.test(tytul) ? 'Doładowanie Revolut' : nazwa).substring(0, 60),
      opis: scisnij(`${rodzaj} ${tytul} ${kontrahent}`),
      kwota,
      wlasny,
    }];
  });
}

export function parsujMbank(tekst: string): { transakcje: TransakcjaMbank[]; kontrola?: KontrolaSum } {
  const linie = tekst.split(/\r?\n/);
  const naglowek = linie.findIndex(l => l.includes('#Data operacji'));
  if (naglowek < 0) return { transakcje: [] };

  const wlasciciel = scisnij(linie[linie.findIndex(l => l.startsWith('#Klient')) + 1]?.replace(/;/g, '') ?? '').toUpperCase();

  // Podsumowanie: "Uznania;15;4 617,78 PLN;"
  const suma = (etykieta: RegExp) => {
    const linia = linie.slice(0, naglowek).find(l => etykieta.test(l));
    return linia ? kwotaZTekstu(linia.split(';')[2] ?? '') : NaN;
  };
  const uznania = suma(/^Uznania;/), obciazenia = suma(/^Obci/);
  const kontrola = !isNaN(uznania) && !isNaN(obciazenia) ? { uznania, obciazenia } : undefined;

  const { data: wiersze } = Papa.parse<string[]>(linie.slice(naglowek + 1).join('\n'), { delimiter: ';', skipEmptyLines: true });

  const transakcje = zbudujTransakcje(wiersze.map(w => ({
    dataOperacji: w[1] ?? '', rodzaj: w[2] ?? '', tytul: w[3] ?? '', kontrahent: w[4] ?? '', kwota: kwotaZTekstu(w[6] ?? ''),
  })), wlasciciel);

  return { transakcje, kontrola };
}

// PDF "Elektroniczne zestawienie operacji": kolumny Data księgowania | Data operacji | Opis operacji | Kwota | Saldo.
// Opis to kilka linii: 1. rodzaj operacji, dalej szczegóły (dla przelewów: kontrahent, numer konta, tytuł).
export function parsujMbankPdf(strony: StronaPdf[]): { transakcje: TransakcjaMbank[]; kontrola?: KontrolaSum } {
  const pierwsza = strony[0] ?? [];
  if (!pierwsza.some(e => e.str.startsWith('Elektroniczne zestawienie operacji'))) return { transakcje: [] };

  const tytulDok = pierwsza.find(e => e.str.startsWith('Elektroniczne zestawienie operacji'))!;
  const wlasciciel = scisnij(pierwsza.find(e => e.y > tytulDok.y && e.y - tytulDok.y < 40 && e.str.trim())?.str ?? '').toUpperCase();

  const wartoscWiersza = (etykieta: string) => {
    const e = pierwsza.find(el => el.str.trim() === etykieta);
    const w = e && pierwsza.filter(el => Math.abs(el.y - e.y) < 2 && el.x > 380).sort((a, b) => b.x - a.x)[0];
    return w ? kwotaZTekstu(w.str) : NaN;
  };
  const uznania = wartoscWiersza('Uznania'), obciazenia = wartoscWiersza('Obciążenia');
  const kontrola = !isNaN(uznania) && !isNaN(obciazenia) ? { uznania, obciazenia } : undefined;

  const DATA = /^\d{4}-\d{2}-\d{2}$/, KWOTA = /^-?\d{1,3}(?:[\s\u00A0]\d{3})*,\d{2}$/;
  type Blok = { daty: string[]; opis: string[]; kwota?: number };
  const bloki: Blok[] = [];
  let granice: { opis: number; kwota: number; saldo: number } | null = null;

  for (const strona of strony) {
    const opisH = strona.find(e => e.str.trim() === 'Opis operacji');
    const kwotaH = strona.find(e => e.str.trim() === 'Kwota');
    const saldoH = strona.find(e => e.str.trim() === 'Saldo po');
    if (opisH && kwotaH && saldoH) granice = { opis: opisH.x - 4, kwota: kwotaH.x - 40, saldo: saldoH.x - 4 };
    if (!granice) continue;
    const naglowekY = opisH?.y ?? Infinity;

    const elementy = strona
      .filter(e => e.str.trim() && e.y < naglowekY - 4 && e.y > 45) // bez nagłówka tabeli i numeru strony
      .sort((a, b) => b.y - a.y || a.x - b.x);
    for (const e of elementy) {
      const tekst = e.str.trim();
      if (e.x < granice.opis) {
        // Nowa operacja zaczyna się od daty księgowania w pierwszej kolumnie
        if (DATA.test(tekst) && e.x < granice.opis - 50) bloki.push({ daty: [tekst], opis: [] });
        else bloki[bloki.length - 1]?.daty.push(tekst);
      } else if (e.x >= granice.kwota && e.x < granice.saldo && KWOTA.test(tekst)) {
        const b = bloki[bloki.length - 1];
        if (b && b.kwota === undefined) b.kwota = kwotaZTekstu(tekst);
      } else if (e.x < granice.kwota) {
        bloki[bloki.length - 1]?.opis.push(tekst);
      }
    }
  }

  const wiersze: Wiersz[] = bloki.map(b => {
    const [rodzaj = '', ...reszta] = b.opis;
    const iKonta = reszta.findIndex(l => /^\d{26}$/.test(l.replace(/\s/g, '')));
    const przelew = iKonta >= 0;
    return {
      dataOperacji: b.daty[1] ?? b.daty[0] ?? '',
      rodzaj,
      tytul: przelew ? reszta.slice(iKonta + 1).join(' ') : reszta.join(' '),
      kontrahent: przelew ? reszta.slice(0, iKonta).join(' ') : '',
      kwota: b.kwota ?? NaN,
    };
  });

  return { transakcje: zbudujTransakcje(wiersze, wlasciciel), kontrola };
}
