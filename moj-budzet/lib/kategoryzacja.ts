// Automatyczne przypisywanie kategorii do importowanych transakcji.
// Kolejność: reguły zapamiętane z poprawek → słowa kluczowe własnych kategorii → wbudowany słownik.

import type { Kategoria } from './budzet';

// Kolejność ma znaczenie: pierwsza pasująca kategoria wygrywa (np. "uber eats" przed "uber")
const REGULY_WYDATKOW: [string, string[]][] = [
  ['przelewy', ['przelew na telefon', 'blik na telefon', 'przelew blik', 'zwrot za ', 'oddaje ', 'oddaję ']],
  ['jedzenie', ['uber eats', 'glovo', 'pyszne', 'wolt', 'bolt food', 'foodpanda',
    'zabka', 'biedronka', 'lidl', 'kaufland', 'auchan', 'carrefour', 'dino ', 'netto', 'stokrotka', 'lewiatan', 'livio', 'polomarket', 'intermarche', 'aldi', 'spar ', 'eurospar', 'topaz', 'groszek', 'mila ', 'spolem', 'frisco', 'delikates', 'spozyw', 'piekarn', 'cukierni', 'warzyw', 'koszyk', 'supermarket', 'minimarket', 'sklep spozyw', 'sklep ogolno',
    'pizz', 'restaur', 'mcdonald', 'kfc', 'burger', 'kebab', 'sushi', 'subway', 'dominos', 'telepizza', 'pizza hut', 'north fish', 'sphinx', 'manekin', 'pierogarn', 'bar mleczny', 'bistro', 'kawiarn', 'cafe', 'caffe', 'coffee', 'starbucks', 'costa ', 'lodziarn', 'bacowk', 'karczma', 'gastro', 'kuchnia', 'jadlodajn', 'stolowka', 'pub ', 'piwiarn']],
  ['transport', ['uber', 'bolt', 'freenow', 'free now', 'orlen', 'bp ', 'bp-', 'shell', 'circle k', 'moya', 'lotos', 'amic', 'mol ', 'stacja paliw', 'pkp', 'intercity', 'polregio', 'koleje', 'koleo', 'skm ', 'wkd', 'jakdojade', 'mpk', 'ztm', 'zkm', 'mobilet', 'parking', 'parkomat', 'flixbus', 'blablacar', 'ryanair', 'wizz', 'lot.com', 'autostrad', 'e-toll', 'etoll', 'myjnia', 'veturilo', 'traficar', 'panek', 'lime ', 'tier ', 'bolt.eu']],
  ['mieszkanie', ['czynsz', 'ikea', 'castorama', 'leroy', 'obi ', 'bricoman', 'psb ', 'mrowka', 'jysk', 'agata', 'black red white', 'abra ', 'pge', 'tauron', 'enea', 'energa', 'e.on', 'eon ', 'pgnig', 'gazownia', 'wodociag', 'spoldzielni', 'wspolnota', 'najem', 'mieszkani', 'administracja']],
  ['uroda', ['rossmann', 'hebe', 'sephora', 'douglas', 'notino', 'inglot', 'natura ', 'drogeri', 'fryzjer', 'barber', 'kosmety', 'salon ', 'paznok', 'manicure', 'spa ']],
  ['zdrowie', ['apteka', 'aptek', 'gemini', 'ziko', 'dr max', 'doz ', 'super-pharm', 'cefarm', 'dentyst', 'ortodent', 'dental', 'stomatolog', 'medic', 'luxmed', 'lux med', 'enel-med', 'enel med', 'przychodni', 'lekarz', 'szpital', 'optyk', 'okulist', 'diagnost', 'alab', 'synevo', 'laborator', 'fizjo', 'rehab', 'psycholog', 'terapi']],
  ['sport', ['decathlon', 'intersport', 'go sport', 'sportisimo', 'martes', 'asics', 'salomon', 'maraton', 'bieg', 'zawody', 'fitness', 'silowni', 'gym', 'basen', 'benefit', 'multisport', 'squash', 'tenis', 'wspinal', 'narty', 'wyciag']],
  ['rozrywka', ['kino', 'cinema', 'multikino', 'helios', 'steam', 'playstation', 'xbox', 'nintendo', 'gog.com', 'epic games', 'empik', 'bilet', 'ticket', 'eventim', 'ebilet', 'going.', 'escape', 'bowling', 'kregiel', 'teatr', 'muzeum', 'koncert', 'aquapark', 'trampolin', 'booking', 'airbnb', 'hotel', 'hostel']],
  ['edukacja', ['udemy', 'coursera', 'ksiegarn', 'ksiazk', 'uczelni', 'czesne', 'szkol', 'kurs', 'uniwersytet', 'politechnik', 'akademi', 'egzamin', 'duolingo']],
  ['ubrania', ['zalando', 'reserved', 'h&m', 'cropp', 'sinsay', 'house ', 'mohito', 'zara', 'bershka', 'pull&bear', 'stradivarius', 'mango', 'c&a', 'kik ', 'new yorker', 'big star', 'diverse', 'tk maxx', 'ccc', 'deichmann', 'nike', 'adidas', '4f ', 'half price', 'pepco', 'primark', 'modivo', 'eobuwie', 'answear', 'vinted', 'wolczanka', 'vistula', 'top secret', 'wittchen', 'ochnik', 'apart ', 'kruk']],
  ['elektronika', ['mediaexpert', 'media expert', 'mediamarkt', 'media markt', 'rtv euro', 'euro rtv', 'euro-net', 'x-kom', 'morele', 'komputronik', 'neonet', 'apple store', 'istore', 'samsung', 'xiaomi']],
  ['zwierzeta', ['zoo', 'kakadu', 'weteryn', 'vet ', 'krakvet', 'fera ']],
  ['subskrypcje', ['netflix', 'spotify', 'hbo', 'max.com', 'disney', 'youtube', 'apple.com', 'icloud', 'google', 'amazon', 'prime video', 'canal+', 'player.pl', 'polsat box', 'canva', 'adobe', 'microsoft', 'dropbox', 'notion', 'github', 'openai', 'chatgpt', 'anthropic', 'claude.ai', 'tidal', 'audible', 'storytel', 'legimi', 'bookbeat',
    'orange', 't-mobile', 'plus ', 'play ', 'heyah', 'nju', 'virgin', 'vectra', 'upc', 'netia', 'inea', 'abonament']],
  ['ubezpieczenia', ['ubezpiecz', 'pzu', 'warta', 'allianz', 'hestia', 'generali', 'uniqa', 'compensa', 'link4', 'nationale-nederlanden', 'aviva', 'axa ', 'benefia', 'wiener', 'polisa', 'skladka']],
];

const REGULY_PRZYCHODOW: [string, string[]][] = [
  ['wynagrodzenie', ['wynagrodzen', 'pensja', 'wyplata', 'premia', 'pracodawc', 'zus', 'stypendi']],
  ['freelance', ['faktura', 'fv ', 'fv/', 'zlecen', 'umowa o dzielo', 'rachunek do umowy']],
  ['inwestycje', ['odsetk', 'dywidend', 'xtb', 'obligacj', 'lokata']],
];

// Małe litery, bez polskich znaków i z pojedynczymi spacjami – do porównań
export const normalizuj = (tekst: string) =>
  ` ${tekst.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/\s+/g, ' ').trim()} `;

// Klucz kontrahenta: pierwsze dwa słowa nazwy, bez numerów sklepów (np. "ROSSMANN 10" → "rossmann")
export const kluczKontrahenta = (nazwa: string) =>
  normalizuj(nazwa).replace(/[^a-z\s.&-]/g, ' ').trim().split(/\s+/).slice(0, 2).join(' ');

export const kluczReguly = (typ: string, nazwa: string) => `${typ}:${kluczKontrahenta(nazwa)}`;

export function kategoryzuj(
  nazwa: string, opis: string, typ: 'przychod' | 'wydatek',
  reguly: Record<string, string>, wlasne: Kategoria[] = [],
): string {
  const zapamietana = reguly[kluczReguly(typ, nazwa)];
  if (zapamietana) return zapamietana;

  const tekst = normalizuj(`${nazwa} ${opis}`);
  const wlasneReguly: [string, string[]][] = wlasne
    .filter(k => k.typ === typ && k.slowa?.length)
    .map(k => [k.id, k.slowa!.map(s => normalizuj(s).trim()).filter(Boolean)]);

  for (const [kategoria, slowa] of [...wlasneReguly, ...(typ === 'wydatek' ? REGULY_WYDATKOW : REGULY_PRZYCHODOW)]) {
    if (slowa.some(s => tekst.includes(s))) return kategoria;
  }
  return typ === 'wydatek' ? 'inne_wydatki' : 'inne_przychody';
}

// Reguły z pierwszej wersji trzymane w przeglądarce – przenosimy je na konto
export function regulyZPrzegladarki(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem('moj_budzet_reguly_kategorii') || '{}');
  } catch {
    return {};
  }
}
