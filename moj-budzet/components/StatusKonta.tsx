'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { HardDrive, User, LogOut, RefreshCw } from 'lucide-react';
import { pobierzStatus, statusSerwera, subskrybujStatus, wyloguj, wyslij, type StatusSynchronizacji } from '../lib/synchronizacja';
import { kontoDostepne } from '../lib/supabase';

const OPISY: Record<StatusSynchronizacji, { tekst: string; kolor: string }> = {
  lokalnie: { tekst: 'Dane w tej przeglądarce', kolor: 'bg-gray-300' },
  oczekuje: { tekst: 'Oczekuje na zapis…', kolor: 'bg-amber-400' },
  zapisywanie: { tekst: 'Zapisywanie…', kolor: 'bg-amber-400' },
  zsynchronizowano: { tekst: 'Zsynchronizowano', kolor: 'bg-emerald-500' },
  offline: { tekst: 'Offline – zapisze się później', kolor: 'bg-gray-400' },
  blad: { tekst: 'Błąd synchronizacji', kolor: 'bg-red-500' },
  wylogowano: { tekst: 'Sesja wygasła', kolor: 'bg-red-500' },
};

// Dół lewego menu: tryb bez konta albo konto ze stanem synchronizacji
export default function StatusKonta() {
  const { status, szczegoly, email, zalogowany } = useSyncExternalStore(subskrybujStatus, pobierzStatus, statusSerwera);

  if (!zalogowany) {
    return (
      <div className="mt-auto pt-6 border-t border-gray-100">
        <Link href="/settings#kopia" className="flex items-start gap-3 text-gray-500 hover:text-slate-900 transition-colors">
          <div className="bg-gray-100 p-2.5 rounded-full text-slate-500"><HardDrive size={18} /></div>
          <div>
            <p className="text-sm font-bold text-slate-900">Dane w tej przeglądarce</p>
            <p className="text-xs font-medium">Bez konta. Kopia zapasowa →</p>
          </div>
        </Link>
        {kontoDostepne && (
          <Link href="/login" className="mt-4 w-full flex items-center justify-center gap-2 border border-gray-200 text-slate-700 hover:bg-gray-50 px-4 py-2.5 rounded-xl font-bold text-sm transition-all">
            <User size={16} /> Zaloguj, aby synchronizować
          </Link>
        )}
      </div>
    );
  }

  const opis = OPISY[status];
  const wylogujSie = async () => {
    if (await wyloguj(pytanie => confirm(pytanie))) window.location.href = '/';
  };

  return (
    <div className="mt-auto pt-6 border-t border-gray-100">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-gray-100 p-2.5 rounded-full text-slate-500"><User size={20} /></div>
        <div className="overflow-hidden">
          <p className="text-sm font-bold text-slate-900 truncate" title={email}>{email}</p>
          <p className="text-xs text-gray-500 font-medium flex items-center gap-1.5" title={szczegoly}>
            <span className={`w-2 h-2 rounded-full ${opis.kolor}`} /> {opis.tekst}
          </p>
        </div>
      </div>
      {status === 'blad' && (
        <button onClick={() => wyslij()} className="w-full mb-2 flex items-center justify-center gap-2 border border-gray-200 text-slate-700 hover:bg-gray-50 px-4 py-2 rounded-xl font-bold text-sm">
          <RefreshCw size={16} /> Ponów
        </button>
      )}
      {status === 'wylogowano' && (
        <Link href="/login" className="w-full mb-2 flex items-center justify-center gap-2 border border-gray-200 text-slate-700 hover:bg-gray-50 px-4 py-2 rounded-xl font-bold text-sm">
          Zaloguj ponownie
        </Link>
      )}
      <button onClick={wylogujSie} className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2.5 rounded-xl font-bold transition-all active:scale-95">
        <LogOut size={18} /> Wyloguj się
      </button>
    </div>
  );
}
