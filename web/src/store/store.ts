import { useUiStore, UiState } from './uiStore';
import { useAuthStore, AuthState } from './authStore';
import { useWorkStore, WorkState } from './workStore';
import { useHrmsStore, HrmsState } from './hrmsStore';
import { useFusionStore, FusionState } from './fusionStore';

export interface RootState {
  ui: UiState;
  auth: AuthState;
  work: WorkState;
  hrms: HrmsState;
  fusion: FusionState;
}

export function useAppSelector<T>(selector: (state: RootState) => T): T {
  const ui = useUiStore();
  const auth = useAuthStore();
  const work = useWorkStore();
  const hrms = useHrmsStore();
  const fusion = useFusionStore();
  return selector({ ui, auth, work, hrms, fusion });
}

// Stable singleton dispatch function reference to prevent infinite re-renders in useEffect([dispatch])
export const appDispatch = (action: any): any => {
  if (typeof action === 'function') {
    return action();
  }
  return action;
};

export function useAppDispatch() {
  return appDispatch;
}

export { useUiStore, useAuthStore, useWorkStore, useHrmsStore, useFusionStore };
export default { useUiStore, useAuthStore, useWorkStore, useHrmsStore, useFusionStore };
