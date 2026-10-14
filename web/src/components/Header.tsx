import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import { setCreateIssueOpen, navigateToPage, toggleNotificationDrawer, toggleSidebar } from '../store/uiSlice';
import { recordPunch } from '../store/hrmsSlice';
import { GoogleSearchBar } from './GoogleSearchBar';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { HumoraLogo } from './HumoraLogo';
import { useNotificationPolling } from '../store/notifications';
import {
  Kanban,
  Search,
  Plus,
  ChevronRight,
  ShieldCheck,
  LogIn,
  LogOut,
  Compass,
  Sun,
  Moon,
  HelpCircle,
  Bell,
  Menu,
} from 'lucide-react';

export const Header: React.FC<{ onOpenCommandPalette?: () => void }> = () => {
  const dispatch = useAppDispatch();
  const { workspace, activePage, isNotificationDrawerOpen, notifications } = useAppSelector((state) => state.ui);
  const { attendanceSummary, isPunching } = useAppSelector((state) => state.hrms);
  const { activeProject } = useAppSelector((state) => state.work);
  const { user } = useAppSelector((state) => state.auth);

  useNotificationPolling(!!user);

  const userRoles = user?.roles || [];
  const isAdmin = userRoles.some((r) => ['superadmin', 'admin', 'hr_admin'].includes(r.toLowerCase()));

  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('humora_theme') as 'dark' | 'light') || 'dark';
  });

  // Real-time ticking work stopwatch for senior UX feedback
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!attendanceSummary?.punched_in) {
      setElapsedSeconds(0);
      return;
    }

    const baseSecs = Math.max(0, Math.floor((attendanceSummary.today_hours || 0) * 3600));
    setElapsedSeconds(baseSecs);

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [attendanceSummary?.punched_in, attendanceSummary?.today_hours]);

  const formatStopwatch = (totalSecs: number) => {
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Listen for ? key to open shortcuts modal
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      if (e.key === '?' && !['input', 'textarea', 'select'].includes((e.target as HTMLElement).tagName.toLowerCase())) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('humora_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Opens the face check; it reads the location itself. Cancelling is not an error.
  const handlePunchToggle = () => {
    const punchType = attendanceSummary?.punched_in ? 'out' : 'in';
    dispatch(recordPunch({ punch_type: punchType, source: 'web' })).catch(() => {});
  };

  const todayHours = attendanceSummary?.today_hours || 0;
  const progressPercent = Math.min(100, (todayHours / 8) * 100);

  return (
    <header
      className="app-header"
      style={{
        height: '52px',
        background: 'var(--surface-1)',
        borderBottom: '1px solid var(--border-hairline)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        zIndex: 500,
        overflow: 'visible',
        flexShrink: 0,
        userSelect: 'none',
        transition: 'background-color var(--transition-smooth), border-color var(--transition-smooth)',
      }}
    >
      {/* Left: Humora Brand Emblem + Contextual Breadcrumb */}
      <div className="app-header-left" style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '13px' }}>
        {/* Phones: the section menu is a drawer, opened from here. */}
        <button
          type="button"
          className="btn btn-secondary btn-sm mobile-only"
          onClick={() => dispatch(toggleSidebar())}
          title="Menu"
          aria-label="Open menu"
          style={{ padding: '6px', flexShrink: 0 }}
        >
          <Menu size={16} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          className="hdr-brand"
          onClick={() => dispatch(navigateToPage(isAdmin ? 'company_settings' : 'hub'))}
          style={{
            background: 'none',
            border: 'none',
            padding: '2px 0',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            borderRadius: 'var(--radius-sm)',
            transition: 'opacity var(--transition-fast)',
          }}
          title={isAdmin ? "Humora Management Console" : "Humora Home (My Workday Hub)"}
        >
          <HumoraLogo size={26} showBrandName brandTextSize={15} />
        </button>

        <div className="hdr-sep" style={{ width: '1px', height: '18px', background: 'var(--border-subtle)', flexShrink: 0 }} />

        <div className="app-header-breadcrumbs">
          {workspace === 'employee' ? (
            <>
              <button
                type="button"
                className="breadcrumb-btn"
                onClick={() => dispatch(navigateToPage('hub'))}
                title="Jump to Employee Space Hub (Alt+0)"
              >
                <Compass size={14} strokeWidth={1.8} />
                <span>Employee Space</span>
              </button>
              <ChevronRight size={12} className="hdr-chevron" color="var(--text-dim)" />
              <span className="hdr-current-page">
                {activePage === 'attendance'
                  ? 'My Attendance & Terminal'
                  : activePage === 'leaves'
                  ? 'My Leaves & Absence'
                  : activePage === 'payroll'
                  ? 'My Payroll & Payslips'
                  : activePage === 'profile'
                  ? 'My Employee Profile'
                  : 'My Workday Hub'}
              </span>
            </>
          ) : workspace === 'management' ? (
            <>
              <button
                type="button"
                className="breadcrumb-btn"
                onClick={() => dispatch(navigateToPage('directory'))}
                title="Jump to Organization Directory (Alt+1)"
              >
                <ShieldCheck size={14} strokeWidth={1.8} color="var(--accent-primary)" />
                <span>Management Console</span>
              </button>
              <ChevronRight size={12} className="hdr-chevron" color="var(--text-dim)" />
              <span className="hdr-current-page">
                {activePage === 'shifts'
                  ? 'Shift Catalog & Rostering'
                  : activePage === 'radar'
                  ? 'Live Team Presence Radar'
                  : activePage === 'approvals'
                  ? 'Approvals Desk'
                  : activePage === 'capacity'
                  ? 'Team Capacity & Workload'
                  : activePage === 'directory'
                  ? 'Organization & Employees'
                  : activePage === 'onboarding'
                  ? 'Onboarding Pipeline'
                  : activePage === 'company_settings'
                  ? 'Company Profile & Setup'
                  : 'Management Overview'}
              </span>
            </>
          ) : workspace === 'pulse' ? (
            <span className="hdr-current-page">Team Pulse</span>
          ) : (
            <>
              <button
                type="button"
                className="breadcrumb-btn"
                onClick={() => dispatch(navigateToPage('kanban'))}
                title="Jump to Kanban Board (Alt+2)"
              >
                <Kanban size={14} strokeWidth={1.8} />
                <span>Agile Work</span>
              </button>
              {activeProject && (
                <>
                  <ChevronRight size={12} className="hdr-chevron" color="var(--text-dim)" />
                  <span
                    className="hdr-project-crumb"
                    title={`[${activeProject.key}] ${activeProject.name}`}
                  >
                    [{activeProject.key}] {activeProject.name}
                  </span>
                </>
              )}
              <ChevronRight size={12} className="hdr-chevron" color="var(--text-dim)" />
              <span className="hdr-current-page">
                {activePage === 'backlog'
                  ? 'Sprints & Capacity'
                  : activePage === 'list'
                  ? 'High-Density List'
                  : 'Kanban Board'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Center: High-Level Google-Style Search Bar with Attached Dropdown */}
      <div className="app-header-search">
        <GoogleSearchBar />
      </div>

      {/* Right: Workforce Clock Widget & Action Trigger */}
      <div className="app-header-right" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Attendance Punch Mini Desk with Live Stopwatch — ONLY for Employees */}
        {!isAdmin ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-2)',
              border: '1px solid var(--border-hairline)',
            }}
          >
            {/* Circular Progress Ring */}
            <div style={{ position: 'relative', width: '20px', height: '20px' }}>
              <svg width="20" height="20" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="var(--border-subtle)"
                  strokeWidth="3.5"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={attendanceSummary?.punched_in ? 'var(--hrms-present)' : 'var(--text-muted)'}
                  strokeWidth="4"
                  strokeDasharray={`${progressPercent}, 100`}
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div className="hdr-clock-text" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {attendanceSummary?.punched_in ? (
                  <>
                    <span className="live-pulse-dot" />
                    Active Session
                  </>
                ) : (
                  'Clocked Out'
                )}
              </span>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: attendanceSummary?.punched_in ? 'var(--accent-primary)' : 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                }}
                title={attendanceSummary?.punched_in ? `Active Session: ${formatStopwatch(elapsedSeconds)}` : `Today: ${todayHours.toFixed(1)}h`}
              >
                {attendanceSummary?.punched_in ? formatStopwatch(elapsedSeconds) : `${todayHours.toFixed(1)}h`}
              </span>
            </div>

            <button
              type="button"
              className={`btn btn-sm ${attendanceSummary?.punched_in ? 'btn-danger' : 'btn-success'}`}
              onClick={handlePunchToggle}
              disabled={isPunching}
              style={{ padding: '3px 8px', fontSize: '11px' }}
            >
              {isPunching ? (
                '...'
              ) : attendanceSummary?.punched_in ? (
                <>
                  <LogOut size={12} strokeWidth={2} />
                  Out
                </>
              ) : (
                <>
                  <LogIn size={12} strokeWidth={2} />
                  In
                </>
              )}
            </button>
          </div>
        ) : (
          <div
            className="hdr-mgmt-badge"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-2)',
              border: '1px solid var(--border-hairline)',
              fontSize: '11.5px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
            }}
          >
            <ShieldCheck size={14} color="var(--accent-primary)" />
            <span>Management Console</span>
          </div>
        )}

        {/* Notifications Drawer Toggle */}
        <button
          type="button"
          className={`btn btn-sm ${isNotificationDrawerOpen ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            position: 'relative',
            width: '32px',
            height: '32px',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title={
            (notifications || []).filter((n) => !n.read).length > 0
              ? `Notifications (${(notifications || []).filter((n) => !n.read).length} unread)`
              : 'Notifications'
          }
          onClick={() => dispatch(toggleNotificationDrawer())}
        >
          <Bell
            size={15}
            strokeWidth={2}
            color={isNotificationDrawerOpen ? '#000000' : 'var(--text-secondary)'}
          />
          {(notifications || []).filter((n) => !n.read).length > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-3px',
                right: '-3px',
                minWidth: '16px',
                height: '16px',
                borderRadius: '999px',
                background: 'var(--accent-primary)',
                color: '#000000',
                fontSize: '9.5px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
                boxShadow: '0 0 8px rgba(245, 158, 11, 0.6)',
                border: '1.5px solid var(--surface-1)',
              }}
            >
              {(notifications || []).filter((n) => !n.read).length > 9
                ? '9+'
                : (notifications || []).filter((n) => !n.read).length}
            </span>
          )}
        </button>

        {/* Theme Toggle Button */}
        <button
          type="button"
          className="btn btn-secondary btn-sm hdr-optional"
          style={{ width: '32px', height: '32px', padding: 0 }}
          title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun size={15} color="#fbbf24" strokeWidth={2} /> : <Moon size={15} color="var(--text-secondary)" strokeWidth={2} />}
        </button>

        {/* Keyboard Shortcuts Help Button */}
        <button
          type="button"
          className="btn btn-secondary btn-sm hdr-optional"
          style={{ width: '32px', height: '32px', padding: 0 }}
          title="Keyboard Shortcuts Guide (?)"
          onClick={() => setIsShortcutsOpen(true)}
        >
          <HelpCircle size={15} color="var(--text-secondary)" strokeWidth={2} />
        </button>

        {/* New Issue Button in Work Mode */}
        {workspace === 'work' && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => dispatch(setCreateIssueOpen(true))}
          >
            <Plus size={13} strokeWidth={2} />
            Issue (C)
          </button>
        )}
      </div>

      {/* Global Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
    </header>
  );
};

export default Header;
