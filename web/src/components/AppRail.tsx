import React from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import { navigateToPage, setWorkspace, toggleSidebar } from '../store/uiSlice';
import { logout } from '../store/authSlice';
import {
  Kanban,
  Search,
  PanelLeftClose,
  PanelLeft,
  Compass,
  LogOut,
  ShieldCheck,
  Building2,
} from 'lucide-react';

export const AppRail: React.FC<{ onOpenCommandPalette: () => void }> = ({
  onOpenCommandPalette,
}) => {
  const dispatch = useAppDispatch();
  const { workspace, activePage, isSidebarCollapsed } = useAppSelector((state) => state.ui);
  const { user } = useAppSelector((state) => state.auth);
  const { attendanceSummary, myProfile, companyLeaves, teamRegularizations } = useAppSelector(
    (state) => state.hrms
  );

  const isPunchedIn = attendanceSummary?.punched_in;
  const pendingApprovalsCount =
    (companyLeaves || []).filter((l) => l.status === 'pending').length +
    (teamRegularizations || []).filter((r) => r.status === 'pending').length;

  return (
    <aside
      style={{
        width: '56px',
        background: 'var(--surface-1)',
        borderRight: '1px solid var(--border-hairline)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        zIndex: 60,
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {/* Top: Brand Emblem & Domain Switchers */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', width: '100%' }}>
        {/* Brand Logo: Clean Precision Indigo */}
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.25), var(--shadow-sm)',
            cursor: 'pointer',
          }}
          title="Humora Enterprise Platform"
          onClick={() => dispatch(navigateToPage('hub'))}
        >
          <Building2 size={17} color="#ffffff" />
        </div>

        <div style={{ width: '28px', height: '1px', background: 'var(--border-hairline)' }} />

        {/* Domain 1: Employee Self-Service Space (ESS) */}
        <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
          {workspace === 'employee' && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                width: '3px',
                height: '18px',
                background: 'var(--accent-primary)',
                borderRadius: '0 3px 3px 0',
              }}
            />
          )}
          <button
            className="btn-ghost"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: workspace === 'employee' ? 'var(--surface-hover)' : 'transparent',
              color: workspace === 'employee' ? '#ffffff' : 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
            onClick={() => dispatch(setWorkspace('employee'))}
            title="Employee Self-Service Space (Alt+0)"
          >
            <Compass size={18} />
          </button>
        </div>

        {/* Domain 2: Management & Operations Console (MSS) */}
        <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
          {workspace === 'management' && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                width: '3px',
                height: '18px',
                background: 'var(--accent-primary)',
                borderRadius: '0 3px 3px 0',
              }}
            />
          )}
          <button
            className="btn-ghost"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: workspace === 'management' ? 'var(--surface-hover)' : 'transparent',
              color: workspace === 'management' ? '#ffffff' : 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              transition: 'all var(--transition-fast)',
            }}
            onClick={() => dispatch(setWorkspace('management'))}
            title="Management & Operations Console (Alt+1)"
          >
            <ShieldCheck size={18} />
            {pendingApprovalsCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: '#f59e0b',
                }}
              />
            )}
          </button>
        </div>

        {/* Domain 3: Agile Work & Projects */}
        <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
          {workspace === 'work' && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                width: '3px',
                height: '18px',
                background: 'var(--accent-primary)',
                borderRadius: '0 3px 3px 0',
              }}
            />
          )}
          <button
            className="btn-ghost"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: workspace === 'work' ? 'var(--surface-hover)' : 'transparent',
              color: workspace === 'work' ? '#ffffff' : 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
            onClick={() => dispatch(setWorkspace('work'))}
            title="Agile Projects & Sprints (Alt+2)"
          >
            <Kanban size={18} />
          </button>
        </div>

        {/* Command Palette Trigger */}
        <button
          className="btn-ghost"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
          onClick={onOpenCommandPalette}
          title="Universal Search (Cmd+K)"
        >
          <Search size={17} />
        </button>
      </div>

      {/* Bottom: Sidebar Toggle & User Presence Avatar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%' }}>
        {/* Toggle Sub-Nav Pane */}
        <button
          className="btn-ghost"
          style={{
            width: '34px',
            height: '34px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
          onClick={() => dispatch(toggleSidebar())}
          title={isSidebarCollapsed ? 'Expand Sidebar (Cmd+\\)' : 'Collapse Sidebar (Cmd+\\)'}
        >
          {isSidebarCollapsed ? <PanelLeft size={17} /> : <PanelLeftClose size={17} />}
        </button>

        {/* User Avatar with Presence Ring - Navigate to ESS My Profile */}
        <div style={{ position: 'relative' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background:
                activePage === 'profile'
                  ? 'var(--accent-primary)'
                  : 'var(--surface-3)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              color:
                activePage === 'profile'
                  ? '#ffffff'
                  : 'var(--text-primary)',
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all var(--transition-fast)',
            }}
            title={`${user?.email} - My Profile (ESS)`}
            onClick={() => dispatch(navigateToPage('profile'))}
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
          </div>

          {/* Pulsing Status Dot */}
          <span
            className={`status-dot ${isPunchedIn ? 'active' : ''}`}
            style={{
              position: 'absolute',
              bottom: '-1px',
              right: '-1px',
              width: '8px',
              height: '8px',
              border: '2px solid var(--surface-1)',
            }}
            title={isPunchedIn ? 'Active Workday (Checked In)' : 'Away / Checked Out'}
          />
        </div>

        {/* Dedicated Sign Out Button */}
        <button
          className="btn-ghost"
          style={{
            width: '28px',
            height: '28px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            padding: 0,
          }}
          onClick={() => {
            if (confirm('Sign out from Humora?')) dispatch(logout());
          }}
          title="Sign out from Humora"
        >
          <LogOut size={13} />
        </button>
      </div>
    </aside>
  );
};

export default AppRail;
