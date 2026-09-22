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
    <aside className="app-rail">
      {/* Top: Brand Emblem & Workspace Domain Switchers */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', width: '100%' }}>
        {/* Brand Emblem */}
        <button
          type="button"
          style={{
            width: '34px',
            height: '34px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--text-primary)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
            transition: 'transform var(--transition-fast)',
          }}
          title="Humora Enterprise Platform"
          onClick={() => dispatch(navigateToPage('hub'))}
        >
          <Building2 size={18} color="var(--surface-0)" strokeWidth={2} />
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

        {/* Command Palette Trigger */}
        <button
          type="button"
          className="app-rail-btn"
          onClick={onOpenCommandPalette}
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

        {/* User Avatar with Presence Ring */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: activePage === 'profile' ? 'var(--text-primary)' : 'var(--surface-3)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              color: activePage === 'profile' ? 'var(--surface-0)' : 'var(--text-primary)',
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-xs)',
              transition: 'all var(--transition-fast)',
              padding: 0,
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
