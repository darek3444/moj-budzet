'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase'; 
import useSWR from 'swr';
import { Plus, Search, X, UploadCloud, Trash2, Pencil } from 'lucide-react';
import Papa from 'papaparse'; 
import { motion, AnimatePresence } from 'framer-motion';

const fetcher = async () => {
  const { data } = await supabase.from('transactions').select('*').order('data_transakcji', { ascending: false });
  return data || [];
};

export default function TransactionsPage() {
  const { data: transakcje = [], mutate, isLoading } = useSWR('dane_transakcji', fetcher);

  const [wyszukiwarka, setWyszukiwarka] = useState('');
  const [filtrTyp, setFiltrTyp] = useState('wszystkie');
  const [filtrKategoria, setFiltrKategoria] = useState('wszystkie');

  const [zaznaczoneId, setZaznaczoneId] = useState<string[]>([]);
  const [czyUsuwa, setCzyUsuwa] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); 
  
  const [transactionType, setTransactionType] = useState('wydatek');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nazwa, setNazwa] = useState('');
  const [kwota, setKwota] = useState('');
  const [kategoria, setKategoria] = useState('');
  const [notatki, setNotatki] = useState('');
  const [dataTransakcji, setDataTransakcji] = useState(new Date().toISOString().split('T')[0]);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [wybranyBank, setWybranyBank] = useState('');
  const [plik, setPlik] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  let bilans = 0;
  transakcje.forEach((t: any) => {
    if (t.typ === 'przychod') bilans += Number(t.kwota);
    if (t.typ === 'wydatek') bilans -= Number(t.kwota);
  });

  const formatujWalute = (wartosc: number) => {
    return `${wartosc.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
  };

  const otworzDoEdycji = (t: any) => {
    setEditingId(t.id);
    setTransactionType(t.typ);
    setNazwa(t.nazwa);
    setKwota(t.kwota.toString());
    setKategoria(t.kategoria || '');
    setDataTransakcji(t.data_transakcji);
    setNotatki(t.notatki || '');
    setIsModalOpen(true);
  };

  const otworzDoDodania = () => {
    setEditingId(null); 
    setNazwa(''); setKwota(''); setNotatki(''); setKategoria('');
    setDataTransakcji(new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  const zapiszTransakcje = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = { 
      nazwa, kwota: parseFloat(kwota), typ: transactionType, 
      kategoria, data_transakcji: dataTransakcji, notatki 
    };

    if (editingId) {
      const { error } = await supabase.from('transactions').update(payload).eq('id', editingId);
      if (!error) { setIsModalOpen(false); mutate(); } else alert('Błąd: ' + error.message);
    } else {
      const { error } = await supabase.from('transactions').insert([payload]);
      if (!error) { setNazwa(''); setKwota(''); setNotatki(''); setIsModalOpen(false); mutate(); } else alert('Błąd: ' + error.message);
    }
    setIsSubmitting(false);
  };

  const usunTransakcje = async (listaIdDoUsuniecia: string[]) => {
    if (!confirm(`Czy usunąć ${listaIdDoUsuniecia.length} transakcji?`)) return;
    setCzyUsuwa(true);
    const { error } = await supabase.from('transactions').delete().in('id', listaIdDoUsuniecia);
    setCzyUsuwa(false);
    if (!error) { setZaznaczoneId([]); mutate(); } else alert('Błąd: ' + error.message);
  };

  const toggleZaznaczenie = (id: string) => {
    setZaznaczoneId(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const przetworzWyciag = async () => {
    if (!plik || !wybranyBank) return;
    setIsImporting(true);

    try {
      const gotoweTransakcje: any[] = [];

      if (plik.name.toLowerCase().endsWith('.pdf')) {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const arrayBuffer = await plik.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let pelnyTekst = '';

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          
          content.items.sort((a: any, b: any) => {
            if (Math.abs(b.transform[5] - a.transform[5]) > 5) return b.transform[5] - a.transform[5];
            return a.transform[4] - b.transform[4];
          });

          let currentY: number = -9999;
          let textLine = '';
          content.items.forEach((item: any) => {
            if (currentY === -9999 || Math.abs(item.transform[5] - currentY) > 5) {
              if (textLine) pelnyTekst += textLine + '\n';
              textLine = item.str;
              currentY = item.transform[5];
            } else {
              textLine += ' ' + item.str;
            }
          });
          if (textLine) pelnyTekst += textLine + '\n';
        }

        const plaskiTekst = pelnyTekst.replace(/\n/g, ' ').replace(/\s+/g, ' ');
        const bloki = plaskiTekst.split(/(?=\d{2}\.\d{2}\.\d{4}\s)/);

        bloki.forEach(blok => {
          const dateMatch = blok.match(/^(\d{2}\.\d{2}\.\d{4})/);
          const amountMatch = blok.match(/(-?\s*\d{1,3}(?:[\s\u00A0]\d{3})*,\d{2})\s+PLN/);

          if (dateMatch && amountMatch) {
            const dataRaw = dateMatch[1];
            const rawAmount = amountMatch[1];
            const dataTransakcji = dataRaw.split('.').reverse().join('-');
            const kwotaStr = rawAmount.replace(/[\s\u00A0]/g, '').replace(',', '.');
            const parsedKwota = parseFloat(kwotaStr);

            let czystaNazwa = blok
               .replace(dateMatch[0], '').replace(amountMatch[0], '').replace(/\d{2}\.\d{2}\.\d{4}/g, '')
               .replace(/Nazwa i adres odbiorcy:/g, '').replace(/Nazwa i adres płatnika:/g, '')
               .replace(/Płatność kart[aą].*?Nr karty \d{4}xx\d{4}/g, '')
               .replace(/Kwota:\s*\d{1,3}(?:[\s\u00A0]\d{3})*,\d{2}\s*PLN/g, '') 
               .replace(/TR\.KART\s*\d+/g, '').replace(/PRZELEW\s*\d+/g, '').replace(/P\.BLIK\s*\d+/g, '')
               .replace(/przelew Smart Saver/g, 'Smart Saver').replace(/\d{26}/g, '') 
               .replace(/\d{2} \d{4} \d{4} \d{4} \d{4} \d{4} \d{4}/g, '').replace(/Nr transakcji \d+/g, '')
               .replace(/[\d-]{15,}/g, '').trim();
          
            if (czystaNazwa.length < 3) czystaNazwa = "Transakcja z ING";
            czystaNazwa = czystaNazwa.substring(0, 60).trim();

            if (!isNaN(parsedKwota) && parsedKwota !== 0) {
              gotoweTransakcje.push({ nazwa: czystaNazwa, kwota: Math.abs(parsedKwota), typ: parsedKwota > 0 ? 'przychod' : 'wydatek', kategoria: 'inne_wydatki', data_transakcji: dataTransakcji, notatki: 'Import z PDF (ING)' });
            }
          }
        });

      } else if (plik.name.toLowerCase().endsWith('.csv')) {
        const reader = new FileReader();
        reader.readAsText(plik, 'windows-1250');
        
        await new Promise((resolve) => {
          reader.onload = async (e) => {
            const text = e.target?.result as string;
            const lines = text.split('\n');
            let startIdx = 0;
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes('#Data operacji') || lines[i].includes('Data operacji')) { startIdx = i; break; }
            }
            const cleanText = lines.slice(startIdx).join('\n');

            Papa.parse(cleanText, {
              header: true, skipEmptyLines: true, delimiter: ';', 
              complete: (results) => {
                results.data.forEach((row: any) => {
                  let parsedKwota = 0, parsedNazwa = 'Nieznana transakcja', parsedData = new Date().toISOString().split('T')[0], parsedNotatki = '';
                  try {
                    if (wybranyBank === 'mbank') {
                      const kwotaStr = row['#Kwota'] || row['Kwota'] || '0';
                      parsedKwota = parseFloat(kwotaStr.replace(/\s/g, '').replace(',', '.'));
                      const opis = row['#Opis operacji'] || row['Opis operacji'] || '';
                      const tytul = row['#Tytuł'] || row['Tytuł'] || '';
                      parsedNazwa = tytul ? `${opis} - ${tytul}` : opis;
                      parsedNazwa = parsedNazwa.replace(/"/g, '').substring(0, 60).trim();
                      const d = row['#Data operacji'] || row['Data operacji'];
                      if (d) parsedData = d.trim(); parsedNotatki = 'Import z mBanku';
                    } else if (wybranyBank === 'pekao') {
                      const kwotaStr = row['Kwota operacji'] || row['Kwota'] || '0';
                      parsedKwota = parseFloat(kwotaStr.replace(/\s/g, '').replace(',', '.'));
                      parsedNazwa = row['Tytuł przelewu'] || row['Nadawca / Odbiorca'] || 'Transakcja Pekao';
                      const d = row['Data księgowania'] || row['Data operacji'];
                      if (d) parsedData = d.split('.').reverse().join('-'); 
                    }
                    if (!isNaN(parsedKwota) && parsedKwota !== 0) {
                      gotoweTransakcje.push({ nazwa: parsedNazwa || 'Brak nazwy', kwota: Math.abs(parsedKwota), typ: parsedKwota > 0 ? 'przychod' : 'wydatek', kategoria: 'inne_wydatki', data_transakcji: parsedData, notatki: parsedNotatki });
                    }
                  } catch (err) {}
                });
                resolve(true);
              }
            });
          };
        });
      }

      if (gotoweTransakcje.length > 0) {
        const { error } = await supabase.from('transactions').insert(gotoweTransakcje);
        if (!error) {
          alert(`Sukces! Zaimportowano ${gotoweTransakcje.length} transakcji.`);
          setPlik(null); setIsImportModalOpen(false); mutate(); 
        } else alert('Błąd bazy: ' + error.message);
      } else {
        alert('Nie udało się odczytać żadnych transakcji z tego pliku.');
      }
    } catch (err) {
      alert('Wystąpił problem podczas przetwarzania pliku.');
    }
    setIsImporting(false);
  };

  const przefiltrowaneTransakcje = transakcje.filter((t: any) => {
    const pasujeNazwa = t.nazwa.toLowerCase().includes(wyszukiwarka.toLowerCase());
    const pasujeTyp = filtrTyp === 'wszystkie' || t.typ === filtrTyp;
    const pasujeKategoria = filtrKategoria === 'wszystkie' || t.kategoria === filtrKategoria;
    return pasujeNazwa && pasujeTyp && pasujeKategoria;
  });

  const toggleZaznaczWszystkie = () => {
    if (zaznaczoneId.length === przefiltrowaneTransakcje.length) setZaznaczoneId([]);
    else setZaznaczoneId(przefiltrowaneTransakcje.map((t: any) => t.id));
  };

  const getIcon = (typ: string, kat: string) => {
    if (kat === 'wynagrodzenie') return '💰';
    if (kat === 'freelance') return '💻';
    if (kat === 'inwestycje') return '📈';
    if (kat === 'inne_przychody') return '🎁';
    if (typ === 'przychod') return '💵';

    switch(kat) {
      case 'jedzenie': return '🍕'; case 'transport': return '🚗'; case 'mieszkanie': return '🏠';
      case 'rozrywka': return '🎮'; case 'zdrowie': return '💊'; case 'edukacja': return '📚'; 
      case 'ubrania': return '👕'; case 'subskrypcje': return '📱'; case 'oszczednosci': return '🏦';
      case 'inne_wydatki': return '📦'; default: return '💸';
    }
  };

  const formatujNazweKategorii = (kat: string) => {
    const nazwy: any = {
      'jedzenie': 'Jedzenie', 'transport': 'Transport', 'mieszkanie': 'Mieszkanie',
      'rozrywka': 'Rozrywka', 'zdrowie': 'Zdrowie', 'edukacja': 'Edukacja',
      'ubrania': 'Ubrania', 'subskrypcje': 'Subskrypcje', 'oszczednosci': 'Oszczędności',
      'inne_wydatki': 'Inne wydatki', 'wynagrodzenie': 'Wynagrodzenie', 'freelance': 'Freelance',
      'inwestycje': 'Inwestycje', 'inne_przychody': 'Inne przychody'
    };
    return nazwy[kat] || kat;
  };

  return (
    <main className="p-8 md:p-10 max-w-6xl mx-auto overflow-y-auto w-full overflow-x-hidden">
      
      <motion.header 
        initial={{ opacity: 0, y: -20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.5 }}
        className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8"
      >
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Transakcje</h1>
          <p className="text-gray-500 font-medium mt-1">
            {przefiltrowaneTransakcje.length} transakcji • Bilans: 
            <span className={bilans >= 0 ? "text-emerald-600 ml-1" : "text-red-500 ml-1"}>
              {bilans > 0 ? '+' : ''}{formatujWalute(Math.abs(bilans))}
            </span>
          </p>
        </div>
        
        <div className="flex gap-3">
          <button onClick={() => setIsImportModalOpen(true)} className="bg-white border-2 border-slate-200 text-slate-700 px-5 py-3 rounded-xl font-semibold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm active:scale-95">
            <UploadCloud size={20} /> Importuj
          </button>
          
          <button onClick={otworzDoDodania} className="bg-slate-900 text-white px-5 py-3 rounded-xl font-semibold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-md active:scale-95">
            <Plus size={20} /> Nowa
          </button>
        </div>
      </motion.header>

      <motion.div 
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 mb-8"
      >
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input type="text" value={wyszukiwarka} onChange={(e) => setWyszukiwarka(e.target.value)} placeholder="Szukaj transakcji..." className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20 transition-all"/>
        </div>
        <div className="flex gap-4">
          <select value={filtrTyp} onChange={(e) => setFiltrTyp(e.target.value)} className="px-4 py-3 rounded-xl border border-gray-200 bg-white font-medium text-slate-700 min-w-[140px] cursor-pointer">
            <option value="wszystkie">Wszystkie</option><option value="przychod">Przychody</option><option value="wydatek">Wydatki</option>
          </select>
          <select value={filtrKategoria} onChange={(e) => setFiltrKategoria(e.target.value)} className="px-4 py-3 rounded-xl border border-gray-200 bg-white font-medium text-slate-700 min-w-[180px] cursor-pointer capitalize">
            <option value="wszystkie">Wszystkie kategorie</option>
            <optgroup label="Wydatki">
              <option value="jedzenie">🍕 Jedzenie</option><option value="transport">🚗 Transport</option>
              <option value="mieszkanie">🏠 Mieszkanie</option><option value="rozrywka">🎮 Rozrywka</option>
              <option value="zdrowie">💊 Zdrowie</option><option value="edukacja">📚 Edukacja</option>
              <option value="ubrania">👕 Ubrania</option><option value="subskrypcje">📱 Subskrypcje</option>
              <option value="oszczednosci">🏦 Oszczędności</option><option value="inne_wydatki">📦 Inne wydatki</option>
            </optgroup>
            <optgroup label="Przychody">
              <option value="wynagrodzenie">💰 Wynagrodzenie</option><option value="freelance">💻 Freelance</option>
              <option value="inwestycje">📈 Inwestycje</option><option value="inne_przychody">🎁 Inne przychody</option>
            </optgroup>
          </select>
        </div>
      </motion.div>

      <AnimatePresence>
        {zaznaczoneId.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0, marginBottom: 0 }} 
            animate={{ opacity: 1, height: 'auto', marginBottom: 24 }} 
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex justify-between items-center">
              <span className="font-bold text-red-800">Zaznaczono {zaznaczoneId.length} transakcji</span>
              <button onClick={() => usunTransakcje(zaznaczoneId)} disabled={czyUsuwa} className="bg-red-500 hover:bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2">
                <Trash2 size={18} /> {czyUsuwa ? 'Usuwanie...' : 'Usuń wybrane'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
        className="bg-white rounded-3xl p-4 md:p-8 border border-gray-100 shadow-sm space-y-2 min-h-[400px]"
      >
        {przefiltrowaneTransakcje.length > 0 && (
          <div className="flex items-center gap-3 px-4 pb-4 border-b border-gray-50 mb-2">
            <input type="checkbox" checked={zaznaczoneId.length === przefiltrowaneTransakcje.length} onChange={toggleZaznaczWszystkie} className="w-5 h-5 rounded cursor-pointer accent-[#8b5cf6]" />
            <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Zaznacz wszystkie</span>
          </div>
        )}

        {isLoading ? (
           <p className="text-center text-gray-400 py-10 font-bold">Ładowanie transakcji...</p>
        ) : przefiltrowaneTransakcje.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20">
            <span className="text-4xl mb-4">🔍</span>
            <p className="font-medium text-lg">Brak transakcji</p>
          </div>
        ) : (
          <AnimatePresence>
            {przefiltrowaneTransakcje.map((t: any, i: number) => (
              <motion.div 
                key={t.id} 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, backgroundColor: "#fef2f2" }}
                transition={{ duration: 0.3, delay: i * 0.05 > 1 ? 0 : i * 0.05 }}
                className={`flex items-center justify-between p-4 rounded-2xl transition-all border group ${zaznaczoneId.includes(t.id) ? 'bg-violet-50/50 border-violet-100' : 'border-transparent hover:border-gray-100 hover:bg-gray-50'}`}
              >
                <div className="flex items-center gap-4">
                  <input type="checkbox" checked={zaznaczoneId.includes(t.id)} onChange={() => toggleZaznaczenie(t.id)} className="w-5 h-5 rounded cursor-pointer accent-[#8b5cf6]" />
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${t.typ === 'przychod' ? 'bg-emerald-50' : 'bg-orange-50'}`}>
                    {getIcon(t.typ, t.kategoria)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-lg capitalize truncate max-w-[150px] md:max-w-md">{t.nazwa}</p>
                    <p className="text-sm text-gray-500 font-medium capitalize">{formatujNazweKategorii(t.kategoria || 'inne_wydatki')} • {t.data_transakcji}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`font-bold text-lg ${t.typ === 'przychod' ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {t.typ === 'przychod' ? '+' : '-'}{formatujWalute(Number(t.kwota))}
                  </span>
                  
                  <button onClick={() => otworzDoEdycji(t)} className="text-gray-300 hover:text-blue-500 hover:bg-blue-50 p-2 rounded-xl transition-all opacity-0 group-hover:opacity-100 md:block hidden ml-2" title="Edytuj">
                    <Pencil size={20} />
                  </button>
                  <button onClick={() => usunTransakcje([t.id])} className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all opacity-0 group-hover:opacity-100 md:block hidden" title="Usuń">
                    <Trash2 size={20} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </motion.div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: "spring", duration: 0.5 }} className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden relative z-10">
              <div className="flex justify-between items-center p-6 border-b border-gray-100"><h2 className="text-2xl font-bold text-slate-900">{editingId ? 'Edytuj transakcję' : 'Nowa transakcja'}</h2><button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-slate-900 p-1"><X size={24} /></button></div>
              <form onSubmit={zapiszTransakcje} className="p-6">
                <div className="bg-gray-100 p-1 rounded-2xl flex mb-6">
                  <button type="button" onClick={() => setTransactionType('wydatek')} className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${transactionType === 'wydatek' ? 'bg-white shadow-sm text-slate-900' : 'text-gray-500 hover:text-slate-700'}`}>Wydatek</button>
                  <button type="button" onClick={() => setTransactionType('przychod')} className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${transactionType === 'przychod' ? 'bg-white shadow-sm text-slate-900' : 'text-gray-500 hover:text-slate-700'}`}>Przychód</button>
                </div>
                <div className="space-y-4">
                  <div><label className="block text-sm font-bold text-gray-700 mb-1.5">Nazwa</label><input required value={nazwa} onChange={(e) => setNazwa(e.target.value)} type="text" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20 transition-all" /></div>
                  <div><label className="block text-sm font-bold text-gray-700 mb-1.5">Kwota (zł)</label><input required value={kwota} onChange={(e) => setKwota(e.target.value)} type="number" step="0.01" min="0.01" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20 transition-all" /></div>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1.5">Kategoria</label>
                       <select required value={kategoria} onChange={(e) => setKategoria(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white">
                        <option value="">Wybierz</option>
                        {transactionType === 'wydatek' ? (
                          <>
                            <option value="jedzenie">🍕 Jedzenie</option><option value="transport">🚗 Transport</option>
                            <option value="mieszkanie">🏠 Mieszkanie</option><option value="rozrywka">🎮 Rozrywka</option>
                            <option value="zdrowie">💊 Zdrowie</option><option value="edukacja">📚 Edukacja</option>
                            <option value="ubrania">👕 Ubrania</option><option value="subskrypcje">📱 Subskrypcje</option>
                            <option value="oszczednosci">🏦 Oszczędności</option><option value="inne_wydatki">📦 Inne wydatki</option>
                          </>
                        ) : (
                          <>
                            <option value="wynagrodzenie">💰 Wynagrodzenie</option><option value="freelance">💻 Freelance</option>
                            <option value="inwestycje">📈 Inwestycje</option><option value="inne_przychody">🎁 Inne przychody</option>
                          </>
                        )}
                      </select>
                     </div>
                     <div><label className="block text-sm font-bold text-gray-700 mb-1.5">Data</label><input required value={dataTransakcji} onChange={(e) => setDataTransakcji(e.target.value)} type="date" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20" /></div>
                  </div>
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full mt-6 bg-[#bfa8ff] hover:bg-[#a78bfa] text-white font-bold py-3.5 rounded-xl transition-colors shadow-sm disabled:opacity-50">{isSubmitting ? 'Zapisywanie...' : (editingId ? 'Zapisz zmiany' : 'Dodaj')}</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsImportModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: "spring", duration: 0.5 }} className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden relative z-10">
              <div className="flex justify-between items-center p-6 border-b border-gray-100"><h2 className="text-2xl font-bold text-slate-900">Importuj wyciąg</h2><button onClick={() => setIsImportModalOpen(false)} className="text-gray-400 hover:text-slate-900 p-1"><X size={24} /></button></div>
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">1. Wybierz swój bank</label>
                  <select value={wybranyBank} onChange={(e) => setWybranyBank(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white cursor-pointer"><option value="">-- Wybierz z listy --</option><option value="mbank">mBank (CSV)</option><option value="ing">ING Bank Śląski (PDF)</option><option value="pekao">Pekao SA (CSV)</option></select>
                </div>
                {wybranyBank && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                    <label className="block text-sm font-bold text-gray-700 mb-2">2. Wgraj plik wyciągu</label>
                    <input type="file" accept=".csv, .pdf" onChange={(e) => setPlik(e.target.files?.[0] || null)} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer" />
                    {wybranyBank === 'ing' && <p className="text-xs text-orange-500 mt-2 font-medium">Uwaga: Dla ING wgrywaj pliki PDF pobrane prosto z aplikacji/strony banku.</p>}
                  </motion.div>
                )}
                <button onClick={przetworzWyciag} disabled={!plik || !wybranyBank || isImporting} className="w-full mt-6 bg-[#bfa8ff] hover:bg-[#a78bfa] text-white font-bold py-3.5 rounded-xl disabled:opacity-50 flex justify-center items-center gap-2">{isImporting ? 'Przetwarzanie pliku...' : 'Rozpocznij import'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}