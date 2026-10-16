'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { formatujWalute } from '../lib/budzet';

type Props = { przychody: number; wydatki: number };

const KOLORY = { Przychody: '#10b981', Wydatki: '#ef4444' };

// Pierścień przychody vs wydatki (bilans jest w karcie nad wykresem). Ładowany przez next/dynamic (recharts poza pierwszym bundlem).
export default function WykresKolowy({ przychody, wydatki }: Props) {
  const dane = [
    { nazwa: 'Przychody', wartosc: przychody },
    { nazwa: 'Wydatki', wartosc: wydatki },
  ].filter(d => d.wartosc > 0);
  const suma = przychody + wydatki;

  if (suma === 0) {
    return <div className="h-full flex items-center justify-center text-gray-400 font-medium">Brak transakcji w tym miesiącu</div>;
  }

  return (
    <div className="h-full flex flex-col sm:flex-row items-center gap-6">
      <div className="relative w-full sm:w-1/2 h-56 sm:h-full min-h-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={dane} dataKey="wartosc" nameKey="nazwa" innerRadius="62%" outerRadius="92%" paddingAngle={dane.length > 1 ? 3 : 0} cornerRadius={8} stroke="none" startAngle={90} endAngle={-270}>
              {dane.map(d => <Cell key={d.nazwa} fill={KOLORY[d.nazwa as keyof typeof KOLORY]} />)}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} formatter={(value, name) => [formatujWalute(Number(value)), String(name)]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="w-full sm:w-1/2 space-y-3">
        {[{ nazwa: 'Przychody', wartosc: przychody }, { nazwa: 'Wydatki', wartosc: wydatki }].map(d => (
          <div key={d.nazwa} className="flex items-center justify-between gap-3 rounded-2xl bg-gray-50 px-4 py-3">
            <span className="flex items-center gap-2.5 font-bold text-slate-700">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: KOLORY[d.nazwa as keyof typeof KOLORY] }} />
              {d.nazwa}
            </span>
            <span className="text-right whitespace-nowrap">
              <span className="font-extrabold text-slate-900">{formatujWalute(d.wartosc)}</span>
              <span className="text-sm text-gray-400 font-medium ml-2">{suma > 0 ? Math.round((d.wartosc / suma) * 100) : 0}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
