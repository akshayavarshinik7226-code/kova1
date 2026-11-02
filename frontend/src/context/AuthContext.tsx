import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, api, getToken, setToken } from '../lib/api';
import type { ApiUser, ProfileUpdateInput, RegisterInput } from '../lib/api';

interface AuthValue {
  user: ApiUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<ApiUser>;
  signUp: (input: RegisterInput) => Promise<ApiUser>;
  signOut: () => void;
  refresh: () => Promise<void>;
  updateUser: (user: ApiUser) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(getToken()));

  useEffect(() => {
    let active = true;
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((result) => {
        if (active) setUser(result);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          setToken(null);
        }
        setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    setToken(result.access_token);
    setUser(result.user);
    return result.user;
  }, []);

  const signUp = useCallback(async (input: RegisterInput) => {
    const result = await api.register(input);
    setToken(result.access_token);
    setUser(result.user);
    return result.user;
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setUser(await api.me());
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setToken(null);
        setUser(null);
      }
    }
  }, []);

  const updateUser = useCallback((next: ApiUser) => setUser(next), []);

  const value = useMemo<AuthValue>(
    () => ({ user, loading, signIn, signUp, signOut, refresh, updateUser }),
    [user, loading, signIn, signUp, signOut, refresh, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export type { ProfileUpdateInput };
