'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { dodajTransakcje as zapiszTransakcje } from '../lib/magazyn';
import { useTransakcje } from '../lib/useTransakcje';
import { formatujWalute, dzisiaj, prefiksMiesiaca } from '../lib/budzet';
import { useKategorie } from '../components/KategorieProvider';
import { Plus, Wallet, TrendingUp, TrendingDown, X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const WykresSlupkowy = dynamic(() => import('../components/WykresSlupkowy'), { ssr: false });

const nazwyMiesiecy = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];

export default function Home() {
  const { data: wszystkieTransakcje = [], isLoading } = useTransakcje();
  const { KATEGORIE_WYDATKOW, KATEGORIE_PRZYCHODOW, getIcon, getCategoryColor, formatujNazweKategorii } = useKategorie();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactionType, setTransactionType] = useState('wydatek');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [miesiac, setMiesiac] = useState(new Date().getMonth());
  const [rok, setRok] = useState(new Date().getFullYear());

  const [nazwa, setNazwa] = useState('');
  const [kwota, setKwota] = useState('');
  const [kategoria, setKategoria] = useState('');
  const [notatki, setNotatki] = useState('');
  const [dataTransakcji, setDataTransakcji] = useState(dzisiaj);

  // Liczone w trakcie renderu zamiast useEffect + setState (bez dodatkowego przerenderowania)
  const { przychody, wydatki, listaZMiesiaca, daneKategorii } = useMemo(() => {
    let sumaPrzychody = 0;
    let sumaWydatki = 0;
    const wydatkiTemp: Record<string, number> = {};
    const prefiks = prefiksMiesiaca(rok, miesiac);

    const przefiltrowane = wszystkieTransakcje.filter(t => t.data_transakcji.startsWith(prefiks));

    przefiltrowane.forEach(t => {
      const kwotaNum = Number(t.kwota);
      if (t.typ === 'przychod') {
        sumaPrzychody += kwotaNum;
      } else if (t.typ === 'wydatek') {
        sumaWydatki += kwotaNum;
        const kat = t.kategoria || 'inne_wydatki';
        wydatkiTemp[kat] = (wydatkiTemp[kat] || 0) + kwotaNum;
      }
    });

    const kategoriaArray = Object.keys(wydatkiTemp).map(klucz => ({
      nazwa: klucz,
      kwota: wydatkiTemp[klucz],
      procent: sumaWydatki > 0 ? Math.round((wydatkiTemp[klucz] / sumaWydatki) * 100) : 0
    })).sort((a, b) => b.kwota - a.kwota);

    return { przychody: sumaPrzychody, wydatki: sumaWydatki, listaZMiesiaca: przefiltrowane, daneKategorii: kategoriaArray };
  }, [miesiac, rok, wszystkieTransakcje]);

  const zmienMiesiac = (kierunek: number) => {
    let nowyMiesiac = miesiac + kierunek;
    let nowyRok = rok;

    if (nowyMiesiac < 0) { nowyMiesiac = 11; nowyRok -= 1; } 
    else if (nowyMiesiac > 11) { nowyMiesiac = 0; nowyRok += 1; }
    
    setMiesiac(nowyMiesiac); setRok(nowyRok);
  };

  const dodajTransakcje = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const { error } = zapiszTransakcje([
      { nazwa, kwota: parseFloat(kwota), typ: transactionType as 'przychod' | 'wydatek', kategoria, data_transakcji: dataTransakcji, notatki }
    ]);
    setIsSubmitting(false);
    if (!error) {
      setNazwa(''); setKwota(''); setNotatki(''); setIsModalOpen(false);
    }
  };

  const chartData = [
    { nazwa: `${nazwyMiesiecy[miesiac]} ${rok}`, Przychody: przychody, Wydatki: wydatki }
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-slate-400 w-full">
        <Loader2 size={48} className="animate-spin mb-4 text-[#8b5cf6]" />
        <h2 className="text-xl font-bold">Ładowanie Twojego portfela...</h2>
      </div>
    );
  }

  return (
    <main className="p-8 md:p-10 max-w-6xl mx-auto overflow-y-auto w-full">
      
      <motion.header 
        initial={{ opacity: 0, y: -20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.5 }}
        className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-10"
      >
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Dashboard</h1>
          <div className="flex items-center gap-4 mt-3 bg-white w-fit px-4 py-2 rounded-xl border border-gray-100 shadow-sm">
            <button onClick={() => zmienMiesiac(-1)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-slate-900"><ChevronLeft size={20} /></button>
            <span className="text-lg font-bold text-slate-900 min-w-[120px] text-center">{nazwyMiesiecy[miesiac]} {rok}</span>
            <button onClick={() => zmienMiesiac(1)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-slate-900"><ChevronRight size={20} /></button>
          </div>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-slate-900 text-white px-5 py-3 rounded-xl font-semibold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-md active:scale-95">
          <Plus size={20} /> Nowa transakcja
        </button>
      </motion.header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {[
          { tytul: 'Bilans', kwota: przychody - wydatki, ikona: <Wallet size={20} />, kolorBg: 'bg-[#1e293b]', kolorText: 'text-slate-300' },
          { tytul: 'Przychody', kwota: przychody, ikona: <TrendingUp size={20} />, kolorBg: 'bg-[#22c55e]', kolorText: 'text-emerald-50' },
          { tytul: 'Wydatki', kwota: wydatki, ikona: <TrendingDown size={20} />, kolorBg: 'bg-[#ef4444]', kolorText: 'text-red-50' }
        ].map((karta, index) => (
          <motion.div 
            key={karta.tytul}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className={`${karta.kolorBg} text-white p-6 rounded-3xl shadow-lg relative overflow-hidden`}
          >
            <div className="flex justify-between items-start mb-6 relative z-10">
              <span className={`${karta.kolorText} font-medium`}>{karta.tytul}</span>
              <div className="bg-white/10 p-2.5 rounded-xl">{karta.ikona}</div>
            </div>
            <div className="text-4xl font-bold relative z-10 tracking-tight">{formatujWalute(karta.kwota)}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="lg:col-span-2 bg-white rounded-3xl p-8 border border-gray-100 shadow-sm"
        >
          <h2 className="text-xl font-extrabold text-slate-900 mb-6">Transakcje - {nazwyMiesiecy[miesiac]}</h2>
          <div className="space-y-2">
            {listaZMiesiaca.length === 0 ? (
              <div className="text-center py-10">
                <span className="text-4xl mb-3 block">👻</span>
                <p className="text-gray-400 font-medium">Brak transakcji w tym miesiącu.</p>
              </div>
            ) : (
              listaZMiesiaca.slice(0, 5).map((t, i) => (
                <motion.div 
                  key={t.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition-all border border-transparent hover:border-gray-100"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${t.typ === 'przychod' ? 'bg-emerald-50' : 'bg-orange-50'}`}>{getIcon(t.typ, t.kategoria)}</div>
                    <div>
                      <p className="font-bold text-slate-900 text-lg capitalize truncate max-w-[150px] md:max-w-xs">{t.nazwa}</p>
                      <p className="text-sm text-gray-500 font-medium capitalize">{formatujNazweKategorii(t.kategoria || 'inne_wydatki')} • {t.data_transakcji}</p>
                    </div>
                  </div>
                  <span className={`font-bold text-lg ${t.typ === 'przychod' ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {t.typ === 'przychod' ? '+' : '-'}{formatujWalute(Number(t.kwota))}
                  </span>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm h-fit"
        >
          <h2 className="text-xl font-extrabold text-slate-900 mb-8">Wydatki wg kategorii</h2>
          <div className="space-y-6">
            {daneKategorii.length === 0 ? (
              <p className="text-gray-400 text-center py-10">Brak wydatków</p>
            ) : (
              daneKategorii.map((kat, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  <div className="flex justify-between items-end mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{getIcon('wydatek', kat.nazwa)}</span>
                      <span className="font-bold text-slate-900 capitalize">{formatujNazweKategorii(kat.nazwa)}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-900">{formatujWalute(kat.kwota)}</span>
                      <span className="text-sm text-gray-400 font-medium ml-2">{kat.procent}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${kat.procent}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      style={{ backgroundColor: getCategoryColor(kat.nazwa) }}
                      className="h-3 rounded-full"
                    />
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm mb-10"
      >
        <h2 className="text-xl font-extrabold text-slate-900 mb-8">Porównanie: {nazwyMiesiecy[miesiac]} {rok}</h2>
        <div className="h-72 w-full">
          <WykresSlupkowy data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }} barSize={60} radius={8} kolorPrzychodow="#10b981" rozmiarOsiX={14} />
        </div>
      </motion.div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"/>
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: "spring", duration: 0.5 }} className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden relative z-10">
              <div className="flex justify-between items-center p-6 border-b border-gray-100"><h2 className="text-2xl font-bold text-slate-900">Nowa transakcja</h2><button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-slate-900 p-1"><X size={24} /></button></div>
              <form onSubmit={dodajTransakcje} className="p-6">
                <div className="bg-gray-100 p-1 rounded-2xl flex mb-6">
                  <button type="button" onClick={() => setTransactionType('wydatek')} className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${transactionType === 'wydatek' ? 'bg-white shadow-sm text-slate-900' : 'text-gray-500 hover:text-slate-700'}`}>Wydatek</button>
                  <button type="button" onClick={() => setTransactionType('przychod')} className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${transactionType === 'przychod' ? 'bg-white shadow-sm text-slate-900' : 'text-gray-500 hover:text-slate-700'}`}>Przychód</button>
                </div>
                <div className="space-y-4">
                  <div><label className="block text-sm font-bold text-gray-700 mb-1.5">Nazwa</label><input required value={nazwa} onChange={(e) => setNazwa(e.target.value)} type="text" placeholder="np. Zakupy" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20 transition-all" /></div>
                  <div><label className="block text-sm font-bold text-gray-700 mb-1.5">Kwota (zł)</label><input required value={kwota} onChange={(e) => setKwota(e.target.value)} type="number" step="0.01" min="0.01" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20 transition-all" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1.5">Kategoria</label>
                      <select required value={kategoria} onChange={(e) => setKategoria(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none bg-white">
                        <option value="">Wybierz</option>
                        {(transactionType === 'wydatek' ? KATEGORIE_WYDATKOW : KATEGORIE_PRZYCHODOW).map(k => (
                          <option key={k.id} value={k.id}>{k.ikona} {k.nazwa}</option>
                        ))}
                      </select>
                    </div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1.5">Data</label><input required value={dataTransakcji} onChange={(e) => setDataTransakcji(e.target.value)} type="date" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20" /></div>
                  </div>
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full mt-6 bg-[#bfa8ff] hover:bg-[#a78bfa] text-white font-bold py-3.5 rounded-xl transition-colors shadow-sm disabled:opacity-50">{isSubmitting ? 'Zapisywanie...' : 'Dodaj'}</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}