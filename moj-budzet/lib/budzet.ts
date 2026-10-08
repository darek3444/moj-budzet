export type Transakcja = {
  id: string;
  nazwa: string;
  kwota: number | string;
  typ: 'przychod' | 'wydatek';
  kategoria: string | null;
  data_transakcji: string; // YYYY-MM-DD
  notatki: string | null;
};

export type Kategoria = {
  id: string;
  nazwa: string;
  ikona: string;
  kolor: string; // hex
  typ: 'przychod' | 'wydatek';
  slowa?: string[]; // słowa kluczowe do automatycznej kategoryzacji (własne kategorie)
};

export const KATEGORIE_WYDATKOW: Kategoria[] = [
  { id: 'jedzenie', nazwa: 'Jedzenie', ikona: '🍕', kolor: '#f59e0b', typ: 'wydatek' },
  { id: 'transport', nazwa: 'Transport', ikona: '🚗', kolor: '#3b82f6', typ: 'wydatek' },
  { id: 'mieszkanie', nazwa: 'Mieszkanie', ikona: '🏠', kolor: '#10b981', typ: 'wydatek' },
  { id: 'rozrywka', nazwa: 'Rozrywka', ikona: '🎮', kolor: '#8b5cf6', typ: 'wydatek' },
  { id: 'zdrowie', nazwa: 'Zdrowie', ikona: '💊', kolor: '#ef4444', typ: 'wydatek' },
  { id: 'uroda', nazwa: 'Uroda i drogeria', ikona: '💄', kolor: '#f472b6', typ: 'wydatek' },
  { id: 'sport', nazwa: 'Sport', ikona: '🏃', kolor: '#22c55e', typ: 'wydatek' },
  { id: 'edukacja', nazwa: 'Edukacja', ikona: '📚', kolor: '#0ea5e9', typ: 'wydatek' },
  { id: 'ubrania', nazwa: 'Ubrania', ikona: '👕', kolor: '#ec4899', typ: 'wydatek' },
  { id: 'elektronika', nazwa: 'Elektronika', ikona: '🔌', kolor: '#06b6d4', typ: 'wydatek' },
  { id: 'zwierzeta', nazwa: 'Zwierzęta', ikona: '🐾', kolor: '#a16207', typ: 'wydatek' },
  { id: 'subskrypcje', nazwa: 'Subskrypcje i telefon', ikona: '📱', kolor: '#14b8a6', typ: 'wydatek' },
  { id: 'ubezpieczenia', nazwa: 'Ubezpieczenia', ikona: '🛡️', kolor: '#6366f1', typ: 'wydatek' },
  { id: 'przelewy', nazwa: 'Przelewy do znajomych', ikona: '👥', kolor: '#94a3b8', typ: 'wydatek' },
  { id: 'oszczednosci', nazwa: 'Oszczędności', ikona: '🏦', kolor: '#eab308', typ: 'wydatek' },
  { id: 'inne_wydatki', nazwa: 'Inne wydatki', ikona: '📦', kolor: '#64748b', typ: 'wydatek' },
];

export const KATEGORIE_PRZYCHODOW: Kategoria[] = [
  { id: 'wynagrodzenie', nazwa: 'Wynagrodzenie', ikona: '💰', kolor: '#16a34a', typ: 'przychod' },
  { id: 'freelance', nazwa: 'Freelance', ikona: '💻', kolor: '#0d9488', typ: 'przychod' },
  { id: 'inwestycje', nazwa: 'Inwestycje i odsetki', ikona: '📈', kolor: '#2563eb', typ: 'przychod' },
  { id: 'inne_przychody', nazwa: 'Inne przychody', ikona: '🎁', kolor: '#9ca3af', typ: 'przychod' },
];

export const KATEGORIE_DOMYSLNE = [...KATEGORIE_WYDATKOW, ...KATEGORIE_PRZYCHODOW];

// Pomocnicy dla zestawu kategorii: wbudowane + własne użytkownika.
// "Inne" zostają zawsze na końcu listy.
export function zbudujKategorie(wlasne: Kategoria[]) {
  const zTypu = (typ: Kategoria['typ'], wbudowane: Kategoria[]) => {
    const inne = wbudowane[wbudowane.length - 1];
    return [...wbudowane.slice(0, -1), ...wlasne.filter(k => k.typ === typ), inne];
  };
  const wydatki = zTypu('wydatek', KATEGORIE_WYDATKOW);
  const przychody = zTypu('przychod', KATEGORIE_PRZYCHODOW);
  const mapa: Record<string, Kategoria> = Object.fromEntries([...wydatki, ...przychody].map(k => [k.id, k]));

  return {
    KATEGORIE_WYDATKOW: wydatki,
    KATEGORIE_PRZYCHODOW: przychody,
    wlasne,
    getIcon: (typ: string, kat: string | null) => {
      const k = kat ? mapa[kat] : undefined;
      // Przychód z kategorią wydatkową dostaje ogólną ikonę przychodu
      if (k && (k.typ === 'przychod' || typ !== 'przychod')) return k.ikona;
      return typ === 'przychod' ? '💵' : '💸';
    },
    getCategoryColor: (kat: string) => mapa[kat]?.kolor ?? '#9ca3af',
    formatujNazweKategorii: (kat: string | null) => (kat && mapa[kat]?.nazwa) || kat || '',
  };
}

export type Kategorie = ReturnType<typeof zbudujKategorie>;

// Jeden formatter zamiast tworzenia nowego przy każdym toLocaleString
const formatterPLN = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatujWalute = (wartosc: number) => `${formatterPLN.format(wartosc)} zł`;

const dwieCyfry = (n: number) => String(n).padStart(2, '0');

// Dzisiejsza data w strefie lokalnej (toISOString daje UTC, czyli po północy "wczoraj")
export const dzisiaj = () => {
  const d = new Date();
  return `${d.getFullYear()}-${dwieCyfry(d.getMonth() + 1)}-${dwieCyfry(d.getDate())}`;
};

// Prefiks "YYYY-MM" do porównywania z data_transakcji bez parsowania dat
export const prefiksMiesiaca = (rok: number, miesiac: number) => `${rok}-${dwieCyfry(miesiac + 1)}`;
