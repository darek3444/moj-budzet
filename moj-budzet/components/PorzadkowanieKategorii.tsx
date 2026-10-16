'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Wand2, Loader2 } from 'lucide-react';
import { ustawKategorie } from '../lib/magazyn';
import { useTransakcje } from '../lib/useTransakcje';
import { kategoryzuj } from '../lib/kategoryzacja';
import { useKategorie } from './KategorieProvider';

const INNE = new Set(['inne_wydatki', 'inne_przychody']);

// Przypisuje kategorie starym transakcjom, które wpadły do "Inne" (np. z importu sprzed kategoryzacji)
export default function PorzadkowanieKategorii() {
  const { data: transakcje = [] } = useTransakcje();
  const { reguly, wlasne, getIcon, formatujNazweKategorii } = useKategorie();
  const [trwa, setTrwa] = useState(false);

  const propozycje = useMemo(() => transakcje.flatMap(t => {
    if (t.kategoria && !INNE.has(t.kategoria)) return [];
    const nowa = kategoryzuj(t.nazwa, t.notatki ?? '', t.typ, reguly, wlasne);
    return INNE.has(nowa) ? [] : [{ id: t.id, nazwa: t.nazwa, typ: t.typ, nowa }];
  }), [transakcje, reguly, wlasne]);

  const zastosuj = async () => {
    if (!confirm(`Przypisać kategorie ${propozycje.length} transakcjom?`)) return;
    setTrwa(true);
    const wgKategorii: Record<string, string[]> = {};
    propozycje.forEach(p => { (wgKategorii[p.nowa] ??= []).push(p.id); });
    for (const [kategoria, ids] of Object.entries(wgKategorii)) {
      const { error } = ustawKategorie(ids, kategoria);
      if (error) { alert('Błąd: ' + error.message); break; }
    }
    setTrwa(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
      className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Wand2 size={20} className="text-slate-700" /> Uporządkuj kategorie
          </h2>
          <p className="text-gray-500 text-sm font-medium">
            {propozycje.length > 0
              ? `${propozycje.length} transakcji z „Inne” da się przypisać do konkretnej kategorii.`
              : 'Wszystkie transakcje z „Inne”, które dało się rozpoznać, mają już kategorię.'}
          </p>
        </div>
        <button onClick={zastosuj} disabled={trwa || propozycje.length === 0} className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-2 justify-center whitespace-nowrap">
          {trwa ? <Loader2 className="animate-spin" size={18} /> : <Wand2 size={18} />} Przypisz kategorie
        </button>
      </div>
      {propozycje.length > 0 && (
        <div className="mt-5 space-y-1 max-h-64 overflow-y-auto">
          {propozycje.slice(0, 50).map(p => (
            <div key={p.id} className="flex items-center justify-between gap-4 text-sm py-1.5 border-b border-gray-50 last:border-0">
              <span className="font-medium text-slate-700 truncate">{p.nazwa}</span>
              <span className="font-bold text-slate-900 whitespace-nowrap">{getIcon(p.typ, p.nowa)} {formatujNazweKategorii(p.nowa)}</span>
            </div>
          ))}
          {propozycje.length > 50 && <p className="text-xs text-gray-400 pt-2">…i {propozycje.length - 50} więcej</p>}
        </div>
      )}
    </motion.div>
  );
}
