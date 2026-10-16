'use client';

import { ChevronDown } from 'lucide-react';

// Wspólny wygląd pól formularzy – ta sama wysokość i styl dla list, pól tekstowych i dat
export const POLE = 'h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 font-medium text-slate-900 outline-none transition-all placeholder:text-gray-400 focus:bg-white focus:border-slate-300 focus:ring-4 focus:ring-slate-100';

export const ETYKIETA = 'block text-sm font-bold text-gray-700 mb-2';

type WyborProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className'> & { pusty?: boolean; maly?: boolean };

// Lista rozwijana w stylu aplikacji: własna strzałka zamiast systemowej, szary tekst gdy nic nie wybrano
export function Wybor({ pusty, maly, children, ...props }: WyborProps) {
  return (
    <span className="relative block">
      <select {...props} className={`${POLE} appearance-none pr-10 cursor-pointer ${maly ? '!h-10 !px-3 !pr-9 text-base sm:text-sm' : ''} ${pusty ? '!text-gray-400' : ''}`}>
        {children}
      </select>
      <ChevronDown size={maly ? 16 : 18} className={`absolute ${maly ? 'right-2.5' : 'right-3.5'} top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none`} />
    </span>
  );
}

type KwotaProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className' | 'type'> & { jednostka?: string };

// Pole kwoty: bez systemowych strzałek, z jednostką w środku; przyjmuje przecinek ("12,50")
export function PoleKwoty({ jednostka = 'zł', ...props }: KwotaProps) {
  return (
    <span className="relative block">
      <input type="text" inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" title="Kwota, np. 49,99" {...props} className={`${POLE} pr-11`} />
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400 pointer-events-none">{jednostka}</span>
    </span>
  );
}

export const naLiczbe = (tekst: string) => parseFloat(tekst.replace(',', '.'));

type Opcja<T extends string> = { wartosc: T; etykieta: React.ReactNode };

// Przełącznik segmentowy – zamiast listy rozwijanej, gdy opcji jest 2–4
export function Segmenty<T extends string>({ opcje, wartosc, onChange, etykieta, pelnaSzerokosc = true, wylaczony = false }: {
  opcje: Opcja<T>[]; wartosc: T; onChange: (w: T) => void; etykieta: string; pelnaSzerokosc?: boolean; wylaczony?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={etykieta} className={`bg-gray-100 p-1 rounded-xl ${pelnaSzerokosc ? 'flex' : 'inline-flex'} gap-1`}>
      {opcje.map(o => {
        const aktywna = o.wartosc === wartosc;
        return (
          <button key={o.wartosc} type="button" role="radio" aria-checked={aktywna} disabled={wylaczony} onClick={() => onChange(o.wartosc)}
            className={`flex-1 h-10 px-3 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${aktywna ? 'bg-white shadow-sm text-slate-900' : 'text-gray-500 hover:text-slate-700'} disabled:cursor-not-allowed disabled:opacity-60`}>
            {o.etykieta}
          </button>
        );
      })}
    </div>
  );
}
