import { create } from 'zustand';
import { User } from '../types';
import { api, setTokens, clearTokens, getToken } from '../api/client';

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (credentials: { email: string; password: string }) => Promise<any>;
  fetchMe: () => Promise<User | null>;
  updatePresence: (status: string) => Promise<string | null>;
  logout: () => void;
}

const savedUser = typeof localStorage !== 'undefined' ? localStorage.getItem('humora_user') : null;

export const useAuthStore = create<AuthState>((set) => ({
  user: savedUser ? JSON.parse(savedUser) : null,
  accessToken: getToken(),
  isAuthenticated: !!getToken(),
  isLoading: false,
  error: null,

  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.post<{
        access_token: string;
        refresh_token: string;
        user: User;
      }>('/auth/login', credentials);

      setTokens(data.access_token, data.refresh_token);
      localStorage.setItem('humora_user', JSON.stringify(data.user));
      set({
        isLoading: false,
        isAuthenticated: true,
        user: data.user,
        accessToken: data.access_token,
      });
      return { unwrap: () => Promise.resolve(data) };
    } catch (err: any) {
      const msg = err.message || 'Login failed';
      set({ isLoading: false, error: msg });
      throw msg;
    }
  },

  fetchMe: async () => {
    try {
      const user = await api.get<User>('/auth/me');
      localStorage.setItem('humora_user', JSON.stringify(user));
      set({ user, isAuthenticated: true });
      return user;
    } catch (err: any) {
      return null;
    }
  },

  updatePresence: async (status: string) => {
    try {
      await api.put('/auth/presence', { status });
      set((state) => ({
        user: state.user ? { ...state.user, presence_status: status } : null,
      }));
      return status;
    } catch (err: any) {
      return null;
    }
  },

  logout: () => {
    clearTokens();
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      error: null,
    });
  },
}));

function withUnwrap<T>(promise: Promise<T>): Promise<T> & { unwrap: () => Promise<T> } {
  const p = promise as Promise<T> & { unwrap: () => Promise<T> };
  p.unwrap = () => promise;
  return p;
}

// Compatibility helpers
export const login = (creds: { email: string; password: string }) => () =>
  withUnwrap(useAuthStore.getState().login(creds));
export const fetchMe = () => () => withUnwrap(useAuthStore.getState().fetchMe());
export const updatePresence = (status: string) => () => withUnwrap(useAuthStore.getState().updatePresence(status));
export const logout = () => () => useAuthStore.getState().logout();

export default useAuthStore;
