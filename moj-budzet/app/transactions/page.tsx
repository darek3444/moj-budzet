'use client';

import { useState, useMemo, useDeferredValue } from 'react';
import { dodajTransakcje, edytujTransakcje, usunTransakcje as usunZMagazynu } from '../../lib/magazyn';
import { useTransakcje } from '../../lib/useTransakcje';
import { formatujWalute, dzisiaj } from '../../lib/budzet';
import { useKategorie } from '../../components/KategorieProvider';
import { parsujListeIng, wlascicielIng, czyPrzelewWlasny, nazwaTransakcji, kontrolaIng, type StronaPdf } from '../../lib/importIng';
import type { KontrolaSum } from '../../lib/importMbank';
import { kategoryzuj, kluczReguly } from '../../lib/kategoryzacja';
import { Plus, Search, X, UploadCloud, Trash2, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Ile wierszy renderujemy naraz – reszta po kliknięciu "Pokaż więcej"
const PORCJA_WIERSZY = 50;
// Kwoty powyżej progu w podglądzie importu są odznaczone do ręcznego sprawdzenia
const PODEJRZANA_KWOTA = 50000;

type WierszImportu = {
  id: number;
  nazwa: string;
  kwota: number;
  typ: 'przychod' | 'wydatek';
  kategoria: string;
  kategoriaAuto: string;
  data_transakcji: string;
  notatki: string;
  uwaga: string;
  zaznaczona: boolean;
};

export default function TransactionsPage() {
  const { data: transakcje = [], isLoading } = useTransakcje();
  const { KATEGORIE_WYDATKOW, KATEGORIE_PRZYCHODOW, getIcon, formatujNazweKategorii, wlasne, reguly, dodajReguly } = useKategorie();

  const [wyszukiwarka, setWyszukiwarka] = useState('');
  const szukanaFraza = useDeferredValue(wyszukiwarka);
  const [ileWidocznych, setIleWidocznych] = useState(PORCJA_WIERSZY);
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
  const [dataTransakcji, setDataTransakcji] = useState(dzisiaj);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [wybranyBank, setWybranyBank] = useState('');
  const [plik, setPlik] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [podglad, setPodglad] = useState<WierszImportu[] | null>(null);
  // Sumy z podsumowania banku vs. odczytane z pliku (wszystkie pozycje, także przelewy własne)
  const [kontrolaSum, setKontrolaSum] = useState<{ bank: KontrolaSum; plik: KontrolaSum } | null>(null);

  const bilans = useMemo(() => {
    let suma = 0;
    transakcje.forEach(t => {
      if (t.typ === 'przychod') suma += Number(t.kwota);
      if (t.typ === 'wydatek') suma -= Number(t.kwota);
    });
    return suma;
  }, [transakcje]);

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
    setDataTransakcji(dzisiaj());
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
      const { error } = edytujTransakcje(editingId, { ...payload, typ: payload.typ as 'przychod' | 'wydatek' });
      if (!error) { setIsModalOpen(false); } else alert('Błąd: ' + error.message);
    } else {
      const { error } = dodajTransakcje([{ ...payload, typ: payload.typ as 'przychod' | 'wydatek' }]);
      if (!error) { setNazwa(''); setKwota(''); setNotatki(''); setIsModalOpen(false); } else alert('Błąd: ' + error.message);
    }
    setIsSubmitting(false);
  };

  const usunTransakcje = async (listaIdDoUsuniecia: string[]) => {
    if (!confirm(`Czy usunąć ${listaIdDoUsuniecia.length} transakcji?`)) return false;
    setCzyUsuwa(true);
    const { error } = usunZMagazynu(listaIdDoUsuniecia);
    setCzyUsuwa(false);
    if (!error) { setZaznaczoneId([]); return true; }
    alert('Błąd: ' + error.message);
    return false;
  };

  const toggleZaznaczenie = (id: string) => {
    setZaznaczoneId(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const przetworzWyciag = async () => {
    if (!plik || !wybranyBank) return;
    setIsImporting(true);

    try {
      const gotoweTransakcje: any[] = [];
      let kontrola: KontrolaSum | undefined;

      if (plik.name.toLowerCase().endsWith('.pdf')) {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const arrayBuffer = await plik.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let pelnyTekst = '';
        const strony: StronaPdf[] = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          strony.push(content.items.map((item: any) => ({ str: item.str, x: item.transform[4], y: item.transform[5] })));
          
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

        // Nowy format "Lista transakcji" (tabela z kolumnami); stary wyciąg obsługujemy jak dotąd
        const mbankPdf = wybranyBank === 'mbank' ? (await import('../../lib/importMbank')).parsujMbankPdf(strony) : null;
        const listaIng = mbankPdf?.transakcje.length ? [] : parsujListeIng(strony);
        if (mbankPdf && mbankPdf.transakcje.length > 0) {
          kontrola = mbankPdf.kontrola;
          mbankPdf.transakcje.forEach(t => gotoweTransakcje.push({
            nazwa: t.nazwa, opis: t.opis, kwota: Math.abs(t.kwota), typ: t.kwota > 0 ? 'przychod' : 'wydatek',
            data_transakcji: t.data, notatki: 'Import z PDF (mBank)', wlasny: t.wlasny,
          }));
        } else if (listaIng.length > 0) {
          const wlasciciel = wlascicielIng(strony);
          kontrola = kontrolaIng(strony);
          listaIng.forEach(t => gotoweTransakcje.push({
            nazwa: nazwaTransakcji(t), opis: t.tytul, kwota: Math.abs(t.kwota), typ: t.kwota > 0 ? 'przychod' : 'wydatek',
            data_transakcji: t.data, notatki: 'Import z PDF (ING)', wlasny: czyPrzelewWlasny(t, wlasciciel),
          }));
        } else {
        const plaskiTekst = pelnyTekst.replace(/\n/g, ' ').replace(/\s+/g, ' ');
        const bloki = plaskiTekst.split(/(?=\d{2}\.\d{2}\.\d{4}\s)/);

        bloki.forEach(blok => {
          const dateMatch = blok.match(/^(\d{2}\.\d{2}\.\d{4})/);
          // Lookbehind: kwota nie może być doklejona do cyfr numeru konta ("…2400 500,00 PLN" ≠ 2 400 500 zł)
          const amountMatch = blok.match(/(?<!\d[\s\u00A0]?)(-?\d{1,3}(?:[\s\u00A0]\d{3})*,\d{2})\s+PLN/);

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
              gotoweTransakcje.push({ nazwa: czystaNazwa, kwota: Math.abs(parsedKwota), typ: parsedKwota > 0 ? 'przychod' : 'wydatek', data_transakcji: dataTransakcji, notatki: 'Import z PDF (ING)' });
            }
          }
        });
        }

      } else if (plik.name.toLowerCase().endsWith('.csv')) {
        const tekstCsv = new TextDecoder('windows-1250').decode(await plik.arrayBuffer());
        const mbank = wybranyBank === 'mbank' ? (await import('../../lib/importMbank')).parsujMbank(tekstCsv) : null;
        if (mbank && mbank.transakcje.length > 0) {
          kontrola = mbank.kontrola;
          mbank.transakcje.forEach(t => gotoweTransakcje.push({
            nazwa: t.nazwa, opis: t.opis, kwota: Math.abs(t.kwota), typ: t.kwota > 0 ? 'przychod' : 'wydatek',
            data_transakcji: t.data, notatki: 'Import z mBanku', wlasny: t.wlasny,
          }));
        } else {
        const { default: Papa } = await import('papaparse');
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
                  let parsedKwota = 0, parsedNazwa = 'Nieznana transakcja', parsedData = dzisiaj(), parsedNotatki = '';
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
                      gotoweTransakcje.push({ nazwa: parsedNazwa || 'Brak nazwy', kwota: Math.abs(parsedKwota), typ: parsedKwota > 0 ? 'przychod' : 'wydatek', data_transakcji: parsedData, notatki: parsedNotatki });
                    }
                  } catch (err) {}
                });
                resolve(true);
              }
            });
          };
        });
        }
      }

      if (gotoweTransakcje.length > 0) {
        const suma = (typ: string) => Math.round(gotoweTransakcje.filter(t => t.typ === typ).reduce((s, t) => s + t.kwota, 0) * 100) / 100;
        setKontrolaSum(kontrola ? { bank: kontrola, plik: { uznania: suma('przychod'), obciazenia: suma('wydatek') } } : null);
        // Ten sam dzień, kwota i typ co w bazie = prawdopodobnie już zaimportowane
        const kluczDuplikatu = (data: string, kwota: number, typ: string) => `${data}|${kwota.toFixed(2)}|${typ}`;
        const istniejace = new Set(transakcje.map(t => kluczDuplikatu(t.data_transakcji, Number(t.kwota), t.typ)));
        setPodglad(gotoweTransakcje.map((t, i) => {
          const duplikat = istniejace.has(kluczDuplikatu(t.data_transakcji, t.kwota, t.typ));
          const podejrzanaKwota = t.kwota > PODEJRZANA_KWOTA;
          const kategoria = kategoryzuj(t.nazwa, t.opis ?? '', t.typ, reguly, wlasne);
          return {
            id: i, nazwa: t.nazwa, kwota: t.kwota, typ: t.typ, kategoria, kategoriaAuto: kategoria,
            data_transakcji: t.data_transakcji, notatki: t.notatki,
            uwaga: podejrzanaKwota ? 'Sprawdź kwotę' : t.wlasny ? 'Przelew własny' : duplikat ? 'Już w bazie' : '',
            zaznaczona: !t.wlasny && !duplikat && !podejrzanaKwota,
          };
        }));
      } else {
        alert('Nie udało się odczytać żadnych transakcji z tego pliku.');
      }
    } catch (err) {
      alert('Wystąpił problem podczas przetwarzania pliku.');
    }
    setIsImporting(false);
  };

  const zmienWierszImportu = (id: number, zmiany: Partial<WierszImportu>) => {
    setPodglad(p => p && p.map(w => w.id === id ? { ...w, ...zmiany } : w));
  };

  // Zmiana kategorii obejmuje wszystkie pozycje tego samego kontrahenta w podglądzie
  const zmienKategorieImportu = (id: number, kategoria: string) => {
    setPodglad(p => {
      if (!p) return p;
      const wiersz = p.find(w => w.id === id);
      if (!wiersz) return p;
      const klucz = kluczReguly(wiersz.typ, wiersz.nazwa);
      return p.map(w => kluczReguly(w.typ, w.nazwa) === klucz ? { ...w, kategoria } : w);
    });
  };

  const zamknijImport = () => { setIsImportModalOpen(false); setPodglad(null); setKontrolaSum(null); };

  const zatwierdzImport = async () => {
    if (!podglad) return;
    const doZapisu = podglad.filter(w => w.zaznaczona);
    if (doZapisu.length === 0) return;
    setIsImporting(true);
    const { error } = dodajTransakcje(
      doZapisu.map(w => ({ nazwa: w.nazwa, kwota: w.kwota, typ: w.typ, kategoria: w.kategoria, data_transakcji: w.data_transakcji, notatki: w.notatki }))
    );
    setIsImporting(false);
    if (error) { alert('Błąd bazy: ' + error.message); return; }

    // Ręczne poprawki kategorii zapamiętujemy dla kolejnych importów
    const nauczone: Record<string, string> = {};
    doZapisu.filter(w => w.kategoria !== w.kategoriaAuto).forEach(w => { nauczone[kluczReguly(w.typ, w.nazwa)] = w.kategoria; });
    await dodajReguly(nauczone);

    alert(`Sukces! Zaimportowano ${doZapisu.length} transakcji.`);
    setPlik(null); zamknijImport();
  };

  const przefiltrowaneTransakcje = useMemo(() => {
    const fraza = szukanaFraza.toLowerCase();
    return transakcje.filter(t => {
      const pasujeNazwa = t.nazwa.toLowerCase().includes(fraza);
      const pasujeTyp = filtrTyp === 'wszystkie' || t.typ === filtrTyp;
      const pasujeKategoria = filtrKategoria === 'wszystkie' || t.kategoria === filtrKategoria;
      return pasujeNazwa && pasujeTyp && pasujeKategoria;
    });
  }, [transakcje, szukanaFraza, filtrTyp, filtrKategoria]);

  // Set zamiast includes() – sprawdzanie zaznaczenia w O(1) dla każdego wiersza
  const zaznaczoneSet = useMemo(() => new Set(zaznaczoneId), [zaznaczoneId]);
  const widoczneTransakcje = przefiltrowaneTransakcje.slice(0, ileWidocznych);

  const toggleZaznaczWszystkie = () => {
    if (zaznaczoneId.length === przefiltrowaneTransakcje.length) setZaznaczoneId([]);
    else setZaznaczoneId(przefiltrowaneTransakcje.map(t => t.id));
  };

  return (
    <main className="px-4 py-5 sm:p-8 md:p-10 max-w-6xl mx-auto overflow-y-auto w-full overflow-x-hidden">
      
      <motion.header 
        initial={{ opacity: 0, y: -20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.5 }}
        className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-5 sm:mb-8"
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
          <button onClick={() => setIsImportModalOpen(true)} className="flex-1 md:flex-none justify-center bg-white border-2 border-slate-200 text-slate-700 px-5 py-3 rounded-xl font-semibold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm active:scale-95">
            <UploadCloud size={20} /> Importuj
          </button>
          
          <button onClick={otworzDoDodania} className="flex-1 md:flex-none justify-center bg-slate-900 text-white px-5 py-3 rounded-xl font-semibold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-md active:scale-95">
            <Plus size={20} /> Nowa
          </button>
        </div>
      </motion.header>

      <motion.div 
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-3 md:gap-4 mb-5 sm:mb-8"
      >
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input type="text" value={wyszukiwarka} onChange={(e) => { setWyszukiwarka(e.target.value); setIleWidocznych(PORCJA_WIERSZY); }} placeholder="Szukaj transakcji..." className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20 transition-all"/>
        </div>
        <div className="grid grid-cols-2 md:flex gap-3 md:gap-4">
          <select value={filtrTyp} onChange={(e) => { setFiltrTyp(e.target.value); setIleWidocznych(PORCJA_WIERSZY); }} className="px-4 py-3 rounded-xl border border-gray-200 bg-white font-medium text-slate-700 w-full min-w-0 md:w-auto md:min-w-[140px] cursor-pointer">
            <option value="wszystkie">Wszystkie</option><option value="przychod">Przychody</option><option value="wydatek">Wydatki</option>
          </select>
          <select value={filtrKategoria} onChange={(e) => { setFiltrKategoria(e.target.value); setIleWidocznych(PORCJA_WIERSZY); }} className="px-4 py-3 rounded-xl border border-gray-200 bg-white font-medium text-slate-700 w-full min-w-0 md:w-auto md:min-w-[180px] cursor-pointer capitalize">
            <option value="wszystkie">Wszystkie kategorie</option>
            <optgroup label="Wydatki">
              {KATEGORIE_WYDATKOW.map(k => <option key={k.id} value={k.id}>{k.ikona} {k.nazwa}</option>)}
            </optgroup>
            <optgroup label="Przychody">
              {KATEGORIE_PRZYCHODOW.map(k => <option key={k.id} value={k.id}>{k.ikona} {k.nazwa}</option>)}
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
            <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex flex-wrap gap-3 justify-between items-center">
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
        className="bg-white rounded-3xl p-2 sm:p-4 md:p-8 border border-gray-100 shadow-sm space-y-1 sm:space-y-2 min-h-[400px]"
      >
        {przefiltrowaneTransakcje.length > 0 && (
          <div className="hidden sm:flex items-center gap-3 px-4 pb-4 border-b border-gray-50 mb-2">
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
          <>
            {widoczneTransakcje.map(t => {
              const zaznaczona = zaznaczoneSet.has(t.id);
              return (
              <div 
                key={t.id} 
                // Stuknięcie w wiersz otwiera edycję (na telefonie nie ma najechania kursorem)
                onClick={(e) => { if (!(e.target as HTMLElement).closest('input, button')) otworzDoEdycji(t); }}
                className={`flex items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl transition-colors border group cursor-pointer ${zaznaczona ? 'bg-violet-50/50 border-violet-100' : 'border-transparent hover:border-gray-100 hover:bg-gray-50'}`}
              >
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  <input type="checkbox" checked={zaznaczona} onChange={() => toggleZaznaczenie(t.id)} className="hidden sm:block shrink-0 w-5 h-5 rounded cursor-pointer accent-[#8b5cf6]" />
                  <div className={`w-11 h-11 sm:w-14 sm:h-14 shrink-0 rounded-2xl flex items-center justify-center text-xl sm:text-2xl ${t.typ === 'przychod' ? 'bg-emerald-50' : 'bg-orange-50'}`}>
                    {getIcon(t.typ, t.kategoria)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-base sm:text-lg capitalize truncate">{t.nazwa}</p>
                    <p className="text-xs sm:text-sm text-gray-500 font-medium truncate">{formatujNazweKategorii(t.kategoria || 'inne_wydatki')} • {t.data_transakcji}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className={`font-bold text-base sm:text-lg whitespace-nowrap ${t.typ === 'przychod' ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {t.typ === 'przychod' ? '+' : '-'}{formatujWalute(Number(t.kwota))}
                  </span>
                  
                  <button onClick={() => otworzDoEdycji(t)} className="text-gray-300 hover:text-blue-500 hover:bg-blue-50 p-2 rounded-xl transition-all opacity-0 group-hover:opacity-100 md:block hidden ml-2" title="Edytuj">
                    <Pencil size={20} />
                  </button>
                  <button onClick={() => usunTransakcje([t.id])} className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all opacity-0 group-hover:opacity-100 md:block hidden" title="Usuń">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
              );
            })}
            {przefiltrowaneTransakcje.length > ileWidocznych && (
              <button onClick={() => setIleWidocznych(n => n + PORCJA_WIERSZY * 2)} className="w-full mt-4 py-3 rounded-xl border border-gray-200 font-bold text-slate-700 hover:bg-gray-50 transition-colors">
                Pokaż więcej ({przefiltrowaneTransakcje.length - ileWidocznych} pozostało)
              </button>
            )}
          </>
        )}
      </motion.div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: "spring", duration: 0.5 }} className="bg-white rounded-[32px] shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto relative z-10">
              <div className="flex justify-between items-center p-6 border-b border-gray-100"><h2 className="text-2xl font-bold text-slate-900">{editingId ? 'Edytuj transakcję' : 'Nowa transakcja'}</h2><button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-slate-900 p-1"><X size={24} /></button></div>
              <form onSubmit={zapiszTransakcje} className="p-6">
                <div className="bg-gray-100 p-1 rounded-2xl flex mb-6">
                  <button type="button" onClick={() => setTransactionType('wydatek')} className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${transactionType === 'wydatek' ? 'bg-white shadow-sm text-slate-900' : 'text-gray-500 hover:text-slate-700'}`}>Wydatek</button>
                  <button type="button" onClick={() => setTransactionType('przychod')} className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${transactionType === 'przychod' ? 'bg-white shadow-sm text-slate-900' : 'text-gray-500 hover:text-slate-700'}`}>Przychód</button>
                </div>
                <div className="space-y-4">
                  <div><label className="block text-sm font-bold text-gray-700 mb-1.5">Nazwa</label><input required value={nazwa} onChange={(e) => setNazwa(e.target.value)} type="text" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20 transition-all" /></div>
                  <div><label className="block text-sm font-bold text-gray-700 mb-1.5">Kwota (zł)</label><input required value={kwota} onChange={(e) => setKwota(e.target.value)} type="number" step="0.01" min="0.01" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20 transition-all" /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1.5">Kategoria</label>
                       <select required value={kategoria} onChange={(e) => setKategoria(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white">
                        <option value="">Wybierz</option>
                        {(transactionType === 'wydatek' ? KATEGORIE_WYDATKOW : KATEGORIE_PRZYCHODOW).map(k => (
                          <option key={k.id} value={k.id}>{k.ikona} {k.nazwa}</option>
                        ))}
                      </select>
                     </div>
                     <div><label className="block text-sm font-bold text-gray-700 mb-1.5">Data</label><input required value={dataTransakcji} onChange={(e) => setDataTransakcji(e.target.value)} type="date" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20" /></div>
                  </div>
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full mt-6 bg-[#bfa8ff] hover:bg-[#a78bfa] text-white font-bold py-3.5 rounded-xl transition-colors shadow-sm disabled:opacity-50">{isSubmitting ? 'Zapisywanie...' : (editingId ? 'Zapisz zmiany' : 'Dodaj')}</button>
                {editingId && (
                  <button type="button" onClick={async () => { if (await usunTransakcje([editingId])) setIsModalOpen(false); }} className="w-full mt-3 flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 font-bold py-3 rounded-xl transition-colors">
                    <Trash2 size={18} /> Usuń transakcję
                  </button>
                )}
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={zamknijImport} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: "spring", duration: 0.5 }} className={`bg-white rounded-[32px] shadow-2xl w-full ${podglad ? 'max-w-3xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto relative z-10`}>
              <div className="flex justify-between items-center p-6 border-b border-gray-100"><h2 className="text-2xl font-bold text-slate-900">{podglad ? 'Sprawdź kategorie' : 'Importuj wyciąg'}</h2><button onClick={zamknijImport} className="text-gray-400 hover:text-slate-900 p-1"><X size={24} /></button></div>
              {podglad ? (
                <div className="p-6">
                  <p className="text-sm text-gray-500 font-medium mb-4">
                    Znaleziono {podglad.length} transakcji, do importu: <span className="font-bold text-slate-900">{podglad.filter(w => w.zaznaczona).length}</span>.
                    Przelewy własne, pozycje, które już masz w bazie, i podejrzanie wysokie kwoty są odznaczone. Zmiana kategorii obejmuje wszystkie pozycje tego kontrahenta i zostanie zapamiętana.
                  </p>
                  {kontrolaSum && (
                    Math.abs(kontrolaSum.bank.uznania - kontrolaSum.plik.uznania) < 0.01 && Math.abs(kontrolaSum.bank.obciazenia - kontrolaSum.plik.obciazenia) < 0.01 ? (
                      <p className="text-sm font-bold text-emerald-700 bg-emerald-50 rounded-xl px-4 py-2.5 mb-4">
                        ✓ Sumy zgodne z podsumowaniem banku: uznania {formatujWalute(kontrolaSum.bank.uznania)}, obciążenia {formatujWalute(kontrolaSum.bank.obciazenia)}
                      </p>
                    ) : (
                      <p className="text-sm font-bold text-orange-700 bg-orange-50 rounded-xl px-4 py-2.5 mb-4">
                        ⚠ Sumy różnią się od podsumowania banku (bank: +{formatujWalute(kontrolaSum.bank.uznania)} / −{formatujWalute(kontrolaSum.bank.obciazenia)}, odczytano: +{formatujWalute(kontrolaSum.plik.uznania)} / −{formatujWalute(kontrolaSum.plik.obciazenia)}). Sprawdź pozycje przed importem.
                      </p>
                    )
                  )}
                  <div className="max-h-[55vh] overflow-y-auto -mx-2 px-2 space-y-1">
                    {podglad.map(w => (
                      <div key={w.id} className={`flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-2 p-2.5 rounded-xl border ${w.zaznaczona ? 'border-gray-100' : 'border-transparent opacity-50'}`}>
                        <input type="checkbox" checked={w.zaznaczona} onChange={() => zmienWierszImportu(w.id, { zaznaczona: !w.zaznaczona })} className="w-5 h-5 rounded cursor-pointer accent-[#8b5cf6] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 truncate">{w.nazwa}</p>
                          <p className="text-xs text-gray-500 font-medium">
                            {w.data_transakcji}
                            {w.uwaga && <span className="ml-2 px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">{w.uwaga}</span>}
                          </p>
                        </div>
                        <span className={`font-bold whitespace-nowrap ${w.typ === 'przychod' ? 'text-emerald-600' : 'text-slate-900'}`}>
                          {w.typ === 'przychod' ? '+' : '-'}{formatujWalute(w.kwota)}
                        </span>
                        <select value={w.kategoria} onChange={(e) => zmienKategorieImportu(w.id, e.target.value)} className="ml-8 sm:ml-0 w-[calc(100%-2rem)] sm:w-44 shrink-0 px-2 py-2 rounded-lg border border-gray-200 bg-white text-sm">
                          {(w.typ === 'wydatek' ? KATEGORIE_WYDATKOW : KATEGORIE_PRZYCHODOW).map(k => (
                            <option key={k.id} value={k.id}>{k.ikona} {k.nazwa}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button onClick={() => setPodglad(null)} className="px-5 py-3.5 rounded-xl border border-gray-200 font-bold text-slate-700 hover:bg-gray-50">Wstecz</button>
                    <button onClick={zatwierdzImport} disabled={isImporting || !podglad.some(w => w.zaznaczona)} className="flex-1 bg-[#bfa8ff] hover:bg-[#a78bfa] text-white font-bold py-3.5 rounded-xl disabled:opacity-50">
                      {isImporting ? 'Zapisywanie...' : `Importuj ${podglad.filter(w => w.zaznaczona).length} transakcji`}
                    </button>
                  </div>
                </div>
              ) : (
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">1. Wybierz swój bank</label>
                  <select value={wybranyBank} onChange={(e) => setWybranyBank(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white cursor-pointer"><option value="">-- Wybierz z listy --</option><option value="mbank">mBank (CSV lub PDF)</option><option value="ing">ING Bank Śląski (PDF)</option><option value="pekao">Pekao SA (CSV)</option></select>
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
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}