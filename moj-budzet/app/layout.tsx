import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { LayoutDashboard, ArrowRightLeft, PieChart, Settings } from 'lucide-react';
import AuthGuard from './AuthGuard';
import SidebarUser from './SidebarUser';
import Logo from '../components/Logo';

export const metadata: Metadata = {
  title: "Mój Budżet",
  description: "Twój osobisty menedżer finansów",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body className="antialiased min-h-screen bg-[#fafafa] flex font-sans text-slate-900">
        
        <AuthGuard>
          {/* LEWE MENU - dodano pb-12 (padding-bottom) żeby podnieść zawartość */}
          <aside className="w-64 bg-white border-r border-gray-100 p-6 pb-12 hidden md:flex flex-col h-screen sticky top-0 z-10">
            <div className="flex items-center gap-3 mb-10">
              <Logo size={40} />
              <span className="font-bold text-2xl tracking-tight">Mój Budżet</span>
            </div>

            <nav className="space-y-2 flex-1">
              <Link href="/" className="flex items-center gap-3 text-gray-500 hover:text-slate-900 hover:bg-gray-50 px-4 py-3.5 rounded-xl font-medium transition-all focus:bg-slate-900 focus:text-white focus:shadow-md">
                <LayoutDashboard size={20} /> Dashboard
              </Link>
              <Link href="/transactions" className="flex items-center gap-3 text-gray-500 hover:text-slate-900 hover:bg-gray-50 px-4 py-3.5 rounded-xl font-medium transition-all focus:bg-slate-900 focus:text-white focus:shadow-md">
                <ArrowRightLeft size={20} /> Transakcje
              </Link>
              <Link href="/summary" className="flex items-center gap-3 text-gray-500 hover:text-slate-900 hover:bg-gray-50 px-4 py-3.5 rounded-xl font-medium transition-all focus:bg-slate-900 focus:text-white focus:shadow-md">
                <PieChart size={20} /> Podsumowanie
              </Link>
              <Link href="/settings" className="flex items-center gap-3 text-gray-500 hover:text-slate-900 hover:bg-gray-50 px-4 py-3.5 rounded-xl font-medium transition-all focus:bg-slate-900 focus:text-white focus:shadow-md">
                <Settings size={20} /> Ustawienia
              </Link>
            </nav>

            {/* NASZ KLOCEK Z LOGOUTEM */}
            <SidebarUser />
            
          </aside>

          {/* GŁÓWNA TREŚĆ */}
          <div className="flex-1 overflow-y-auto w-full">
            {children}
          </div>
        </AuthGuard>

      </body>
    </html>
  );
}