// Flaga "użytkownik już wybrał: konto albo praca bez konta" – bez niej pierwsze uruchomienie pokazuje logowanie
export const KLUCZ_STARTU = 'moj_budzet_start';

export function zapamietajStart() {
  try { localStorage.setItem(KLUCZ_STARTU, '1'); } catch {}
}

export function zapomnijStart() {
  try { localStorage.removeItem(KLUCZ_STARTU); } catch {}
}
