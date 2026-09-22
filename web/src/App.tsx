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

export const App: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated } = useAppSelector((state) => state.auth);

  // Candidate self-service onboarding token from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const urlOnboardingToken = urlParams.get('onboarding_token') || urlParams.get('token');
  const [candidateWizardToken, setCandidateWizardToken] = useState<string | null>(urlOnboardingToken);

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
      dispatch(fetchAttendanceSummary());
      dispatch(fetchEmployees(''));
      dispatch(fetchProjects());
      dispatch(fetchMyWorkday());
    }
  }, [dispatch, isAuthenticated]);

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
        dispatch(setWorkspace('employee'));
      } else if (e.altKey && e.key === '1') {
        e.preventDefault();
        dispatch(setWorkspace('management'));
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
  }, [dispatch]);

  if (!isAuthenticated) {
    if (urlOnboardingToken) {
      return (
        <div style={{ minHeight: '100vh', background: 'var(--surface-0)' }}>
          <CandidateWizardPage token={urlOnboardingToken} />
          <ToastContainer />
        </div>
      );
    }
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
