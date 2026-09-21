import React from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import {
  navigateToPage,
  setCreateIssueOpen,
  setCreateProjectOpen,
} from '../store/uiSlice';
import { setActiveProject } from '../store/workSlice';
import {
  Kanban,
  ListFilter,
  Layers,
  Clock,
  Calendar,
  ShieldCheck,
  Users,
  Plus,
  Compass,
  UserCheck,
  UserPlus,
  Radio,
  BarChart2,
  FileCheck2,
  CreditCard,
  Building2,
} from 'lucide-react';

export const SubNavPane: React.FC = () => {
  const dispatch = useAppDispatch();
  const { workspace, activePage, isSidebarCollapsed } = useAppSelector(
    (state) => state.ui
  );
  const { projects, activeProject, kanbanBoard } = useAppSelector((state) => state.work);
  const { companyLeaves, teamRegularizations, myLeaves } = useAppSelector((state) => state.hrms);

  if (isSidebarCollapsed) return null;

  const totalIssuesCount =
    kanbanBoard?.columns.reduce((sum, col) => sum + col.issues.length, 0) || 0;

  const pendingApprovalsCount =
    (companyLeaves || []).filter((l) => l.status === 'pending').length +
    (teamRegularizations || []).filter((r) => r.status === 'pending').length;

  const myPendingLeavesCount = (myLeaves || []).filter((l) => l.status === 'pending').length;

  return (
    <nav
      style={{
        width: '240px',
        background: 'var(--surface-2)',
        borderRight: '1px solid var(--border-hairline)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '16px 12px',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      <div>
        {/* ========================================================================= */}
        {/* DOMAIN 1: EMPLOYEE SELF-SERVICE (ESS)                                    */}
        {/* ========================================================================= */}
        {workspace === 'employee' && (
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '4px 8px 10px',
              }}
            >
              Employee Self-Service
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <button
                className={`sub-nav-item ${activePage === 'hub' ? 'active' : ''}`}
                style={{ width: '100%' }}
                onClick={() => dispatch(navigateToPage('hub'))}
              >
                <Compass size={14} />
                <span>My Workday Hub</span>
              </button>

              <button
                className={`sub-nav-item ${activePage === 'attendance' ? 'active' : ''}`}
                style={{ width: '100%' }}
                onClick={() => dispatch(navigateToPage('attendance'))}
              >
                <Clock size={14} />
                <span>My Attendance & Clock</span>
              </button>

              <button
                className={`sub-nav-item ${activePage === 'leaves' ? 'active' : ''}`}
                style={{ width: '100%', justifyContent: 'space-between' }}
                onClick={() => dispatch(navigateToPage('leaves'))}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={14} />
                  <span>My Leaves & Absence</span>
                </div>
                {myPendingLeavesCount > 0 && (
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: 'var(--accent-amber-subtle)',
                      color: 'var(--accent-amber)',
                      fontWeight: 700,
                    }}
                  >
                    {myPendingLeavesCount}
                  </span>
                )}
              </button>

              <button
                className={`sub-nav-item ${activePage === 'payroll' ? 'active' : ''}`}
                style={{ width: '100%' }}
                onClick={() => dispatch(navigateToPage('payroll'))}
              >
                <CreditCard size={14} />
                <span>My Payroll & Payslips</span>
              </button>

              <button
                className={`sub-nav-item ${activePage === 'profile' ? 'active' : ''}`}
                style={{ width: '100%' }}
                onClick={() => dispatch(navigateToPage('profile'))}
              >
                <UserCheck size={14} />
                <span>My Employee Profile</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DOMAIN 2: MANAGEMENT & OPERATIONS CONSOLE (MSS)                          */}
        {/* ========================================================================= */}
        {workspace === 'management' && (
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '4px 8px 10px',
              }}
            >
              Management Console
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <button
                className={`sub-nav-item ${activePage === 'shifts' ? 'active' : ''}`}
                style={{ width: '100%' }}
                onClick={() => dispatch(navigateToPage('shifts'))}
              >
                <Layers size={14} />
                <span>Shift Catalog & Rostering</span>
              </button>

              <button
                className={`sub-nav-item ${activePage === 'radar' ? 'active' : ''}`}
                style={{ width: '100%' }}
                onClick={() => dispatch(navigateToPage('radar'))}
              >
                <Radio size={14} />
                <span>Live Team Presence Radar</span>
              </button>

              <button
                className={`sub-nav-item ${activePage === 'approvals' ? 'active' : ''}`}
                style={{ width: '100%', justifyContent: 'space-between' }}
                onClick={() => dispatch(navigateToPage('approvals'))}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={14} />
                  <span>Approvals Desk</span>
                </div>
                {pendingApprovalsCount > 0 && (
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: 'var(--accent-amber)',
                      color: '#000',
                      fontWeight: 700,
                    }}
                  >
                    {pendingApprovalsCount}
                  </span>
                )}
              </button>

              <button
                className={`sub-nav-item ${activePage === 'capacity' ? 'active' : ''}`}
                style={{ width: '100%' }}
                onClick={() => dispatch(navigateToPage('capacity'))}
              >
                <BarChart2 size={14} />
                <span>Capacity & Workload</span>
              </button>

              <button
                className={`sub-nav-item ${activePage === 'directory' ? 'active' : ''}`}
                style={{ width: '100%' }}
                onClick={() => dispatch(navigateToPage('directory'))}
              >
                <Users size={14} />
                <span>Organization & Team</span>
              </button>

              <button
                className={`sub-nav-item ${activePage === 'onboarding' ? 'active' : ''}`}
                style={{ width: '100%' }}
                onClick={() => dispatch(navigateToPage('onboarding'))}
              >
                <UserPlus size={14} />
                <span>Onboarding Pipeline</span>
              </button>

              <button
                className={`sub-nav-item ${activePage === 'company_settings' ? 'active' : ''}`}
                style={{ width: '100%' }}
                onClick={() => dispatch(navigateToPage('company_settings'))}
              >
                <Building2 size={14} />
                <span>Company Profile & Setup</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DOMAIN 3: AGILE WORK & PROJECTS                                          */}
        {/* ========================================================================= */}
        {workspace === 'work' && (
          <div>
            {/* Project Selector & Actions */}
            <div style={{ marginBottom: '16px', padding: '0 4px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>Agile Project</span>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '2px 4px', height: 'auto' }}
                  onClick={() => dispatch(setCreateProjectOpen(true))}
                  title="Create Project"
                >
                  <Plus size={13} />
                </button>
              </div>

              <select
                className="select-field"
                style={{ padding: '6px 10px', fontSize: '12px' }}
                value={activeProject?.id || ''}
                onChange={(e) => {
                  const proj = projects.find((p) => p.id === e.target.value);
                  if (proj) dispatch(setActiveProject(proj));
                }}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.key}] {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Navigation Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-dim)',
                  textTransform: 'uppercase',
                  padding: '8px 8px 4px',
                }}
              >
                Views
              </div>

              {/* Kanban Board View */}
              <button
                className={`sub-nav-item ${activePage === 'kanban' ? 'active' : ''}`}
                style={{ width: '100%', justifyContent: 'space-between' }}
                onClick={() => dispatch(navigateToPage('kanban'))}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Kanban size={14} />
                  <span>Kanban Board</span>
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {totalIssuesCount}
                </span>
              </button>

              {/* High-Density List View */}
              <button
                className={`sub-nav-item ${activePage === 'list' ? 'active' : ''}`}
                style={{ width: '100%', justifyContent: 'space-between' }}
                onClick={() => dispatch(navigateToPage('list'))}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ListFilter size={14} />
                  <span>High-Density List</span>
                </div>
                <span className="mono-tag" style={{ color: 'var(--accent-primary)' }}>
                  TAB
                </span>
              </button>

              {/* Sprints & Capacity Backlog */}
              <button
                className={`sub-nav-item ${activePage === 'backlog' ? 'active' : ''}`}
                style={{ width: '100%', justifyContent: 'space-between' }}
                onClick={() => dispatch(navigateToPage('backlog'))}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={14} />
                  <span>Sprints & Backlog</span>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Quick Action */}
      <div style={{ paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
        {workspace === 'employee' ? (
          <button
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            onClick={() => dispatch(navigateToPage('attendance'))}
          >
            <Clock size={13} />
            <span>Biometric Clock</span>
          </button>
        ) : workspace === 'management' ? (
          <button
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            onClick={() => dispatch(navigateToPage('approvals'))}
          >
            <ShieldCheck size={13} />
            <span>Review Approvals ({pendingApprovalsCount})</span>
          </button>
        ) : (
          <button
            className="btn btn-primary btn-sm"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            onClick={() => dispatch(setCreateIssueOpen(true))}
          >
            <Plus size={13} />
            <span>Create Issue (C)</span>
          </button>
        )}
      </div>
    </nav>
  );
};

export default SubNavPane;
