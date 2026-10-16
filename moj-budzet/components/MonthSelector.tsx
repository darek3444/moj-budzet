"use client";

import { useState } from "react";
// Zakładam, że używasz lucide-react do ikonek (bardzo popularne w Next.js)
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"; 

const MONTHS = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
];

interface MonthSelectorProps {
  selectedDate: Date;
  onChange: (newDate: Date) => void;
}

export default function MonthSelector({ selectedDate, onChange }: MonthSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Funkcje do strzałek
  const prevMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() - 1);
    onChange(newDate);
  };

  const nextMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + 1);
    onChange(newDate);
  };

  // Wybór konkretnego miesiąca z listy
  const selectMonth = (monthIndex: number) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(monthIndex);
    onChange(newDate);
    setIsOpen(false);
  };

  const currentMonthName = MONTHS[selectedDate.getMonth()];
  const currentYear = selectedDate.getFullYear();

  return (
    <div className="relative inline-block text-left z-50">
      {/* Główny przycisk ze strzałkami */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-2 py-1.5 shadow-sm w-56">
        <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="flex-1 text-center font-semibold text-gray-800 hover:text-blue-600 transition-colors"
        >
          {currentMonthName} {currentYear}
        </button>

        <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronRight size={20} className="text-gray-500" />
        </button>
      </div>

      {/* Rozwijane menu z siatką miesięcy */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-100 rounded-xl shadow-lg p-3">
          <div className="flex items-center justify-between mb-3 px-1">
             <span className="text-sm font-bold text-gray-700">Wybierz miesiąc</span>
             <Calendar size={16} className="text-gray-400" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MONTHS.map((month, index) => {
              const isActive = index === selectedDate.getMonth();
              return (
                <button
                  key={month}
                  onClick={() => selectMonth(index)}
                  className={`py-2 text-sm rounded-lg transition-all ${
                    isActive 
                    ? "bg-slate-800 text-white font-medium" 
                    : "hover:bg-gray-100 text-gray-600"
                  }`}
                >
                  {month.slice(0, 3)} {/* Pokazuje np. Sty, Lut, Mar */}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}