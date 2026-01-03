import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getProfile, createProfile, type Profile } from '@/lib/db';

interface AuthContextType {
  user: Profile | null;
  isLoading: boolean;
  login: (userId: string, fullName?: string, initialBalance?: number) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const storedUserId = localStorage.getItem('inovafinance_userId');
    if (storedUserId) {
      loadUser(storedUserId);
    } else {
      setIsLoading(false);
    }
  }, []);

  const loadUser = async (userId: string) => {
    try {
      const profile = await getProfile(userId);
      if (profile) {
        setUser(profile);
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (userId: string, fullName?: string, initialBalance?: number): Promise<boolean> => {
    try {
      setIsLoading(true);
      let profile = await getProfile(userId);
      
      if (!profile && fullName) {
        // Create new profile
        await createProfile({
          userId,
          fullName,
          initialBalance: initialBalance || 0,
        });
        profile = await getProfile(userId);
      }
      
      if (profile) {
        setUser(profile);
        localStorage.setItem('inovafinance_userId', userId);
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
    localStorage.removeItem('inovafinance_userId');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
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
