'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Tags, Trash2, Loader2 } from 'lucide-react';
import { zamienKategorie } from '../lib/magazyn';
import { useKategorie } from './KategorieProvider';
import type { Kategoria } from '../lib/budzet';

const KOLORY = ['#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#14b8a6', '#22c55e', '#84cc16', '#a16207', '#64748b'];

const pustyFormularz = { nazwa: '', ikona: '🏷️', typ: 'wydatek' as Kategoria['typ'], kolor: KOLORY[0], slowa: '' };

export default function WlasneKategorie() {
  const { wlasne, zapiszWlasne } = useKategorie();
  const [formularz, setFormularz] = useState(pustyFormularz);
  const [edytowaneId, setEdytowaneId] = useState<string | null>(null);
  const [zapisywanie, setZapisywanie] = useState(false);

  const zapisz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formularz.nazwa.trim()) return;
    setZapisywanie(true);
    const kategoria: Kategoria = {
      id: edytowaneId ?? `w_${Date.now().toString(36)}`,
      nazwa: formularz.nazwa.trim(),
      ikona: formularz.ikona.trim() || '🏷️',
      typ: formularz.typ,
      kolor: formularz.kolor,
      slowa: formularz.slowa.split(',').map(s => s.trim()).filter(Boolean),
    };
    const nowe = edytowaneId ? wlasne.map(k => k.id === edytowaneId ? kategoria : k) : [...wlasne, kategoria];
    const blad = await zapiszWlasne(nowe);
    setZapisywanie(false);
    if (blad) { alert('Nie udało się zapisać kategorii: ' + blad); return; }
    setFormularz(pustyFormularz);
    setEdytowaneId(null);
  };

  const edytuj = (k: Kategoria) => {
    setEdytowaneId(k.id);
    setFormularz({ nazwa: k.nazwa, ikona: k.ikona, typ: k.typ, kolor: k.kolor, slowa: (k.slowa ?? []).join(', ') });
  };

  const usun = async (k: Kategoria) => {
    const zastepcza = k.typ === 'wydatek' ? 'inne_wydatki' : 'inne_przychody';
    if (!confirm(`Usunąć kategorię „${k.nazwa}”? Jej transakcje trafią do „${k.typ === 'wydatek' ? 'Inne wydatki' : 'Inne przychody'}”.`)) return;
    const { error } = zamienKategorie(k.id, zastepcza);
    if (error) { alert('Błąd: ' + error.message); return; }
    const blad = await zapiszWlasne(wlasne.filter(w => w.id !== k.id));
    if (blad) alert('Nie udało się usunąć kategorii: ' + blad);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}
      className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm"
    >
      <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
        <Tags size={20} className="text-slate-700" /> Własne kategorie
      </h2>
      <p className="text-gray-500 text-sm font-medium mb-6">
        Kategorie zapisują się na koncie, więc zobaczysz je na każdym urządzeniu. Słowa kluczowe przypiszą kategorię automatycznie przy imporcie.
      </p>

      <form onSubmit={zapisz} className="grid grid-cols-1 md:grid-cols-[80px_1fr_160px] gap-4 mb-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Ikona</label>
          <input value={formularz.ikona} onChange={(e) => setFormularz({ ...formularz, ikona: e.target.value })} maxLength={4} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center text-xl focus:outline-none focus:ring-2 focus:ring-slate-200" />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Nazwa</label>
          <input required value={formularz.nazwa} onChange={(e) => setFormularz({ ...formularz, nazwa: e.target.value })} placeholder="np. Dziecko, Samochód, Prezenty" maxLength={40} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-slate-200" />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Typ</label>
          <select value={formularz.typ} onChange={(e) => setFormularz({ ...formularz, typ: e.target.value as Kategoria['typ'] })} disabled={!!edytowaneId} className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white disabled:opacity-60">
            <option value="wydatek">Wydatek</option>
            <option value="przychod">Przychód</option>
          </select>
        </div>
        <div className="md:col-span-3">
          <label className="block text-sm font-bold text-gray-700 mb-2">Słowa kluczowe (po przecinku)</label>
          <input value={formularz.slowa} onChange={(e) => setFormularz({ ...formularz, slowa: e.target.value })} placeholder="np. smyk, pampers, przedszkole" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-slate-200" />
        </div>
        <div className="md:col-span-3 flex flex-col md:flex-row md:items-center gap-4 justify-between">
          <div className="flex flex-wrap gap-2">
            {KOLORY.map(kolor => (
              <button key={kolor} type="button" onClick={() => setFormularz({ ...formularz, kolor })} aria-label={`Kolor ${kolor}`}
                className={`w-8 h-8 rounded-full transition-transform ${formularz.kolor === kolor ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : ''}`}
                style={{ backgroundColor: kolor }} />
            ))}
          </div>
          <div className="flex gap-3">
            {edytowaneId && (
              <button type="button" onClick={() => { setEdytowaneId(null); setFormularz(pustyFormularz); }} className="px-5 py-3 rounded-xl border border-gray-200 font-bold text-slate-700 hover:bg-gray-50">Anuluj</button>
            )}
            <button type="submit" disabled={zapisywanie} className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-2">
              {zapisywanie && <Loader2 className="animate-spin" size={18} />} {edytowaneId ? 'Zapisz zmiany' : 'Dodaj kategorię'}
            </button>
          </div>
        </div>
      </form>

      <div className="space-y-2 mt-6">
        {wlasne.length === 0 ? (
          <p className="text-gray-400 text-sm font-medium py-2">Nie masz jeszcze własnych kategorii.</p>
        ) : wlasne.map(k => (
          <div key={k.id} className="flex items-center justify-between gap-4 p-3 border border-gray-100 rounded-2xl">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: `${k.kolor}22` }}>{k.ikona}</div>
              <div className="min-w-0">
                <p className="font-bold text-slate-900 truncate">{k.nazwa} <span className="text-xs font-medium text-gray-400 ml-1">{k.typ === 'wydatek' ? 'wydatek' : 'przychód'}</span></p>
                <p className="text-xs text-gray-500 truncate">{k.slowa?.length ? k.slowa.join(', ') : 'bez słów kluczowych'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => edytuj(k)} className="px-4 py-2 text-sm font-bold text-slate-700 border border-gray-200 rounded-xl hover:bg-gray-50">Edytuj</button>
              <button onClick={() => usun(k)} className="text-red-400 hover:text-red-600 p-2 rounded-xl hover:bg-red-50" title="Usuń kategorię"><Trash2 size={20} /></button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
