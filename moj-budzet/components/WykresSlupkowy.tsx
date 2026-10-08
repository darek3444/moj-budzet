'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatujWalute } from '../lib/budzet';

type Props = {
  data: { nazwa: string; Przychody: number; Wydatki: number }[];
  barSize: number;
  margin: { top: number; right: number; left: number; bottom: number };
  radius: number;
  kolorPrzychodow: string;
  rozmiarOsiX: number;
  formatOsiY?: (wartosc: number) => string;
};

// Ładowany przez next/dynamic, żeby recharts nie trafiał do pierwszego bundla strony
export default function WykresSlupkowy({ data, barSize, margin, radius, kolorPrzychodow, rozmiarOsiX, formatOsiY }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={margin} barSize={barSize}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="nazwa" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: rozmiarOsiX, fontWeight: 500 }} dy={10} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={formatOsiY} />
        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} formatter={(value) => [formatujWalute(Number(value)), '']} />
        <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
        <Bar dataKey="Przychody" fill={kolorPrzychodow} radius={[radius, radius, radius, radius]} />
        <Bar dataKey="Wydatki" fill="#ef4444" radius={[radius, radius, radius, radius]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
