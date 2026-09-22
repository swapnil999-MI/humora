import React, { useState, useRef, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import { navigateToPage, setWorkspace, toggleSidebar } from '../store/uiSlice';
import { logout } from '../store/authSlice';
import { PeopleOSLogo } from './PeopleOSLogo';
import {
  Kanban,
  Search,
  PanelLeftClose,
  PanelLeft,
  Compass,
  LogOut,
  ShieldCheck,
  Building2,
  User,
  Clock,
} from 'lucide-react';

export const AppRail: React.FC<{ onOpenCommandPalette?: () => void }> = ({
  onOpenCommandPalette,
}) => {
  const dispatch = useAppDispatch();
  const { workspace, activePage, isSidebarCollapsed } = useAppSelector((state) => state.ui);
  const { user } = useAppSelector((state) => state.auth);
  const { attendanceSummary, myProfile, companyLeaves, teamRegularizations } = useAppSelector(
    (state) => state.hrms
  );

  const [isProfileFlyoutOpen, setIsProfileFlyoutOpen] = useState(false);
  const profileFlyoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileFlyoutRef.current && !profileFlyoutRef.current.contains(e.target as Node)) {
        setIsProfileFlyoutOpen(false);
      }
    };
    if (isProfileFlyoutOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isProfileFlyoutOpen]);

  const isPunchedIn = attendanceSummary?.punched_in;
  const pendingApprovalsCount =
    (companyLeaves || []).filter((l) => l.status === 'pending').length +
    (teamRegularizations || []).filter((r) => r.status === 'pending').length;

  return (
    <aside className="app-rail">
      {/* Top: Brand Emblem & Workspace Domain Switchers */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', width: '100%' }}>
        {/* Brand Emblem */}
        <button
          type="button"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface-3)',
            border: '1px solid var(--border-hairline)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
            transition: 'transform var(--transition-fast), border-color var(--transition-fast)',
            padding: 0,
          }}
          title="PeopleOS Platform (My Workday Hub)"
          onClick={() => dispatch(navigateToPage('hub'))}
        >
          <PeopleOSLogo size={24} />
        </button>

        <div style={{ width: '28px', height: '1px', background: 'var(--border-hairline)' }} />

        {/* Domain 1: Employee Self-Service Space (ESS) */}
        <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
          {workspace === 'employee' && <div className="app-rail-indicator" />}
          <button
            type="button"
            className={`app-rail-btn ${workspace === 'employee' ? 'active' : ''}`}
            onClick={() => dispatch(setWorkspace('employee'))}
            title="Employee Self-Service (Alt+0)"
          >
            <Compass size={19} strokeWidth={1.8} />
          </button>
        </div>

        {/* Domain 2: Management & Operations Console (MSS) */}
        <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
          {workspace === 'management' && <div className="app-rail-indicator" />}
          <button
            type="button"
            className={`app-rail-btn ${workspace === 'management' ? 'active' : ''}`}
            onClick={() => dispatch(setWorkspace('management'))}
            title="Management Console (Alt+1)"
          >
            <ShieldCheck size={19} strokeWidth={1.8} />
            {pendingApprovalsCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--text-primary)',
                }}
              />
            )}
          </button>
        </div>

        {/* Domain 3: Agile Work & Projects */}
        <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
          {workspace === 'work' && <div className="app-rail-indicator" />}
          <button
            type="button"
            className={`app-rail-btn ${workspace === 'work' ? 'active' : ''}`}
            onClick={() => dispatch(setWorkspace('work'))}
            title="Agile Projects & Sprints (Alt+2)"
          >
            <Kanban size={19} strokeWidth={1.8} />
          </button>
        </div>

        {/* Search Bar Focus Trigger */}
        <button
          type="button"
          className="app-rail-btn"
          onClick={() => {
            if (onOpenCommandPalette) onOpenCommandPalette();
            else window.dispatchEvent(new CustomEvent('focus-header-search'));
          }}
          title="Universal Search (Cmd+K)"
        >
          <Search size={18} strokeWidth={1.8} />
        </button>
      </div>

      {/* Bottom: Sidebar Toggle & User Presence Avatar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%' }}>
        {/* Toggle Sub-Nav Pane */}
        <button
          type="button"
          className="app-rail-btn"
          style={{ width: '34px', height: '34px' }}
          onClick={() => dispatch(toggleSidebar())}
          title={isSidebarCollapsed ? 'Expand Sidebar (Cmd+\\)' : 'Collapse Sidebar (Cmd+\\)'}
        >
          {isSidebarCollapsed ? <PanelLeft size={17} strokeWidth={1.8} /> : <PanelLeftClose size={17} strokeWidth={1.8} />}
        </button>

        {/* User Avatar with Presence Ring & Profile Flyout */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: activePage === 'profile' || isProfileFlyoutOpen ? 'var(--accent-primary)' : 'var(--surface-3)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              color: activePage === 'profile' || isProfileFlyoutOpen ? '#ffffff' : 'var(--text-primary)',
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-xs)',
              transition: 'all var(--transition-fast)',
              padding: 0,
            }}
            title={`${user?.email} - Click for Account & Settings`}
            onClick={() => setIsProfileFlyoutOpen((prev) => !prev)}
          >
            {myProfile?.employee?.avatar_url ? (
              <img
                src={myProfile.employee.avatar_url}
                alt="Profile"
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              user?.email?.charAt(0).toUpperCase() || 'U'
            )}
          </button>

          {/* Status Presence Dot */}
          <span
            className={`status-dot ${isPunchedIn ? 'active' : ''}`}
            style={{
              position: 'absolute',
              bottom: '-1px',
              right: '-1px',
              border: '2px solid var(--surface-1)',
            }}
            title={isPunchedIn ? 'Active Workday (Punched In)' : 'Away / Punched Out'}
          />

          {/* User Profile Flyout Popover */}
          {isProfileFlyoutOpen && (
            <div
              ref={profileFlyoutRef}
              className="app-rail-profile-flyout"
              style={{
                position: 'absolute',
                left: 'calc(100% + 14px)',
                bottom: '-10px',
                width: '240px',
                backgroundColor: 'var(--surface-1)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-popover)',
                padding: '14px',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'var(--accent-subtle)',
                    color: 'var(--accent-primary)',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  {myProfile?.employee?.avatar_url ? (
                    <img src={myProfile.employee.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    user?.email?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {myProfile?.employee ? `${myProfile.employee.first_name} ${myProfile.employee.last_name}` : user?.email?.split('@')[0]}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {user?.email}
                  </span>
                </div>
              </div>

              {/* Status Indicator */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-xs)',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-hairline)',
                }}
              >
                {isPunchedIn ? (
                  <span className="live-pulse-dot" />
                ) : (
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--text-muted)' }} />
                )}
                <span style={{ color: isPunchedIn ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                  {isPunchedIn ? 'Clocked In · Active Session' : 'Clocked Out'}
                </span>
              </div>

              <div style={{ height: '1px', background: 'var(--border-hairline)' }} />

              {/* Navigation links */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ justifyContent: 'flex-start', padding: '6px 8px', fontSize: '12px', borderRadius: 'var(--radius-xs)', gap: '8px' }}
                  onClick={() => {
                    setIsProfileFlyoutOpen(false);
                    dispatch(navigateToPage('profile'));
                  }}
                >
                  <User size={13} color="var(--accent-primary)" />
                  My Profile
                </button>

                <button
                  type="button"
                  className="btn-ghost"
                  style={{ justifyContent: 'flex-start', padding: '6px 8px', fontSize: '12px', borderRadius: 'var(--radius-xs)', gap: '8px' }}
                  onClick={() => {
                    setIsProfileFlyoutOpen(false);
                    dispatch(navigateToPage('attendance'));
                  }}
                >
                  <Clock size={13} color="var(--accent-primary)" />
                  Attendance & Terminal
                </button>
              </div>

              <div style={{ height: '1px', background: 'var(--border-hairline)' }} />

              <button
                type="button"
                className="btn-ghost"
                style={{
                  justifyContent: 'flex-start',
                  padding: '6px 8px',
                  fontSize: '12px',
                  borderRadius: 'var(--radius-xs)',
                  color: '#f43f5e',
                  gap: '8px',
                }}
                onClick={() => {
                  setIsProfileFlyoutOpen(false);
                  if (confirm('Sign out from PeopleOS?')) dispatch(logout());
                }}
              >
                <LogOut size={13} />
                Sign Out
              </button>
            </div>
          )}
        </div>

        {/* Sign Out Button */}
        <button
          type="button"
          className="app-rail-btn"
          style={{ width: '30px', height: '30px', color: 'var(--text-dim)' }}
          onClick={() => {
            if (confirm('Sign out from Humora?')) dispatch(logout());
          }}
          title="Sign out"
        >
          <LogOut size={14} strokeWidth={1.8} />
        </button>
      </div>
    </aside>
  );
};

export default AppRail;
