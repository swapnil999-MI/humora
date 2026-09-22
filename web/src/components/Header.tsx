import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import { setCreateIssueOpen } from '../store/uiSlice';
import { recordPunch } from '../store/hrmsSlice';
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
} from 'lucide-react';

export const Header: React.FC<{ onOpenCommandPalette: () => void }> = ({
  onOpenCommandPalette,
}) => {
  const dispatch = useAppDispatch();
  const { workspace, activePage } = useAppSelector((state) => state.ui);
  const { attendanceSummary, isPunching } = useAppSelector((state) => state.hrms);
  const { activeProject } = useAppSelector((state) => state.work);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('humora_theme') as 'dark' | 'light') || 'dark';
  });

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
      {/* Left: Contextual Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
        {workspace === 'employee' ? (
          <>
            <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Compass size={14} strokeWidth={1.8} />
              Employee Space
            </span>
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
            <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} strokeWidth={1.8} color="var(--accent-primary)" />
              Management Console
            </span>
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
            <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Kanban size={14} strokeWidth={1.8} />
              Agile Work
            </span>
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

      {/* Center: Quick Search Trigger */}
      <div
        onClick={onOpenCommandPalette}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '5px 12px',
          background: 'var(--surface-2)',
          border: '1px solid var(--border-hairline)',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          width: '260px',
          justifyContent: 'space-between',
          color: 'var(--text-muted)',
          fontSize: '12px',
          transition: 'all var(--transition-fast)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={13} strokeWidth={1.8} />
          <span>Quick search or action...</span>
        </div>
        <span
          style={{
            fontSize: '10px',
            padding: '1px 5px',
            borderRadius: 'var(--radius-xs)',
            background: 'var(--surface-hover)',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          &#8984;K
        </span>
      </div>

      {/* Right: Workforce Clock Widget & Action Trigger */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Attendance Punch Mini Desk */}
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
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {attendanceSummary?.punched_in ? 'Clocked In' : 'Clocked Out'}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {todayHours.toFixed(1)}h
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
    </header>
  );
};

export default Header;
