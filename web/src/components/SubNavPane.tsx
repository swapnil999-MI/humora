import { useAppDispatch, useAppSelector, usePulseStore } from '../store/store';
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
  CreditCard,
  Building2,
  MessageSquare,
  Hash,
  Lock,
} from 'lucide-react';

export const SubNavPane: React.FC = () => {
  const dispatch = useAppDispatch();
  const { workspace, activePage, isSidebarCollapsed } = useAppSelector(
    (state) => state.ui
  );
  const { projects, activeProject, kanbanBoard } = useAppSelector((state) => state.work);
  const { companyLeaves, teamRegularizations, myLeaves } = useAppSelector((state) => state.hrms);
  const {
    channels,
    directMessages,
    activeId,
    setActiveConversation,
    setCreateChannelModalOpen,
  } = usePulseStore();

  if (isSidebarCollapsed) return null;

  const totalIssuesCount =
    kanbanBoard?.columns.reduce((sum, col) => sum + col.issues.length, 0) || 0;

  const pendingApprovalsCount =
    (companyLeaves || []).filter((l) => l.status === 'pending').length +
    (teamRegularizations || []).filter((r) => r.status === 'pending').length;

  const myPendingLeavesCount = (myLeaves || []).filter((l) => l.status === 'pending').length;

  return (
    <nav className="sub-nav-pane">
      <div>
        {/* ========================================================================= */}
        {/* DOMAIN 1: EMPLOYEE SELF-SERVICE (ESS)                                    */}
        {/* ========================================================================= */}
        {workspace === 'employee' && (
          <div>
            <div className="sub-nav-header">
              Employee Self-Service
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <button
                type="button"
                className={`sub-nav-item ${activePage === 'hub' ? 'active' : ''}`}
                onClick={() => dispatch(navigateToPage('hub'))}
              >
                <Compass size={15} strokeWidth={1.8} />
                <span>My Workday Hub</span>
              </button>

              <button
                type="button"
                className={`sub-nav-item ${activePage === 'attendance' ? 'active' : ''}`}
                onClick={() => dispatch(navigateToPage('attendance'))}
              >
                <Clock size={15} strokeWidth={1.8} />
                <span>My Attendance & Clock</span>
              </button>

              <button
                type="button"
                className={`sub-nav-item ${activePage === 'leaves' ? 'active' : ''}`}
                style={{ justifyContent: 'space-between' }}
                onClick={() => dispatch(navigateToPage('leaves'))}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Calendar size={15} strokeWidth={1.8} />
                  <span>My Leaves & Absence</span>
                </div>
                {myPendingLeavesCount > 0 && (
                  <span className="nav-badge">
                    {myPendingLeavesCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                className={`sub-nav-item ${activePage === 'payroll' ? 'active' : ''}`}
                onClick={() => dispatch(navigateToPage('payroll'))}
              >
                <CreditCard size={15} strokeWidth={1.8} />
                <span>My Payroll & Payslips</span>
              </button>

              <button
                type="button"
                className={`sub-nav-item ${activePage === 'profile' ? 'active' : ''}`}
                onClick={() => dispatch(navigateToPage('profile'))}
              >
                <UserCheck size={15} strokeWidth={1.8} />
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
            <div className="sub-nav-header">
              Management Console
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <button
                type="button"
                className={`sub-nav-item ${activePage === 'shifts' ? 'active' : ''}`}
                onClick={() => dispatch(navigateToPage('shifts'))}
              >
                <Layers size={15} strokeWidth={1.8} />
                <span>Shift Catalog & Rostering</span>
              </button>

              <button
                type="button"
                className={`sub-nav-item ${activePage === 'radar' ? 'active' : ''}`}
                onClick={() => dispatch(navigateToPage('radar'))}
              >
                <Radio size={15} strokeWidth={1.8} />
                <span>Live Team Presence Radar</span>
              </button>

              <button
                type="button"
                className={`sub-nav-item ${activePage === 'approvals' ? 'active' : ''}`}
                style={{ justifyContent: 'space-between' }}
                onClick={() => dispatch(navigateToPage('approvals'))}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ShieldCheck size={15} strokeWidth={1.8} />
                  <span>Approvals Desk</span>
                </div>
                {pendingApprovalsCount > 0 && (
                  <span className="nav-badge">
                    {pendingApprovalsCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                className={`sub-nav-item ${activePage === 'capacity' ? 'active' : ''}`}
                onClick={() => dispatch(navigateToPage('capacity'))}
              >
                <BarChart2 size={15} strokeWidth={1.8} />
                <span>Capacity & Workload</span>
              </button>

              <button
                type="button"
                className={`sub-nav-item ${activePage === 'directory' ? 'active' : ''}`}
                onClick={() => dispatch(navigateToPage('directory'))}
              >
                <Users size={15} strokeWidth={1.8} />
                <span>Organization & Team</span>
              </button>

              <button
                type="button"
                className={`sub-nav-item ${activePage === 'onboarding' ? 'active' : ''}`}
                onClick={() => dispatch(navigateToPage('onboarding'))}
              >
                <UserPlus size={15} strokeWidth={1.8} />
                <span>Onboarding Pipeline</span>
              </button>

              <button
                type="button"
                className={`sub-nav-item ${activePage === 'company_settings' ? 'active' : ''}`}
                onClick={() => dispatch(navigateToPage('company_settings'))}
              >
                <Building2 size={15} strokeWidth={1.8} />
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
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>Agile Project</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '2px 6px', height: 'auto' }}
                  onClick={() => dispatch(setCreateProjectOpen(true))}
                  title="Create Project"
                >
                  <Plus size={13} strokeWidth={2} />
                </button>
              </div>

              <select
                className="select-field"
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
              <div className="sub-nav-header">
                Views
              </div>

              {/* Kanban Board View */}
              <button
                type="button"
                className={`sub-nav-item ${activePage === 'kanban' ? 'active' : ''}`}
                style={{ justifyContent: 'space-between' }}
                onClick={() => dispatch(navigateToPage('kanban'))}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Kanban size={15} strokeWidth={1.8} />
                  <span>Kanban Board</span>
                </div>
                <span className="nav-badge">
                  {totalIssuesCount}
                </span>
              </button>

              {/* High-Density List View */}
              <button
                type="button"
                className={`sub-nav-item ${activePage === 'list' ? 'active' : ''}`}
                style={{ justifyContent: 'space-between' }}
                onClick={() => dispatch(navigateToPage('list'))}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ListFilter size={15} strokeWidth={1.8} />
                  <span>High-Density List</span>
                </div>
                <span className="mono-tag">
                  TAB
                </span>
              </button>

              {/* Sprints & Capacity Backlog */}
              <button
                type="button"
                className={`sub-nav-item ${activePage === 'backlog' ? 'active' : ''}`}
                style={{ justifyContent: 'space-between' }}
                onClick={() => dispatch(navigateToPage('backlog'))}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Layers size={15} strokeWidth={1.8} />
                  <span>Sprints & Backlog</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DOMAIN 4: TEAM PULSE (CHAT & COLLABORATION)                              */}
        {/* ========================================================================= */}
        {workspace === 'pulse' && (
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>Team Pulse</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding: '2px 6px', height: 'auto' }}
                onClick={() => setCreateChannelModalOpen(true)}
                title="Create Group"
              >
                <Plus size={13} strokeWidth={2} />
              </button>
            </div>

            {/* Groups List */}
            <div style={{ marginBottom: '14px' }}>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '4px 8px',
                }}
              >
                Groups
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {channels.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`sub-nav-item ${activeId === c.id ? 'active' : ''}`}
                    style={{ justifyContent: 'space-between' }}
                    onClick={() => {
                      setActiveConversation(c.id, 'channel');
                      dispatch(navigateToPage('pulse'));
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      {c.isPrivate ? <Lock size={13} strokeWidth={1.8} /> : <Hash size={13} strokeWidth={1.8} />}
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {c.name}
                      </span>
                    </div>
                    {c.unreadCount > 0 && (
                      <span className="nav-badge">{c.unreadCount}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Direct Messages List */}
            <div>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '4px 8px',
                }}
              >
                Direct Messages
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {directMessages.map((dm) => (
                  <button
                    key={dm.id}
                    type="button"
                    className={`sub-nav-item ${activeId === dm.id ? 'active' : ''}`}
                    style={{ justifyContent: 'space-between' }}
                    onClick={() => {
                      setActiveConversation(dm.id, 'dm');
                      dispatch(navigateToPage('pulse'));
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <span
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          background:
                            dm.status === 'online'
                              ? 'var(--accent-primary)'
                              : dm.status === 'away'
                              ? 'var(--accent-warning, #f59e0b)'
                              : 'var(--text-muted)',
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {dm.name}
                      </span>
                    </div>
                    {dm.unreadCount > 0 && (
                      <span className="nav-badge">{dm.unreadCount}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Quick Action */}
      <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-hairline)' }}>
        {workspace === 'employee' ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', gap: '6px' }}
            onClick={() => dispatch(navigateToPage('attendance'))}
          >
            <Clock size={13} strokeWidth={1.8} />
            <span>Biometric Clock</span>
          </button>
        ) : workspace === 'management' ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', gap: '6px' }}
            onClick={() => dispatch(navigateToPage('approvals'))}
          >
            <ShieldCheck size={13} strokeWidth={1.8} />
            <span>Review Approvals ({pendingApprovalsCount})</span>
          </button>
        ) : workspace === 'pulse' ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ width: '100%', gap: '6px' }}
            onClick={() => setCreateChannelModalOpen(true)}
          >
            <Plus size={13} strokeWidth={2} />
            <span>New Group</span>
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ width: '100%', gap: '6px' }}
            onClick={() => dispatch(setCreateIssueOpen(true))}
          >
            <Plus size={13} strokeWidth={2} />
            <span>Create Issue (C)</span>
          </button>
        )}
      </div>
    </nav>
  );
};

export default SubNavPane;
