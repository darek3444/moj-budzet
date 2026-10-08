'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { LogOut, User } from 'lucide-react';

export default function SidebarUser() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    // onAuthStateChange od razu zwraca bieżącą sesję (INITIAL_SESSION), więc osobne getUser() jest zbędne
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login'; 
  };

  // Jeśli nie ma maila (nikt nie jest zalogowany), nic nie pokazujemy
  if (!email) return null;

  return (
    <div className="mt-auto pt-6 border-t border-gray-100">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-gray-100 p-2.5 rounded-full text-slate-500">
          <User size={20} />
        </div>
        <div className="overflow-hidden">
          <p className="text-sm font-bold text-slate-900 truncate" title={email}>
            {email}
          </p>
          <p className="text-xs text-gray-400 font-medium">Zalogowano</p>
        </div>
      </div>
      
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2.5 rounded-xl font-bold transition-all active:scale-95"
      >
        <LogOut size={18} /> Wyloguj się
      </button>
    </div>
  );
}