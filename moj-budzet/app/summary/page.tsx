'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useTransakcje } from '../../lib/useTransakcje';
import { formatujWalute, dzisiaj } from '../../lib/budzet';
import { useKategorie } from '../../components/KategorieProvider';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, PiggyBank, BarChart3, Clock, Loader2, Calendar } from 'lucide-react';

const WykresSlupkowy = dynamic(() => import('../../components/WykresSlupkowy'), { ssr: false });

const nazwyMsc = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];

export default function SummaryPage() {
  const { data: transakcje = [], isLoading } = useTransakcje();
  const { getIcon, formatujNazweKategorii } = useKategorie();
  
  const [okres, setOkres] = useState('biezacy_rok'); 
  const [dataOd, setDataOd] = useState('');
  const [dataDo, setDataDo] = useState('');

  // Daty to stringi YYYY-MM-DD, więc porównujemy je bezpośrednio, bez tworzenia obiektów Date
  const przefiltrowaneTransakcje = useMemo(() => {
    const dzis = dzisiaj();
    return transakcje.filter(t => {
      const d = t.data_transakcji;
      if (okres === 'biezacy_miesiac') return d.startsWith(dzis.slice(0, 7));
      if (okres === 'biezacy_rok') return d.startsWith(dzis.slice(0, 4));
      if (okres === 'niestandardowy') {
        if (!dataOd || !dataDo) return true; // Jak ktoś nie wpisał jeszcze dat, pokazujemy wszystko
        return d >= dataOd && d <= dataDo;
      }
      return true;
    });
  }, [transakcje, okres, dataOd, dataDo]);

  // Obliczenia główne + dane do wykresu w jednym przejściu
  const { przychody, wydatki, liczbaPrzychodow, liczbaWydatkow, kategorieWydatkow, liczbaMiesiecy, chartData } = useMemo(() => {
    let p = 0; let w = 0; let lp = 0; let lw = 0;
    const katMap: Record<string, number> = {};
    const miesiace: Record<string, { nazwa: string; Przychody: number; Wydatki: number }> = {};

    przefiltrowaneTransakcje.forEach(t => {
      const kwota = Number(t.kwota);
      const klucz = t.data_transakcji.substring(0, 7);
      if (!miesiace[klucz]) {
        const [r, m] = klucz.split('-');
        miesiace[klucz] = { nazwa: `${nazwyMsc[Number(m) - 1]} ${r}`, Przychody: 0, Wydatki: 0 };
      }

      if (t.typ === 'przychod') { p += kwota; lp++; miesiace[klucz].Przychody += kwota; }
      else {
        miesiace[klucz].Wydatki += kwota;
        if (t.typ === 'wydatek') {
          w += kwota; lw++;
          const k = t.kategoria || 'inne_wydatki';
          katMap[k] = (katMap[k] || 0) + kwota;
        }
      }
    });

    const katArr = Object.keys(katMap).map(k => ({ nazwa: k, kwota: katMap[k] })).sort((a, b) => b.kwota - a.kwota);
    const klucze = Object.keys(miesiace).sort();
    return {
      przychody: p, wydatki: w, liczbaPrzychodow: lp, liczbaWydatkow: lw, kategorieWydatkow: katArr,
      liczbaMiesiecy: klucze.length || 1,
      chartData: klucze.map(k => miesiace[k]),
    };
  }, [przefiltrowaneTransakcje]);

  const bilans = przychody - wydatki;
  
  if (isLoading) return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin text-[#8b5cf6]" size={40} /></div>;

  return (
    <main className="p-8 md:p-10 max-w-6xl mx-auto overflow-y-auto w-full">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Podsumowanie</h1>
        <p className="text-gray-500 font-medium mt-1 mb-8">Zaawansowana analityka portfela</p>
      </motion.div>

      {/* FILTRY */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-start mb-8 w-fit"
      >
        <div className="flex flex-wrap gap-4 items-center">
          <span className="text-sm font-bold text-gray-400 uppercase tracking-wider ml-2 mr-2 flex items-center gap-2">
            <Calendar size={18}/> Wybierz okres
          </span>
          <button onClick={() => setOkres('biezacy_miesiac')} className={`px-5 py-2.5 rounded-xl font-bold transition-all ${okres === 'biezacy_miesiac' ? 'bg-slate-900 text-white shadow-md' : 'bg-transparent text-slate-600 hover:bg-gray-100'}`}>Bieżący miesiąc</button>
          <button onClick={() => setOkres('biezacy_rok')} className={`px-5 py-2.5 rounded-xl font-bold transition-all ${okres === 'biezacy_rok' ? 'bg-slate-900 text-white shadow-md' : 'bg-transparent text-slate-600 hover:bg-gray-100'}`}>Bieżący rok</button>
          <button onClick={() => setOkres('niestandardowy')} className={`px-5 py-2.5 rounded-xl font-bold transition-all ${okres === 'niestandardowy' ? 'bg-slate-900 text-white shadow-md' : 'bg-transparent text-slate-600 hover:bg-gray-100'}`}>Niestandardowy</button>
        </div>

        {/* POLA DAT BEZ FRAMER MOTION (żeby systemowe kalendarze z Safari działały płynnie) */}
        {okres === 'niestandardowy' && (
          <div className="flex gap-4 mt-4 bg-gray-50 p-4 rounded-2xl border border-gray-100 animate-in fade-in w-full">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 mb-1">Data początkowa</label>
              <input type="date" value={dataOd} onChange={(e) => setDataOd(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20 bg-white" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 mb-1">Data końcowa</label>
              <input type="date" value={dataDo} onChange={(e) => setDataDo(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20 bg-white" />
            </div>
          </div>
        )}
      </motion.div>

      {/* 4 KARTY */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[
          { tytul: 'PRZYCHODY', kwota: przychody, podtytul: `${liczbaPrzychodow} transakcji`, ikona: <TrendingUp size={20} />, bg: 'bg-[#22c55e]' },
          { tytul: 'WYDATKI', kwota: wydatki, podtytul: `${liczbaWydatkow} transakcji`, ikona: <TrendingDown size={20} />, bg: 'bg-[#ef4444]' },
          { tytul: 'BILANS', kwota: bilans, podtytul: bilans >= 0 ? 'Nadwyżka' : 'Deficyt', ikona: <PiggyBank size={20} />, bg: 'bg-[#1e293b]' },
          { tytul: 'WYDATKI / MIESIĘCZNIE', kwota: wydatki / liczbaMiesiecy, podtytul: `Z ${liczbaMiesiecy} aktywnych miesięcy`, ikona: <BarChart3 size={20} />, bg: 'bg-[#8b5cf6]' }
        ].map((karta, index) => (
          <motion.div 
            key={karta.tytul}
            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.4, delay: index * 0.1 }}
            className={`${karta.bg} text-white p-6 rounded-3xl relative overflow-hidden shadow-lg`}
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-bold uppercase tracking-wider opacity-90">{karta.tytul}</span>
              <div className="bg-white/20 p-2 rounded-xl">{karta.ikona}</div>
            </div>
            <div className="text-3xl font-extrabold tracking-tight">{formatujWalute(karta.kwota)}</div>
            <p className="text-xs opacity-80 font-medium mt-2">{karta.podtytul}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        {/* ŚREDNIE MIESIĘCZNE */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm"
        >
          <h2 className="text-xl font-extrabold text-slate-900 mb-6 flex items-center gap-2"><Clock size={20} className="text-gray-400"/> Średnie Miesięczne</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-[#f0fdf4] p-5 rounded-2xl">
              <span className="font-bold text-slate-700">Przychody</span>
              <span className="font-bold text-xl text-[#16a34a]">{formatujWalute(przychody / liczbaMiesiecy)}</span>
            </div>
            <div className="flex justify-between items-center bg-[#fef2f2] p-5 rounded-2xl">
              <span className="font-bold text-slate-700">Wydatki</span>
              <span className="font-bold text-xl text-[#dc2626]">{formatujWalute(wydatki / liczbaMiesiecy)}</span>
            </div>
            <div className="flex justify-between items-center bg-gray-50 p-5 rounded-2xl">
              <span className="font-bold text-slate-700">Bilans</span>
              <span className={`font-bold text-xl ${bilans >= 0 ? 'text-slate-900' : 'text-[#dc2626]'}`}>{formatujWalute(bilans / liczbaMiesiecy)}</span>
            </div>
          </div>
        </motion.div>

        {/* WYDATKI NA KATEGORIE */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
          className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm h-fit"
        >
          <h2 className="text-xl font-extrabold text-slate-900 mb-6">Średnie wydatki na kategorie</h2>
          <div className="space-y-2">
            {kategorieWydatkow.length === 0 ? (
               <p className="text-center text-gray-400 py-6 font-medium">Brak wydatków w tym okresie.</p>
            ) : (
              kategorieWydatkow.map((kat, index) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + (index * 0.05) }}
                  key={index} className="flex items-center justify-between p-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-2xl">{getIcon('wydatek', kat.nazwa)}</div>
                    <div>
                      <p className="font-bold text-slate-900">{formatujNazweKategorii(kat.nazwa)}</p>
                      <p className="text-xs text-gray-400 font-medium">średnio na miesiąc</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-slate-900">{formatujWalute(kat.kwota / liczbaMiesiecy)}</p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* WYKRES */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.5 }}
        className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm"
      >
        <h2 className="text-xl font-extrabold text-slate-900 mb-8">Wykres Miesięczny</h2>
        <div className="h-80 w-full">
          {chartData.length > 0 ? (
            <WykresSlupkowy data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={40} radius={6} kolorPrzychodow="#22c55e" rozmiarOsiX={13} formatOsiY={(val) => `${val} zł`} />
          ) : (
            <div className="flex justify-center items-center h-full text-gray-400 font-medium">Brak danych do wyświetlenia</div>
          )}
        </div>
      </motion.div>

    </main>
  );
}