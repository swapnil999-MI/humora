import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import { setCreateIssueOpen, navigateToPage, toggleNotificationDrawer } from '../store/uiSlice';
import { recordPunch } from '../store/hrmsSlice';
import { GoogleSearchBar } from './GoogleSearchBar';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { PeopleOSLogo } from './PeopleOSLogo';
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
} from 'lucide-react';

export const Header: React.FC<{ onOpenCommandPalette?: () => void }> = () => {
  const dispatch = useAppDispatch();
  const { workspace, activePage, isNotificationDrawerOpen, notifications } = useAppSelector((state) => state.ui);
  const { attendanceSummary, isPunching } = useAppSelector((state) => state.hrms);
  const { activeProject } = useAppSelector((state) => state.work);

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

  const handlePunchToggle = () => {
    const isCurrentlyIn = attendanceSummary?.punched_in;
    const punchType = isCurrentlyIn ? 'out' : 'in';

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          dispatch(
            recordPunch({
              punch_type: punchType,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              source: 'web',
            })
          );
        },
        () => {
          dispatch(recordPunch({ punch_type: punchType, source: 'web' }));
        }
      );
    } else {
      dispatch(recordPunch({ punch_type: punchType, source: 'web' }));
    }
  };

  const todayHours = attendanceSummary?.today_hours || 0;
  const progressPercent = Math.min(100, (todayHours / 8) * 100);

  return (
    <header
      style={{
        height: '52px',
        background: 'var(--surface-1)',
        borderBottom: '1px solid var(--border-hairline)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        zIndex: 40,
        flexShrink: 0,
        userSelect: 'none',
        transition: 'background-color var(--transition-smooth), border-color var(--transition-smooth)',
      }}
    >
      {/* Left: PeopleOS Brand Emblem + Contextual Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '13px' }}>
        <button
          type="button"
          onClick={() => dispatch(navigateToPage('hub'))}
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
          title="PeopleOS Platform Home (My Workday Hub)"
        >
          <PeopleOSLogo size={26} showBrandName brandTextSize={15} subText="Enterprise" />
        </button>

        <div style={{ width: '1px', height: '18px', background: 'var(--border-subtle)' }} />

        {workspace === 'employee' ? (
          <>
            <button
              type="button"
              className="breadcrumb-btn"
              onClick={() => dispatch(navigateToPage('hub'))}
              title="Jump to Employee Space Hub (Alt+0)"
            >
              <Compass size={14} strokeWidth={1.8} />
              Employee Space
            </button>
            <ChevronRight size={12} color="var(--text-dim)" />
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
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
              Management Console
            </button>
            <ChevronRight size={12} color="var(--text-dim)" />
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
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
        ) : (
          <>
            <button
              type="button"
              className="breadcrumb-btn"
              onClick={() => dispatch(navigateToPage('kanban'))}
              title="Jump to Kanban Board (Alt+2)"
            >
              <Kanban size={14} strokeWidth={1.8} />
              Agile Work
            </button>
            <ChevronRight size={12} color="var(--text-dim)" />
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
              [{activeProject?.key || 'ACME'}] {activeProject?.name || 'Main Project'}
            </span>
            <ChevronRight size={12} color="var(--text-dim)" />
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {activePage === 'backlog'
                ? 'Sprints & Capacity'
                : activePage === 'list'
                ? 'High-Density List'
                : 'Kanban Board'}
            </span>
          </>
        )}
      </div>

      {/* Center: High-Level Google-Style Search Bar with Attached Dropdown */}
      <GoogleSearchBar />

      {/* Right: Workforce Clock Widget & Action Trigger */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Attendance Punch Mini Desk with Live Stopwatch */}
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

          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
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
          className="btn btn-secondary btn-sm"
          style={{ width: '32px', height: '32px', padding: 0 }}
          title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun size={15} color="#fbbf24" strokeWidth={2} /> : <Moon size={15} color="var(--text-secondary)" strokeWidth={2} />}
        </button>

        {/* Keyboard Shortcuts Help Button */}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
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
