// Automatyczne przypisywanie kategorii do importowanych transakcji.
// Najpierw reguły zapamiętane z poprzednich importów, potem słowa kluczowe.

const REGULY_WYDATKOW: [string, string[]][] = [
  ['jedzenie', ['zabka', 'biedronka', 'lidl', 'kaufland', 'auchan', 'carrefour', 'dino', 'netto', 'stokrotka', 'lewiatan', 'livio', 'delikates', 'spozyw', 'piekarn', 'cukierni', 'warzywa', 'koszyk', 'frisco', 'pizz', 'restaur', 'mcdonald', 'kfc', 'burger', 'kebab', 'sushi', 'glovo', 'pyszne', 'wolt', 'bistro', 'kawiarn', 'cafe', 'coffee', 'starbucks', 'costa', 'bacowk', 'karczma', 'gastro']],
  ['transport', ['uber', 'bolt', 'freenow', 'orlen', 'bp ', 'shell', 'circle k', 'moya', 'lotos', 'amic', 'pkp', 'intercity', 'koleo', 'jakdojade', 'mpk', 'ztm', 'parking', 'flixbus', 'ryanair', 'wizz', 'autostrad', 'myjnia', 'stacja paliw']],
  ['mieszkanie', ['czynsz', 'ikea', 'castorama', 'leroy', 'obi ', 'jysk', 'pge', 'tauron', 'enea', 'energa', 'eon ', 'pgnig', 'gazownia', 'wodociag', 'spoldzielni', 'wspolnota', 'najem', 'mieszkani']],
  ['rozrywka', ['kino', 'cinema', 'multikino', 'helios', 'steam', 'playstation', 'xbox', 'nintendo', 'empik', 'bilet', 'ticket', 'eventim', 'maraton', 'decathlon', 'silownia', 'fitness', 'basen', 'escape', 'bowling', 'teatr', 'muzeum', 'booking', 'airbnb', 'hotel']],
  ['zdrowie', ['apteka', 'aptek', 'dent', 'medic', 'luxmed', 'lux med', 'enel-med', 'przychodni', 'lekarz', 'szpital', 'optyk', 'diagnost', 'rossmann', 'hebe', 'sephora', 'douglas', 'drogeri', 'ubezpiecz', 'nationale-nederlanden']],
  ['edukacja', ['udemy', 'coursera', 'ksiegarn', 'uczelni', 'czesne', 'szkol', 'kurs', 'uniwersytet', 'politechnik', 'duolingo']],
  ['ubrania', ['zalando', 'reserved', 'h&m', 'cropp', 'sinsay', 'house ', 'zara', 'tk maxx', 'ccc', 'deichmann', 'asics', 'nike', 'adidas', '4f ', 'half price', 'pepco', 'modivo', 'eobuwie', 'vinted', 'primark', 'answear', 'lpp']],
  ['subskrypcje', ['netflix', 'spotify', 'hbo', 'max.com', 'disney', 'youtube', 'apple.com', 'icloud', 'google', 'amazon prime', 'canva', 'openai', 'chatgpt', 'anthropic', 'claude.ai', 'orange', 't-mobile', 'plus ', 'play ', 'abonament', 'tidal', 'audible', 'storytel', 'legimi']],
];

const REGULY_PRZYCHODOW: [string, string[]][] = [
  ['wynagrodzenie', ['wynagrodzen', 'pensja', 'wyplata', 'premia', 'pracodawc', 'zus']],
  ['freelance', ['faktura', 'fv ', 'fv/', 'zlecen', 'umowa o dzielo']],
  ['inwestycje', ['odsetk', 'dywidend', 'xtb', 'obligacj', 'lokata']],
];

// Małe litery, bez polskich znaków i z pojedynczymi spacjami – do porównań
export const normalizuj = (tekst: string) =>
  ` ${tekst.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/\s+/g, ' ').trim()} `;

const KLUCZ_REGUL = 'moj_budzet_reguly_kategorii';

// Klucz kontrahenta: pierwsze dwa słowa nazwy, bez numerów sklepów (np. "ROSSMANN 10" → "rossmann")
export const kluczKontrahenta = (nazwa: string) =>
  normalizuj(nazwa).replace(/[^a-z\s.&-]/g, ' ').trim().split(/\s+/).slice(0, 2).join(' ');

export function wczytajReguly(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KLUCZ_REGUL) || '{}');
  } catch {
    return {};
  }
}

export function zapiszReguly(nowe: Record<string, string>) {
  try {
    localStorage.setItem(KLUCZ_REGUL, JSON.stringify({ ...wczytajReguly(), ...nowe }));
  } catch {}
}

export function kategoryzuj(nazwa: string, opis: string, typ: 'przychod' | 'wydatek', reguly: Record<string, string>): string {
  const zapamietana = reguly[`${typ}:${kluczKontrahenta(nazwa)}`];
  if (zapamietana) return zapamietana;

  const tekst = normalizuj(`${nazwa} ${opis}`);
  for (const [kategoria, slowa] of typ === 'wydatek' ? REGULY_WYDATKOW : REGULY_PRZYCHODOW) {
    if (slowa.some(s => tekst.includes(s))) return kategoria;
  }
  return typ === 'wydatek' ? 'inne_wydatki' : 'inne_przychody';
}
