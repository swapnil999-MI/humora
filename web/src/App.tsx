import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from './store/store';
import {
  navigateToPage,
  setWorkspace,
  setCreateIssueOpen,
  toggleSidebar,
  PageId,
} from './store/uiSlice';
import { fetchMe } from './store/authSlice';
import { fetchEmployees, fetchAttendanceSummary } from './store/hrmsSlice';
import { fetchProjects } from './store/workSlice';
import { fetchMyWorkday } from './store/fusionSlice';

// Navigation & Layout Components
import { AppRail } from './components/AppRail';
import { SubNavPane } from './components/SubNavPane';
import { Header } from './components/Header';
import { ToastContainer } from './components/ToastContainer';

// Pages & Router
import { PageRouter } from './pages/PageRouter';
import { LoginPage } from './pages/auth/LoginPage';
import { CandidateWizardPage } from './pages/onboarding/CandidateWizardPage';

// Modals & Slide-over Drawers
import { NotificationDrawer } from './components/NotificationDrawer';
import { IssueDrawer } from './views/work/IssueDrawer';
import { CreateIssueModal } from './components/CreateIssueModal';
import { CreateProjectModal } from './components/CreateProjectModal';
import { RegularizationModal } from './views/hrms/RegularizationModal';

const extractCandidateToken = (): string | null => {
  if (typeof window === 'undefined') return null;

  // 1. Pathname format: /onboard/:token
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const onboardPathIdx = pathParts.indexOf('onboard');
  if (onboardPathIdx !== -1 && pathParts[onboardPathIdx + 1]) {
    return pathParts[onboardPathIdx + 1];
  }

  // 2. Hash path format: #/onboard/:token or #onboard/:token
  const cleanHash = window.location.hash.replace(/^#\/?/, '');
  const hashPathOnly = cleanHash.split('?')[0];
  const hashParts = hashPathOnly.split('/').filter(Boolean);
  const onboardHashIdx = hashParts.indexOf('onboard');
  if (onboardHashIdx !== -1 && hashParts[onboardHashIdx + 1]) {
    return hashParts[onboardHashIdx + 1];
  }

  // 3. Search query params (?onboarding_token=... or ?token=...)
  const urlParams = new URLSearchParams(window.location.search);
  const qToken = urlParams.get('onboarding_token') || urlParams.get('token');
  if (qToken) return qToken;

  // 4. Hash query params (#/...?token=...)
  if (window.location.hash.includes('?')) {
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const hToken = hashParams.get('onboarding_token') || hashParams.get('token');
    if (hToken) return hToken;
  }

  return null;
};

export const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const userRoles = user?.roles || [];
  const isAdmin = userRoles.some((r) => ['superadmin', 'admin', 'hr_admin'].includes(r.toLowerCase()));
  const isEmployee = userRoles.some((r) => r.toLowerCase() === 'employee') && !isAdmin;

  // Candidate self-service onboarding token from URL pathname, hash, or params
  const [candidateWizardToken, setCandidateWizardToken] = useState<string | null>(extractCandidateToken);

  useEffect(() => {
    const handleUrlChange = () => {
      const tok = extractCandidateToken();
      setCandidateWizardToken(tok);
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  // Initial landing page setup based on role
  useEffect(() => {
    if (isAuthenticated) {
      const curHash = window.location.hash.replace(/^#\/?/, '').trim();
      if (isAdmin) {
        const essPages = ['hub', 'attendance', 'leaves', 'payroll', 'profile', '', 'login'];
        if (essPages.includes(curHash)) {
          dispatch(setWorkspace('management'));
          dispatch(navigateToPage('company_settings'));
          window.location.hash = '#/company_settings';
        }
      } else if (isEmployee) {
        const mgmtPages = ['shifts', 'radar', 'approvals', 'capacity', 'directory', 'onboarding', 'company_settings', '', 'login'];
        if (mgmtPages.includes(curHash)) {
          dispatch(setWorkspace('employee'));
          dispatch(navigateToPage('hub'));
          window.location.hash = '#/hub';
        }
      }
    }
  }, [isAuthenticated, isAdmin, isEmployee, dispatch]);

  // Listen to browser URL hash changes to keep Redux page state synchronized
  useEffect(() => {
    const handleHash = () => {
      const rawHash = window.location.hash.replace(/^#\/?/, '').replace(/[.\/]+$/, '').trim();
      const validPages: PageId[] = [
        'hub',
        'attendance',
        'leaves',
        'payroll',
        'profile',
        'shifts',
        'radar',
        'approvals',
        'capacity',
        'directory',
        'onboarding',
        'company_settings',
        'kanban',
        'list',
        'backlog',
        'pulse',
      ];
      if (validPages.includes(rawHash as PageId)) {
        dispatch(navigateToPage(rawHash as PageId));
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchMe());
      dispatch(fetchEmployees(''));
      dispatch(fetchProjects());
      if (!isAdmin) {
        dispatch(fetchAttendanceSummary());
        dispatch(fetchMyWorkday());
      }
    }
  }, [dispatch, isAuthenticated, isAdmin]);

  // Global Keyboard Navigation (Cmd+K, Cmd+\, Alt+0, Alt+1, Alt+2, Alt+3, C)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus Header Google Search Bar with Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('focus-header-search'));
        return;
      }

      // Toggle Left SubNav with Cmd+\ or Ctrl+\
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        dispatch(toggleSidebar());
        return;
      }

      // Ignore single key shortcuts if user is typing in an input/textarea/select
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      if (e.altKey && e.key === '0') {
        e.preventDefault();
        if (!isAdmin) {
          dispatch(setWorkspace('employee'));
        }
      } else if (e.altKey && e.key === '1') {
        e.preventDefault();
        if (!isEmployee) {
          dispatch(setWorkspace('management'));
        }
      } else if (e.altKey && e.key === '2') {
        e.preventDefault();
        dispatch(setWorkspace('work'));
      } else if (e.altKey && e.key === '3') {
        e.preventDefault();
        dispatch(setWorkspace('pulse'));
      } else if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        dispatch(setCreateIssueOpen(true));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch, isAdmin, isEmployee]);

  // Priority 1: Candidate self-service onboarding portal
  // Candidates accessing via their invite token do NOT need to authenticate
  if (candidateWizardToken) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--surface-0)' }}>
        <CandidateWizardPage
          token={candidateWizardToken}
          onExit={() => {
            setCandidateWizardToken(null);
            if (window.location.pathname.includes('/onboard')) {
              window.history.pushState({}, '', '/');
            } else if (window.location.hash.includes('onboard')) {
              window.location.hash = '';
            }
          }}
        />
        <ToastContainer />
      </div>
    );
  }

  // Priority 2: Unauthenticated users -> LoginPage
  if (!isAuthenticated) {
    return (
      <>
        <LoginPage />
        <ToastContainer />
      </>
    );
  }

  return (
    <div
      className="app-shell"
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: 'var(--surface-0)',
      }}
    >
      {/* Tier 1: 64px Persistent Leftmost App Rail */}
      <AppRail />

      {/* Tier 2: 230px Collapsible Sub-Navigation Pane */}
      <SubNavPane />

      {/* Tier 3: Main Application Canvas & Header */}
      <div
        className="main-layout"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {/* Top Header & Breadcrumbs */}
        <Header />

        {/* Dynamic Redux-Driven Page Canvas */}
        <main
          className="main-content"
          style={{
            flex: 1,
            overflowY: 'auto',
            background: 'var(--surface-0)',
            position: 'relative',
          }}
        >
          <PageRouter onOpenCandidateWizard={(tok) => setCandidateWizardToken(tok)} />
        </main>
      </div>

      {/* Fullscreen Candidate Portal Simulation Overlay */}
      {candidateWizardToken && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'var(--surface-0)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              height: '42px',
              background: 'var(--surface-2)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 24px',
              fontSize: '12px',
              color: 'var(--text-muted)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--accent-primary)',
                }}
              />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                Candidate Portal Preview Mode
              </span>
              <span>(Interactive Simulation)</span>
            </div>
            <button
              className="btn-ghost"
              style={{
                fontSize: '12px',
                padding: '4px 12px',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                background: 'var(--surface-3)',
                cursor: 'pointer',
              }}
              onClick={() => setCandidateWizardToken(null)}
            >
              Exit Candidate Preview
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <CandidateWizardPage
              token={candidateWizardToken}
              onExit={() => setCandidateWizardToken(null)}
            />
          </div>
        </div>
      )}

      {/* Modals & Slide-over Panels */}
      <NotificationDrawer />
      <IssueDrawer />
      <CreateIssueModal />
      <CreateProjectModal />
      <RegularizationModal />
      <ToastContainer />
    </div>
  );
};

export default App;
