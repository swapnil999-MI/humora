import { create } from 'zustand';
import { User } from '../types';
import { api, setTokens, clearTokens, getToken, setOnUnauthorized } from '../api/client';
import { useHrmsStore } from './hrmsStore';
import { useUiStore } from './uiStore';

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (credentials: { email: string; password: string }) => Promise<any>;
  register: (payload: {
    organization_name: string;
    slug: string;
    admin_email: string;
    admin_password: string;
    first_name: string;
    last_name: string;
  }) => Promise<any>;
  fetchMe: () => Promise<User | null>;
  setSessionFromTokens: (accessToken: string, refreshToken: string, user?: User | null) => Promise<void>;
  updatePresence: (status: string) => Promise<string | null>;
  logout: () => void;
}

const savedUser = typeof localStorage !== 'undefined' ? localStorage.getItem('humora_user') : null;

export const routeUserByRole = (user: User | null | undefined) => {
  const userRoles = user?.roles || [];
  const isAdmin = userRoles.some((r) => ['superadmin', 'admin', 'hr_admin'].includes(r.toLowerCase()));
  if (isAdmin) {
    useUiStore.getState().setWorkspace('management');
    const currentHash = typeof window !== 'undefined' ? window.location.hash.replace(/^#\/?/, '').trim() : '';
    const essPages = ['hub', 'attendance', 'leaves', 'payroll', 'profile', '', 'login'];
    if (essPages.includes(currentHash)) {
      useUiStore.getState().navigateToPage('company_settings');
      if (typeof window !== 'undefined') {
        window.location.hash = '#/company_settings';
      }
    }
  } else {
    useUiStore.getState().setWorkspace('employee');
    const currentHash = typeof window !== 'undefined' ? window.location.hash.replace(/^#\/?/, '').trim() : '';
    const mgmtPages = ['shifts', 'radar', 'approvals', 'capacity', 'directory', 'onboarding', 'company_settings', '', 'login'];
    if (mgmtPages.includes(currentHash)) {
      useUiStore.getState().navigateToPage('hub');
      if (typeof window !== 'undefined') {
        window.location.hash = '#/hub';
      }
    }
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: savedUser ? JSON.parse(savedUser) : null,
  accessToken: getToken(),
  isAuthenticated: !!getToken(),
  isLoading: false,
  error: null,

  setSessionFromTokens: async (accessToken, refreshToken, user) => {
    setTokens(accessToken, refreshToken);
    if (user) {
      localStorage.setItem('humora_user', JSON.stringify(user));
      set({ isAuthenticated: true, user, accessToken });
      routeUserByRole(user);
    } else {
      set({ isAuthenticated: true, accessToken });
      try {
        const me = await api.get<User>('/auth/me');
        localStorage.setItem('humora_user', JSON.stringify(me));
        set({ user: me });
        routeUserByRole(me);
      } catch (e) {
        console.error('Failed to fetch user profile after session set:', e);
      }
    }
  },

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
      routeUserByRole(data.user);
      return { unwrap: () => Promise.resolve(data) };
    } catch (err: any) {
      const msg = err.message || 'Login failed';
      set({ isLoading: false, error: msg });
      throw msg;
    }
  },

  register: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      clearTokens();
      useHrmsStore.getState().resetHrmsStore();
      const data = await api.post<{
        access_token: string;
        refresh_token: string;
        user: User;
      }>('/auth/register', payload);

      setTokens(data.access_token, data.refresh_token);
      localStorage.setItem('humora_user', JSON.stringify(data.user));
      set({
        isLoading: false,
        isAuthenticated: true,
        user: data.user,
        accessToken: data.access_token,
      });
      routeUserByRole(data.user);
      return { unwrap: () => Promise.resolve(data) };
    } catch (err: any) {
      const msg = err.message || 'Registration failed';
      set({ isLoading: false, error: msg });
      throw msg;
    }
  },

  fetchMe: async () => {
    try {
      const user = await api.get<User>('/auth/me');
      localStorage.setItem('humora_user', JSON.stringify(user));
      set({ user, isAuthenticated: true });
      routeUserByRole(user);
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
    useHrmsStore.getState().resetHrmsStore();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('humora_user');
    }
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      error: null,
    });
    if (typeof window !== 'undefined') {
      window.location.hash = '#/login';
    }
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
export const register = (payload: any) => () => withUnwrap(useAuthStore.getState().register(payload));
export const fetchMe = () => () => withUnwrap(useAuthStore.getState().fetchMe());
export const updatePresence = (status: string) => () => withUnwrap(useAuthStore.getState().updatePresence(status));
export const logout = () => () => useAuthStore.getState().logout();

// Automatic session expiration & invalid token redirect handler
let isHandlingUnauthorized = false;
setOnUnauthorized((_msg: string) => {
  if (isHandlingUnauthorized) return;
  isHandlingUnauthorized = true;
  setTimeout(() => {
    isHandlingUnauthorized = false;
  }, 2500);

  useAuthStore.getState().logout();
  if (typeof window !== 'undefined') {
    if (window.location.hash !== '#/login') {
      window.location.hash = '#/login';
    }
  }
  useUiStore.getState().addToast({
    type: 'error',
    message: 'Your session has expired. Please sign in again.',
  });
});

export default useAuthStore;
