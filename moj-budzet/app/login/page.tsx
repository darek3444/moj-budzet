'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import Logo from '../../components/Logo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); 
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isLogin) {
        // LOGOWANIE
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/'); 
      } else {
        // REJESTRACJA
        if (password !== confirmPassword) {
          throw new Error('Hasła nie są identyczne!');
        }
        
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        setSuccessMsg('Konto założone! Możesz się teraz zalogować.');
        setIsLogin(true); 
        setPassword('');
        setConfirmPassword('');
      }
    } catch (error: any) {
      if (error.message === 'Invalid login credentials') setErrorMsg('Błędny email lub hasło.');
      else if (error.message === 'User already registered') setErrorMsg('Ten email jest już zajęty.');
      else setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 absolute inset-0 z-50">
      <motion.div 
        layout
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="bg-white p-8 md:p-10 rounded-[32px] shadow-xl w-full max-w-md border border-gray-100 overflow-hidden"
      >
        <motion.div layout className="flex justify-center mb-6">
          <div className="rounded-2xl shadow-lg">
            <Logo size={64} />
          </div>
        </motion.div>
        
        <motion.h1 layout className="text-2xl font-extrabold text-center text-slate-900 mb-2">
          {isLogin ? 'Witaj ponownie!' : 'Dołącz do nas'}
        </motion.h1>
        <motion.p layout className="text-center text-gray-500 font-medium mb-8">
          {isLogin ? 'Zaloguj się, aby zarządzać swoim budżetem.' : 'Stwórz konto, aby śledzić swoje finanse.'}
        </motion.p>

        <AnimatePresence mode="wait">
          {errorMsg && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold mb-6 flex items-center gap-2">
              <AlertCircle size={18} /> {errorMsg}
            </motion.div>
          )}
          {successMsg && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-emerald-50 text-emerald-600 p-4 rounded-xl text-sm font-bold mb-6 text-center">
              {successMsg}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleAuth} className="space-y-4">
          <motion.div layout>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20 bg-gray-50 focus:bg-white transition-all font-medium" placeholder="twoj@email.com" />
            </div>
          </motion.div>

          <motion.div layout>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Hasło</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20 bg-gray-50 focus:bg-white transition-all font-medium" placeholder="••••••••" minLength={6} />
            </div>
          </motion.div>

          {/* OŻYWIONE POLE "POWTÓRZ HASŁO" DLA REJESTRACJI */}
          <AnimatePresence>
            {!isLogin && (
              <motion.div 
                initial={{ opacity: 0, height: 0, marginTop: 0 }} 
                animate={{ opacity: 1, height: 'auto', marginTop: 16 }} 
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="overflow-hidden"
              >
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Powtórz hasło</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input type="password" required={!isLogin} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#8b5cf6]/20 bg-gray-50 focus:bg-white transition-all font-medium" placeholder="••••••••" minLength={6} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button layout type="submit" disabled={loading} className="w-full mt-8 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-bold py-4 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2">
            {loading ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? 'Zaloguj się' : 'Zarejestruj się')}
          </motion.button>
        </form>

        <motion.p layout className="text-center text-sm font-medium text-gray-500 mt-8">
          {isLogin ? 'Nie masz konta? ' : 'Masz już konto? '}
          <button onClick={() => { setIsLogin(!isLogin); setErrorMsg(''); setSuccessMsg(''); }} type="button" className="text-[#8b5cf6] font-bold hover:underline">
            {isLogin ? 'Zarejestruj się' : 'Zaloguj się'}
          </button>
        </motion.p>
      </motion.div>
    </div>
  );
}