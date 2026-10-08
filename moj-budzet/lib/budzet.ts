export type Transakcja = {
  id: string;
  nazwa: string;
  kwota: number | string;
  typ: 'przychod' | 'wydatek';
  kategoria: string | null;
  data_transakcji: string; // YYYY-MM-DD
  notatki: string | null;
};

type Kategoria = { id: string; nazwa: string; ikona: string; kolor: string; typ: 'przychod' | 'wydatek' };

export const KATEGORIE_WYDATKOW: Kategoria[] = [
  { id: 'jedzenie', nazwa: 'Jedzenie', ikona: '🍕', kolor: 'bg-[#f59e0b]', typ: 'wydatek' },
  { id: 'transport', nazwa: 'Transport', ikona: '🚗', kolor: 'bg-[#3b82f6]', typ: 'wydatek' },
  { id: 'mieszkanie', nazwa: 'Mieszkanie', ikona: '🏠', kolor: 'bg-[#10b981]', typ: 'wydatek' },
  { id: 'rozrywka', nazwa: 'Rozrywka', ikona: '🎮', kolor: 'bg-[#8b5cf6]', typ: 'wydatek' },
  { id: 'zdrowie', nazwa: 'Zdrowie', ikona: '💊', kolor: 'bg-[#ef4444]', typ: 'wydatek' },
  { id: 'edukacja', nazwa: 'Edukacja', ikona: '📚', kolor: 'bg-[#3b82f6]', typ: 'wydatek' },
  { id: 'ubrania', nazwa: 'Ubrania', ikona: '👕', kolor: 'bg-[#ec4899]', typ: 'wydatek' },
  { id: 'subskrypcje', nazwa: 'Subskrypcje', ikona: '📱', kolor: 'bg-[#14b8a6]', typ: 'wydatek' },
  { id: 'oszczednosci', nazwa: 'Oszczędności', ikona: '🏦', kolor: 'bg-[#eab308]', typ: 'wydatek' },
  { id: 'inne_wydatki', nazwa: 'Inne wydatki', ikona: '📦', kolor: 'bg-[#64748b]', typ: 'wydatek' },
];

export const KATEGORIE_PRZYCHODOW: Kategoria[] = [
  { id: 'wynagrodzenie', nazwa: 'Wynagrodzenie', ikona: '💰', kolor: 'bg-gray-400', typ: 'przychod' },
  { id: 'freelance', nazwa: 'Freelance', ikona: '💻', kolor: 'bg-gray-400', typ: 'przychod' },
  { id: 'inwestycje', nazwa: 'Inwestycje', ikona: '📈', kolor: 'bg-gray-400', typ: 'przychod' },
  { id: 'inne_przychody', nazwa: 'Inne przychody', ikona: '🎁', kolor: 'bg-gray-400', typ: 'przychod' },
];

const MAPA_KATEGORII: Record<string, Kategoria> = Object.fromEntries(
  [...KATEGORIE_WYDATKOW, ...KATEGORIE_PRZYCHODOW].map(k => [k.id, k])
);

export const getIcon = (typ: string, kat: string | null) => {
  const k = kat ? MAPA_KATEGORII[kat] : undefined;
  // Przychód z kategorią wydatkową dostaje ogólną ikonę przychodu
  if (k && (k.typ === 'przychod' || typ !== 'przychod')) return k.ikona;
  return typ === 'przychod' ? '💵' : '💸';
};

export const getCategoryColor = (kat: string) => MAPA_KATEGORII[kat]?.kolor ?? 'bg-gray-400';

export const formatujNazweKategorii = (kat: string | null) => (kat && MAPA_KATEGORII[kat]?.nazwa) || kat || '';

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
