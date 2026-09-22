import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/store';
import {
  fetchBacklog,
  createSprint,
  updateSprintStatus,
  setActiveIssue,
} from '../../store/workSlice';
import { setCreateIssueOpen, addToast } from '../../store/uiSlice';
import confetti from 'canvas-confetti';
import {
  Zap,
  Play,
  CheckCircle,
  Plus,
  Calendar,
  Layers,
  Clock,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  UserCheck,
  Users,
  AlertCircle,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  CalendarOff,
} from 'lucide-react';
import { fetchSprintCapacity } from '../../store/fusionSlice';

export const BacklogView: React.FC = () => {
  const dispatch = useAppDispatch();
  const { activeProject, backlog } = useAppSelector((state) => state.work);
  const { sprintCapacity, isLoadingSprintCapacity } = useAppSelector((state) => state.fusion);

  const [isSprintModalOpen, setIsSprintModalOpen] = useState(false);
  const [sprintName, setSprintName] = useState('');
  const [sprintGoal, setSprintGoal] = useState('');
  const [showEngineerBreakdown, setShowEngineerBreakdown] = useState(false);

  useEffect(() => {
    if (activeProject?.id) {
      dispatch(fetchBacklog(activeProject.id));
    }
  }, [dispatch, activeProject?.id]);

  useEffect(() => {
    if (backlog?.active_sprint?.sprint.id) {
      dispatch(fetchSprintCapacity(backlog.active_sprint.sprint.id));
    }
  }, [dispatch, backlog?.active_sprint?.sprint.id]);

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !sprintName) return;

    try {
      await dispatch(
        createSprint({
          projectId: activeProject.id,
          name: sprintName,
          goal: sprintGoal,
        })
      ).unwrap();
      dispatch(addToast({ type: 'success', message: 'Sprint created successfully!' }));
      setIsSprintModalOpen(false);
      setSprintName('');
      setSprintGoal('');
    } catch (err: any) {
      dispatch(addToast({ type: 'error', message: err || 'Failed to create sprint' }));
    }
  };

  const handleCompleteSprint = (sprintId: string) => {
    if (!activeProject) return;
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
    });
    dispatch(
      updateSprintStatus({
        sprintId,
        status: 'closed',
        projectId: activeProject.id,
      })
    );
    dispatch(addToast({ type: 'success', message: 'Sprint completed! Velocity recorded.' }));
  };

  const handleStartSprint = (sprintId: string) => {
    if (!activeProject) return;
    dispatch(
      updateSprintStatus({
        sprintId,
        status: 'active',
        projectId: activeProject.id,
      })
    );
    dispatch(addToast({ type: 'success', message: 'Sprint started!' }));
  };

  if (!activeProject) {
    return (
      <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-muted)' }}>
        Please select a project to view the backlog.
      </div>
    );
  }

  // Capacity metrics derived from live synergy engine
  const grossHours = sprintCapacity?.gross_capacity_hours ?? 160;
  const leaveDeductionHours = sprintCapacity?.leave_hours_deducted ?? 0;
  const netHours = sprintCapacity?.net_capacity_hours ?? 160;
  const committedHours = sprintCapacity?.committed_hours ?? (backlog?.active_sprint?.total_story_points ? backlog.active_sprint.total_story_points * 6 : 0);
  const committedPoints = sprintCapacity?.committed_points ?? (backlog?.active_sprint?.total_story_points || 0);
  const utilizationPct = sprintCapacity?.capacity_utilization_pct ?? Math.round((committedHours / (netHours || 1)) * 100);
  const isOvercommitted = sprintCapacity?.overcommitted || (committedHours > netHours);
  const engineers = sprintCapacity?.engineers || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700 }}>
            {activeProject.name} &bull; Sprints & Capacity Planning
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Leave-aware dynamic sprint velocity &bull; Reconciling HRMS approved PTO against agile engineering commitments
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-secondary"
            onClick={() => setIsSprintModalOpen(true)}
          >
            <Plus size={14} />
            Create Sprint
          </button>
          <button
            className="btn btn-primary"
            onClick={() => dispatch(setCreateIssueOpen(true))}
          >
            <Plus size={14} />
            Create Issue
          </button>
        </div>
      </div>

      {/* Engine 1: Leave-Aware Dynamic Sprint Capacity Synergy Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '20px 24px',
          background: isOvercommitted
            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(13, 15, 23, 0.95) 100%)'
            : 'linear-gradient(135deg, rgba(24, 28, 45, 0.8) 0%, rgba(13, 15, 23, 0.9) 100%)',
          border: isOvercommitted
            ? '1px solid rgba(239, 68, 68, 0.35)'
            : '1px solid rgba(99, 102, 241, 0.3)',
          boxShadow: isOvercommitted
            ? '0 0 25px rgba(239, 68, 68, 0.15)'
            : '0 0 20px rgba(99, 102, 241, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                padding: '8px',
                borderRadius: '10px',
                background: 'var(--surface-3)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-hairline)',
              }}
            >
              {isOvercommitted ? <ShieldAlert size={18} /> : <TrendingUp size={18} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '15px' }}>
                  Leave-Aware Dynamic Sprint Capacity
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontWeight: 600,
                    background: 'var(--surface-3)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {isOvercommitted ? 'Overcommitted Deficit' : 'Capacity Balanced'}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Automatically calculated by deducting approved HRMS leave days from sprint working calendar
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '13px' }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Gross Capacity</span>
              <strong>{grossHours}h</strong>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Approved PTO</span>
              <strong style={{ color: 'var(--text-primary)' }}>
                -{leaveDeductionHours}h
              </strong>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Net Available</span>
              <strong style={{ color: 'var(--text-primary)' }}>{netHours}h</strong>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Committed</span>
              <strong style={{ color: 'var(--text-primary)' }}>
                {committedHours}h ({committedPoints} pts)
              </strong>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Utilization</span>
              <strong style={{ color: 'var(--text-primary)' }}>
                {utilizationPct}%
              </strong>
            </div>
            {engineers.length > 0 && (
              <button
                className="btn btn-secondary btn-sm"
                style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setShowEngineerBreakdown(!showEngineerBreakdown)}
              >
                <Users size={13} />
                <span>Squad Breakdown</span>
                {showEngineerBreakdown ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            )}
          </div>
        </div>

        {/* Visual Capacity Utilization Bar */}
        <div
          style={{
            height: '8px',
            borderRadius: '9999px',
            background: 'rgba(255, 255, 255, 0.08)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, utilizationPct)}%`,
              background: 'var(--text-primary)',
              transition: 'width 0.5s ease',
            }}
          />
        </div>

        {/* Alert message if overcommitted */}
        {sprintCapacity?.alert_message && (
          <div
            style={{
              marginTop: '12px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'var(--surface-3)',
              border: '1px solid var(--border-strong)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '12px',
              color: 'var(--text-primary)',
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0, color: 'var(--text-primary)' }} />
            <span>{sprintCapacity.alert_message}</span>
          </div>
        )}

        {/* Expandable Engineer Breakdown */}
        {showEngineerBreakdown && engineers.length > 0 && (
          <div
            style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '12px',
            }}
          >
            {engineers.map((eng) => (
              <div
                key={eng.employee_id}
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: eng.has_conflict ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${eng.has_conflict ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {eng.avatar_url ? (
                      <img
                        src={eng.avatar_url}
                        alt={eng.employee_name}
                        style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          background: 'rgba(99, 102, 241, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                      >
                        {eng.employee_name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{eng.employee_name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{eng.designation_title}</div>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'var(--surface-3)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle)',
                      fontWeight: 600,
                    }}
                  >
                    {eng.has_conflict ? 'Conflict' : 'Available'}
                  </span>
                </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border-hairline)',
                    }}
                  >
                    <div>Net Bandwidth: <strong style={{ color: 'var(--text-primary)' }}>{eng.net_capacity_hours}h</strong></div>
                    <div>Committed: <strong style={{ color: 'var(--text-primary)' }}>{eng.committed_hours}h ({eng.committed_points}p)</strong></div>
                    {eng.approved_leave_days > 0 && (
                      <div style={{ color: 'var(--text-secondary)' }}>PTO: {eng.approved_leave_days}d</div>
                    )}
                  </div>

                  {eng.has_conflict && eng.conflict_reason && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      &bull; {eng.conflict_reason}
                    </div>
                  )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Sprint Section */}
      {backlog?.active_sprint && (
        <div
          style={{
            padding: '20px 24px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="badge badge-in-progress">Active Sprint</span>
              <h2 style={{ fontSize: '16px', fontWeight: 600 }}>
                {backlog.active_sprint.sprint.name}
              </h2>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                ({backlog.active_sprint.issues.length} issues &bull;{' '}
                {backlog.active_sprint.total_story_points} points)
              </span>
            </div>

            <button
              className="btn btn-success btn-sm"
              onClick={() => handleCompleteSprint(backlog.active_sprint!.sprint.id)}
            >
              <CheckCircle size={14} />
              Complete Sprint
            </button>
          </div>

          {backlog.active_sprint.sprint.goal && (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              <strong>Sprint Goal:</strong> {backlog.active_sprint.sprint.goal}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {backlog.active_sprint.issues.map((iss) => (
              <IssueRow key={iss.id} issue={iss} />
            ))}
          </div>
        </div>
      )}

      {/* Future Sprints */}
      {backlog?.future_sprints && backlog.future_sprints.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {backlog.future_sprints.map((bucket) => (
            <div key={bucket.sprint.id} className="glass-panel" style={{ padding: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="badge badge-todo">Planned</span>
                  <h3 style={{ fontSize: '15px', fontWeight: 600 }}>{bucket.sprint.name}</h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    ({bucket.issues.length} issues &bull; {bucket.total_story_points} points)
                  </span>
                </div>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleStartSprint(bucket.sprint.id)}
                >
                  <Play size={14} />
                  Start Sprint
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {bucket.issues.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '12px' }}>
                    Plan this sprint by dragging or assigning issues from the backlog below.
                  </div>
                ) : (
                  bucket.issues.map((iss) => <IssueRow key={iss.id} issue={iss} />)
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Unassigned Backlog Pool */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Backlog Pool</h2>
            <span
              style={{
                fontSize: '12px',
                padding: '2px 8px',
                borderRadius: '9999px',
                background: 'rgba(255, 255, 255, 0.08)',
                color: 'var(--text-secondary)',
              }}
            >
              {backlog?.backlog_issues.length || 0} issues &bull;{' '}
              {backlog?.total_backlog_points || 0} story points
            </span>
          </div>
        </div>

        {backlog?.backlog_issues.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
            All backlog items have been scheduled into active or future sprints!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {backlog?.backlog_issues.map((iss) => (
              <IssueRow key={iss.id} issue={iss} />
            ))}
          </div>
        )}
      </div>

      {/* Create Sprint Modal */}
      {isSprintModalOpen && (
        <div className="modal-overlay" onClick={() => setIsSprintModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
              Create Sprint
            </h2>
            <form onSubmit={handleCreateSprint}>
              <div className="input-group">
                <label className="input-label">Sprint Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={sprintName}
                  onChange={(e) => setSprintName(e.target.value)}
                  placeholder="e.g. Sprint 2: Platform Hardening"
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Sprint Goal</label>
                <textarea
                  className="textarea-field"
                  rows={3}
                  value={sprintGoal}
                  onChange={(e) => setSprintGoal(e.target.value)}
                  placeholder="What is the objective of this sprint iteration?"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsSprintModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Sprint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const IssueRow: React.FC<{ issue: any }> = ({ issue }) => {
  const dispatch = useAppDispatch();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderRadius: 'var(--radius-md)',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid var(--border-subtle)',
        cursor: 'pointer',
        transition: 'all var(--transition-fast)',
      }}
      onClick={() => dispatch(setActiveIssue(issue))}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
        e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span
          className="mono-tag"
          style={{
            fontWeight: 700,
            color: 'var(--accent-primary)',
            minWidth: '65px',
          }}
        >
          {issue.issue_key}
        </span>
        <span style={{ fontWeight: 500, fontSize: '13px' }}>{issue.title}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span className={`badge badge-priority-${issue.priority}`}>{issue.priority}</span>
        <span className="badge badge-in-progress">{issue.status_name || 'To Do'}</span>
        {issue.story_points !== undefined && issue.story_points !== null && (
          <span
            style={{
              padding: '2px 7px',
              borderRadius: '9999px',
              background: 'var(--surface-hover)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-hairline)',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            {issue.story_points} pts
          </span>
        )}
      </div>
    </div>
  );
};
