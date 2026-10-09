'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { HardDrive, Download, Upload } from 'lucide-react';
import { kopiaZapasowa, wczytajDane } from '../lib/magazyn';
import { pobierzStatus, statusSerwera, subskrybujStatus } from '../lib/synchronizacja';
import { useSyncExternalStore } from 'react';
import { useTransakcje } from '../lib/useTransakcje';
import { dzisiaj } from '../lib/budzet';

export default function KopiaZapasowa() {
  const { data: transakcje } = useTransakcje();
  const plikRef = useRef<HTMLInputElement>(null);
  const { zalogowany, email } = useSyncExternalStore(subskrybujStatus, pobierzStatus, statusSerwera);
  const [komunikat, setKomunikat] = useState('');

  const pobierz = () => {
    const blob = new Blob([JSON.stringify(kopiaZapasowa(), null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Moj_Budzet_kopia_${dzisiaj()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const wczytaj = async (plik: File) => {
    try {
      const { error, dodano } = wczytajDane(JSON.parse(await plik.text()));
      setKomunikat(error ? `Błąd: ${error.message}` : `Wczytano kopię: dodano ${dodano} transakcji (pozycje, które już były, pominięto).`);
    } catch {
      setKomunikat('Błąd: to nie jest poprawny plik kopii (.json).');
    }
    if (plikRef.current) plikRef.current.value = '';
  };

  return (
    <motion.div
      id="kopia"
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.35 }}
      className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm scroll-mt-8"
    >
      <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
        <HardDrive size={20} className="text-slate-700" /> Dane i kopia zapasowa
      </h2>
      <p className="text-gray-500 text-sm font-medium mb-6">
        {zalogowany
          ? `Dane (${transakcje.length} transakcji, kategorie i nauczone reguły) są w tej przeglądarce i synchronizują się z kontem ${email}. Kopia do pliku to dodatkowe zabezpieczenie.`
          : `Pracujesz bez konta: dane (${transakcje.length} transakcji, kategorie i nauczone reguły) są tylko w tej przeglądarce. Wyczyszczenie danych przeglądarki je usunie, więc co jakiś czas pobierz kopię – albo zaloguj się, żeby synchronizować z kontem.`}
      </p>

      <div className="flex flex-col md:flex-row gap-3">
        <button onClick={pobierz} className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2 justify-center">
          <Download size={18} /> Pobierz kopię (.json)
        </button>
        <button onClick={() => plikRef.current?.click()} className="border border-gray-200 text-slate-700 font-bold py-3 px-6 rounded-xl hover:bg-gray-50 flex items-center gap-2 justify-center">
          <Upload size={18} /> Wczytaj kopię
        </button>
        <input ref={plikRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => e.target.files?.[0] && wczytaj(e.target.files[0])} />
      </div>


      {komunikat && (
        <p className={`mt-4 text-sm font-bold rounded-xl px-4 py-2.5 ${komunikat.startsWith('Błąd') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{komunikat}</p>
      )}
    </motion.div>
  );
}
