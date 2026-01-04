import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getProfile, createProfile, updateProfile, type Profile } from '@/lib/db';

interface AuthContextType {
  user: Profile | null;
  isLoading: boolean;
  login: (
    matricula: number, 
    fullName?: string, 
    email?: string,
    phone?: string,
    initialBalance?: number,
    creditLimit?: number,
    creditDueDay?: number
  ) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const storedMatricula = localStorage.getItem('inovafinance_matricula');
    if (storedMatricula) {
      loadUser(parseInt(storedMatricula, 10));
    } else {
      setIsLoading(false);
    }
  }, []);

  const loadUser = async (matricula: number) => {
    try {
      const profile = await getProfile(matricula);
      if (profile) {
        setUser(profile);
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    if (user?.userId) {
      const profile = await getProfile(user.userId);
      if (profile) {
        setUser(profile);
      }
    }
  };

  const login = async (
    matricula: number, 
    fullName?: string, 
    email?: string,
    phone?: string,
    initialBalance?: number,
    creditLimit?: number,
    creditDueDay?: number
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      let profile = await getProfile(matricula);
      
      if (!profile && fullName) {
        // Create new profile in Supabase
        await createProfile({
          userId: matricula,
          fullName,
          email: email || '',
          phone: phone || '',
          initialBalance: initialBalance || 0,
          creditLimit: creditLimit || 5000,
          creditUsed: 0,
          creditDueDay: creditDueDay || 5,
        });
        profile = await getProfile(matricula);
      }
      
      if (profile) {
        setUser(profile);
        localStorage.setItem('inovafinance_matricula', matricula.toString());
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('inovafinance_matricula');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
