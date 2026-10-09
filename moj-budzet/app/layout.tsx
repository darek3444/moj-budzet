import type { Metadata, Viewport } from "next";
import "./globals.css";
import Logo from '../components/Logo';
import StatusKonta from '../components/StatusKonta';
import { MenuBoczne, GornyPasekMobilny, DolnyPasekMobilny } from '../components/Nawigacja';
import { KategorieProvider } from '../components/KategorieProvider';

export const metadata: Metadata = {
  title: "Mój Budżet",
  description: "Twój osobisty menedżer finansów",
  appleWebApp: { capable: true, title: "Mój Budżet", statusBarStyle: "default" },
};

// viewport-fit=cover, żeby dolny pasek omijał "brodę" iPhone'a (env(safe-area-inset-bottom))
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#fafafa" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body className="antialiased min-h-screen bg-[#fafafa] flex font-sans text-slate-900">
        
        <KategorieProvider>
          {/* LEWE MENU - dodano pb-12 (padding-bottom) żeby podnieść zawartość */}
          <aside className="w-64 bg-white border-r border-gray-100 p-6 pb-12 hidden md:flex flex-col h-screen sticky top-0 z-10">
            <div className="flex items-center gap-3 mb-10">
              <Logo size={40} />
              <span className="font-bold text-2xl tracking-tight">Mój Budżet</span>
            </div>

            <MenuBoczne />

            <StatusKonta />
            
          </aside>

          {/* GŁÓWNA TREŚĆ – na telefonie z górnym paskiem i miejscem na dolną nawigację */}
          <div className="flex-1 overflow-y-auto w-full min-w-0 pb-24 md:pb-0">
            <GornyPasekMobilny />
            {children}
          </div>
          <DolnyPasekMobilny />
        </KategorieProvider>

      </body>
    </html>
  );
}