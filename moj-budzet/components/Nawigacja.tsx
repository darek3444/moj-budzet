'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { LayoutDashboard, ArrowRightLeft, PieChart, Settings } from 'lucide-react';
import Logo from './Logo';
import { pobierzStatus, statusSerwera, subskrybujStatus } from '../lib/synchronizacja';

const POZYCJE = [
  { href: '/', etykieta: 'Dashboard', krotko: 'Start', Ikona: LayoutDashboard },
  { href: '/transactions', etykieta: 'Transakcje', krotko: 'Transakcje', Ikona: ArrowRightLeft },
  { href: '/summary', etykieta: 'Podsumowanie', krotko: 'Analiza', Ikona: PieChart },
  { href: '/settings', etykieta: 'Ustawienia', krotko: 'Ustawienia', Ikona: Settings },
];

const czyAktywna = (sciezka: string, href: string) => (href === '/' ? sciezka === '/' : sciezka.startsWith(href));

// Menu w lewym pasku (komputer)
export function MenuBoczne() {
  const sciezka = usePathname();
  return (
    <nav className="space-y-2 flex-1">
      {POZYCJE.map(({ href, etykieta, Ikona }) => (
        <Link key={href} href={href} aria-current={czyAktywna(sciezka, href) ? 'page' : undefined}
          className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-medium transition-all ${czyAktywna(sciezka, href) ? 'bg-slate-900 text-white shadow-md' : 'text-gray-500 hover:text-slate-900 hover:bg-gray-50'}`}>
          <Ikona size={20} /> {etykieta}
        </Link>
      ))}
    </nav>
  );
}

// Górny pasek na telefonie: logo i stan konta (szczegóły w Ustawieniach)
export function GornyPasekMobilny() {
  const { status, zalogowany } = useSyncExternalStore(subskrybujStatus, pobierzStatus, statusSerwera);
  const kropka = !zalogowany ? 'bg-gray-300' : status === 'zsynchronizowano' ? 'bg-emerald-500' : status === 'blad' || status === 'wylogowano' ? 'bg-red-500' : 'bg-amber-400';
  return (
    <header className="md:hidden sticky top-0 z-30 bg-[#fafafa]/90 backdrop-blur border-b border-gray-100 px-4 pb-3 flex items-center justify-between" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
      <Link href="/" className="flex items-center gap-2.5">
        <Logo size={32} />
        <span className="font-bold text-lg tracking-tight">Mój Budżet</span>
      </Link>
      <Link href="/settings#konto" className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white border border-gray-200 rounded-full pl-2.5 pr-3 py-1.5">
        <span className={`w-2 h-2 rounded-full ${kropka}`} />
        {zalogowany ? 'Konto' : 'Bez konta'}
      </Link>
    </header>
  );
}

// Dolny pasek nawigacji na telefonie
export function DolnyPasekMobilny() {
  const sciezka = usePathname();
  if (sciezka.startsWith('/login')) return null;
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-gray-100 grid grid-cols-4" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {POZYCJE.map(({ href, krotko, Ikona }) => {
        const aktywna = czyAktywna(sciezka, href);
        return (
          <Link key={href} href={href} aria-current={aktywna ? 'page' : undefined}
            className={`flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] font-bold transition-colors ${aktywna ? 'text-slate-900' : 'text-gray-400'}`}>
            <span className={`px-4 py-1 rounded-full transition-colors ${aktywna ? 'bg-slate-900 text-white' : ''}`}><Ikona size={20} /></span>
            {krotko}
          </Link>
        );
      })}
    </nav>
  );
}
