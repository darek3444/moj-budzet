'use client';

import { useState, useEffect } from 'react';
import { useTransakcje } from '../../lib/useTransakcje';
import { formatujWalute, dzisiaj } from '../../lib/budzet';
import { useKategorie } from '../../components/KategorieProvider';
import WlasneKategorie from '../../components/WlasneKategorie';
import PorzadkowanieKategorii from '../../components/PorzadkowanieKategorii';
import KopiaZapasowa from '../../components/KopiaZapasowa';
import StatusKonta from '../../components/StatusKonta';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Download, Settings, Loader2, ChevronDown } from 'lucide-react';

// Wspólny wygląd pól formularza limitu – ta sama wysokość dla listy i pól tekstowych
const POLE = 'h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 font-medium outline-none transition-all placeholder:text-gray-400 focus:bg-white focus:border-slate-300 focus:ring-4 focus:ring-slate-100';

export default function SettingsPage() {
  // Transakcje potrzebne tylko do eksportu – strona nie czeka na nie z renderem
  const { data: transakcje = [], isLoading } = useTransakcje();
  const { KATEGORIE_WYDATKOW, getIcon, formatujNazweKategorii } = useKategorie();
  
  // Limity trzymamy lokalnie w przeglądarce!
  const [limity, setLimity] = useState<any[]>([]);
  const [czyZaladowanoLimity, setCzyZaladowanoLimity] = useState(false);

  const [kategoria, setKategoria] = useState('');
  const [limitKwota, setLimitKwota] = useState('');
  const [progAlertu, setProgAlertu] = useState('80');
  const [isExporting, setIsExporting] = useState(false);

  // Ładowanie limitów z pamięci przeglądarki przy starcie
  useEffect(() => {
    const zapisaneLimity = localStorage.getItem('moj_budzet_limity');
    if (zapisaneLimity) {
      setLimity(JSON.parse(zapisaneLimity));
    }
    setCzyZaladowanoLimity(true);
  }, []);

  const dodajLimit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kategoria || !limitKwota) return;

    const noweLimity = [...limity];
    const index = noweLimity.findIndex((l) => l.kategoria === kategoria);
    
    const nowyLimit = {
      id: index >= 0 ? noweLimity[index].id : Date.now().toString(),
      kategoria,
      limit_kwota: parseFloat(limitKwota.replace(',', '.')),
      prog_alertu: parseFloat(progAlertu)
    };

    if (index >= 0) {
      noweLimity[index] = nowyLimit; // Aktualizacja
    } else {
      noweLimity.push(nowyLimit); // Dodanie nowego
    }
    
    setLimity(noweLimity);
    localStorage.setItem('moj_budzet_limity', JSON.stringify(noweLimity)); // Zapis do przeglądarki
    
    setKategoria('');
    setLimitKwota('');
    setProgAlertu('80');
  };

  const usunLimit = (id: string) => {
    if (!confirm('Usunąć ten limit?')) return;
    const odswiezoneLimity = limity.filter(l => l.id !== id);
    setLimity(odswiezoneLimity);
    localStorage.setItem('moj_budzet_limity', JSON.stringify(odswiezoneLimity));
  };

  const eksportujDane = async () => {
    setIsExporting(true);
    try {
      const { default: Papa } = await import('papaparse');

      // 1. Czyścimy i formatujemy dane przed eksportem
      const czysteDane = transakcje.map((t: any) => ({
        'Data transakcji': t.data_transakcji,
        'Nazwa transakcji': t.nazwa,
        'Kategoria': formatujNazweKategorii(t.kategoria),
        'Typ': t.typ === 'przychod' ? 'Przychód' : 'Wydatek',
        'Kwota (PLN)': t.kwota.toString().replace('.', ','), // Przecinek dla polskiego Excela
        'Notatki': t.notatki || ''
      }));

      // 2. Generujemy CSV używając średnika (standard PL)
      const csv = Papa.unparse(czysteDane, {
        delimiter: ';' 
      });
      
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' }); 
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Moj_Budzet_Raport_${dzisiaj()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Błąd podczas eksportu danych.');
    }
    setIsExporting(false);
  };

  if (!czyZaladowanoLimity) return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin text-[#8b5cf6]" size={40} /></div>;

  return (
    <main className="px-4 py-5 sm:p-8 md:p-10 max-w-6xl mx-auto overflow-y-auto w-full">
      <motion.header 
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="mb-10"
      >
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Ustawienia budżetu</h1>
        <p className="text-gray-500 font-medium mt-1">Ustaw limity wydatków dla poszczególnych kategorii.</p>
      </motion.header>

      <div className="space-y-8">
        {/* Na telefonie nie ma lewego paska – konto i synchronizacja są tutaj */}
        <div id="konto" className="md:hidden bg-white rounded-3xl p-5 border border-gray-100 shadow-sm scroll-mt-20 flex flex-col">
          <h2 className="text-lg font-bold text-slate-900">Konto i synchronizacja</h2>
          <StatusKonta />
        </div>
        {/* SEKCJA DODAWANIA LIMITÓW */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm"
        >
          <div className="flex items-start gap-3 mb-6">
            <div className="bg-slate-100 text-slate-700 p-2.5 rounded-xl shrink-0"><Plus size={20} /></div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Dodaj nowy limit</h2>
              <p className="text-sm text-gray-500 font-medium">Miesięczny budżet dla kategorii i próg, od którego chcesz dostać ostrzeżenie.</p>
            </div>
          </div>

          <form onSubmit={dodajLimit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto] gap-4 items-end">
            <label className="block">
              <span className="block text-sm font-bold text-gray-700 mb-2">Kategoria</span>
              <span className="relative block">
                <select required value={kategoria} onChange={(e) => setKategoria(e.target.value)} className={`${POLE} appearance-none pr-10 cursor-pointer ${kategoria ? 'text-slate-900' : 'text-gray-400'}`}>
                  <option value="">Wybierz kategorię</option>
                  {KATEGORIE_WYDATKOW.map(k => <option key={k.id} value={k.id} className="text-slate-900">{k.ikona} {k.nazwa}</option>)}
                </select>
                <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </span>
            </label>

            <label className="block">
              <span className="block text-sm font-bold text-gray-700 mb-2">Miesięczny limit</span>
              <span className="relative block">
                <input required value={limitKwota} onChange={(e) => setLimitKwota(e.target.value)} type="text" inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" title="Kwota, np. 1000 albo 1000,50" placeholder="np. 1000" className={`${POLE} pr-11 text-slate-900`} />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400 pointer-events-none">zł</span>
              </span>
            </label>

            <label className="block">
              <span className="block text-sm font-bold text-gray-700 mb-2">Ostrzeż przy</span>
              <span className="relative block">
                <input required value={progAlertu} onChange={(e) => setProgAlertu(e.target.value)} type="text" inputMode="numeric" pattern="([1-9][0-9]?|100)" title="Liczba od 1 do 100" className={`${POLE} pr-11 text-slate-900`} />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400 pointer-events-none">%</span>
              </span>
            </label>

            <button type="submit" className="h-12 sm:col-span-2 lg:col-span-1 w-full lg:w-auto bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 rounded-xl transition-all shadow-md active:scale-95 whitespace-nowrap flex items-center justify-center gap-2">
              <Plus size={18} /> Dodaj limit
            </button>
          </form>
        </motion.div>

        {/* AKTUALNE LIMITY */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm"
        >
          <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Settings size={20} className="text-slate-700" /> Aktualne limity
          </h2>

          <div className="space-y-4">
            {limity.length === 0 ? (
              <p className="text-gray-400 text-sm font-medium py-4">Brak ustawionych limitów.</p>
            ) : (
              <AnimatePresence>
                {limity.map((limit: any) => (
                  <motion.div 
                    key={limit.id}
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9, height: 0 }}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 border border-gray-100 rounded-2xl group hover:shadow-sm transition-all bg-white gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-2xl">
                        {getIcon('wydatek', limit.kategoria)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-lg">{formatujNazweKategorii(limit.kategoria)}</p>
                        <p className="text-sm text-gray-500 font-medium">Limit: <span className="text-slate-700">{formatujWalute(limit.limit_kwota)}</span> • Alert: {limit.prog_alertu}%</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 self-end md:self-auto">
                      <button 
                        onClick={() => { setKategoria(limit.kategoria); setLimitKwota(limit.limit_kwota.toString()); setProgAlertu(limit.prog_alertu.toString()); window.scrollTo({top: 0, behavior: 'smooth'}); }} 
                        className="px-4 py-2 text-sm font-bold text-slate-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        Edytuj
                      </button>
                      <button onClick={() => usunLimit(limit.id)} className="text-red-400 hover:text-red-600 p-2 rounded-xl hover:bg-red-50 transition-colors" title="Usuń limit">
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </motion.div>

        <WlasneKategorie />

        <PorzadkowanieKategorii />

        <KopiaZapasowa />

        {/* EKSPORT DANYCH */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Download size={20} className="text-slate-700" /> Eksport danych
              </h2>
              <p className="text-gray-500 text-sm font-medium">Pobierz całą swoją historię transakcji w formacie CSV (do Excela lub arkuszy Google).</p>
            </div>
            <button onClick={eksportujDane} disabled={isExporting || isLoading || transakcje.length === 0} className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-2 justify-center whitespace-nowrap">
              {isExporting ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />} Pobierz CSV
            </button>
          </div>
        </motion.div>
        
      </div>
    </main>
  );
}