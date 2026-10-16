import type { Metadata, Viewport } from "next";
import "./globals.css";
import Logo from '../components/Logo';
import StatusKonta from '../components/StatusKonta';
import { MenuBoczne, GornyPasekMobilny, DolnyPasekMobilny } from '../components/Nawigacja';
import { KategorieProvider } from '../components/KategorieProvider';
import { KLUCZ_STARTU } from '../lib/start';

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
      <head>
        {/* Pierwsze uruchomienie: ekran logowania zamiast Dashboardu. Działa przed narysowaniem strony,
            więc Dashboard nie mignie. Kto już ma transakcje w przeglądarce albo konto, wchodzi od razu
            (po wylogowaniu zostaje pusty zapis – on się nie liczy). */}
        <script dangerouslySetInnerHTML={{ __html: `try{var s=localStorage;if(!s.getItem('${KLUCZ_STARTU}')){if(((JSON.parse(s.getItem('moj_budzet_dane_v1')||'{}').transakcje||[]).length)||(JSON.parse(s.getItem('moj_budzet_sync_v1')||'{}').uid)){s.setItem('${KLUCZ_STARTU}','1')}else if(!location.pathname.startsWith('/login')){location.replace('/login')}}}catch(e){}` }} />
        {/* Wygląd (Tailwind 4) wymaga Safari 16.4+ / Chrome 111+ / Firefox 128+. Na starszych zamiast
            rozsypanej strony pokazujemy czytelną prośbę o aktualizację (style inline, bez Tailwinda). */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(!(window.CSS&&CSS.supports&&CSS.supports('color','oklch(0% 0 0)')&&CSS.supports('selector(:is(a))'))){document.addEventListener('DOMContentLoaded',function(){var d=document.createElement('div');d.setAttribute('role','alert');d.style.cssText='position:fixed;inset:0;z-index:99999;background:#fafafa;color:#0f172a;font:16px/1.5 -apple-system,Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center';d.innerHTML='<div style="max-width:420px"><p style="font-size:22px;font-weight:700;margin:0 0 12px">Zaktualizuj przeglądarkę</p><p style="margin:0;color:#475569">Mój Budżet potrzebuje nowszej przeglądarki: Safari 16.4 / iOS 16.4 lub nowszy, Chrome, Edge albo Firefox z ostatnich dwóch lat.</p></div>';document.body.appendChild(d)})}}catch(e){}` }} />
      </head>
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