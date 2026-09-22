import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/store';
import {
  fetchTeamCapacity,
  reassignIssue,
  fetchTeamTimesheets,
  reviewWeeklyTimesheet,
  fetchCostAnalysis,
  fetchBurnoutSentinel,
} from '../../store/fusionSlice';
import { addToast } from '../../store/uiSlice';
import {
  Users,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRightLeft,
  Sparkles,
  TrendingUp,
  Search,
  Check,
  X,
  FileCheck2,
  DollarSign,
  Activity,
  ShieldCheck,
  Clock,
  HeartHandshake,
  AlertOctagon,
  Flame,
  ThumbsUp,
  ThumbsDown,
  BarChart3,
  CheckCircle,
} from 'lucide-react';
import { TeamMemberCapacity } from '../../types';

export const TeamCapacityDesk: React.FC = () => {
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState<'workload' | 'timesheets' | 'cost' | 'sentinel'>('workload');

  const {
    teamCapacity,
    isLoadingTeam,
    isReassigning,
    teamTimesheets,
    isLoadingTeamTimesheets,
    isReviewingTimesheet,
    costAnalysis,
    isLoadingCost,
    burnoutSentinel,
    isLoadingSentinel,
  } = useAppSelector((state) => state.fusion);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterPresence, setFilterPresence] = useState<'all' | 'in_office' | 'on_leave' | 'overloaded'>('all');
  const [reassignModalTarget, setReassignModalTarget] = useState<TeamMemberCapacity | null>(null);
  const [selectedTargetEmployeeId, setSelectedTargetEmployeeId] = useState<string>('');

  // Timesheet review dialog state
  const [reviewingSubmissionId, setReviewingSubmissionId] = useState<string | null>(null);
  const [reviewerComment, setReviewerComment] = useState<string>('');

  useEffect(() => {
    dispatch(fetchTeamCapacity());
    dispatch(fetchTeamTimesheets());
    dispatch(fetchCostAnalysis());
    dispatch(fetchBurnoutSentinel());
  }, [dispatch]);

  const members = teamCapacity?.members || [];

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      (m.employee_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.department_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.employee_code || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterPresence === 'in_office') return m.presence_status === 'in_office';
    if (filterPresence === 'on_leave') return m.presence_status === 'on_leave';
    if (filterPresence === 'overloaded') return m.capacity_status === 'overloaded';

    return true;
  });

  const handleExecuteReassign = async () => {
    if (!reassignModalTarget || !reassignModalTarget.current_focus_issue || !selectedTargetEmployeeId) {
      return;
    }

    try {
      await dispatch(
        reassignIssue({
          issueId: reassignModalTarget.current_focus_issue,
          targetAssigneeId: selectedTargetEmployeeId,
        })
      ).unwrap();

      dispatch(
        addToast({
          type: 'success',
          message: `Ticket ${reassignModalTarget.current_focus_issue} successfully reassigned`,
        })
      );
      setReassignModalTarget(null);
      setSelectedTargetEmployeeId('');
    } catch (err: any) {
      dispatch(
        addToast({
          type: 'error',
          message: err || 'Failed to reassign issue',
        })
      );
    }
  };

  const handleReviewTimesheet = async (subId: string, status: 'approved' | 'rejected') => {
    try {
      await dispatch(
        reviewWeeklyTimesheet(subId, {
          status,
          reviewer_comments: reviewerComment || (status === 'approved' ? 'Approved by manager.' : 'Returned for adjustment.'),
        })
      ).unwrap();
      dispatch(addToast({ type: 'success', message: `Timesheet marked as ${status}!` }));
      setReviewingSubmissionId(null);
      setReviewerComment('');
    } catch (err: any) {
      dispatch(addToast({ type: 'error', message: err || 'Failed to review timesheet' }));
    }
  };

  return (
    <div
      style={{
        padding: '24px 32px',
        maxWidth: '1360px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      {/* Header & Copilot Title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '20px',
          borderBottom: '1px solid var(--border-hairline)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--accent-primary)',
                background: 'var(--accent-primary-subtle)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              Enterprise Synergy Suite
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Cross-Domain People Operations × Agile Engineering Control Center
            </span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Synergy Command Desk
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Live orchestration of workforce capacity, weekly timesheet sign-offs, financial feature costing, and engineer burnout prevention.
          </p>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            dispatch(fetchTeamCapacity());
            dispatch(fetchTeamTimesheets());
            dispatch(fetchCostAnalysis());
            dispatch(fetchBurnoutSentinel());
          }}
          disabled={isLoadingTeam || isLoadingTeamTimesheets || isLoadingCost || isLoadingSentinel}
        >
          <Sparkles size={13} color="var(--accent-primary)" />
          <span>Refresh Synergy Data</span>
        </button>
      </div>

      {/* Navigation Tabs Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '4px',
        }}
      >
        <button
          className={`btn btn-sm ${activeTab === 'workload' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
          onClick={() => setActiveTab('workload')}
        >
          <Users size={15} />
          <span>Real-Time Workload</span>
          <span
            style={{
              fontSize: '11px',
              padding: '1px 6px',
              borderRadius: '10px',
              background: activeTab === 'workload' ? 'rgba(255, 255, 255, 0.2)' : 'var(--surface-3)',
            }}
          >
            {members.length}
          </span>
        </button>

        <button
          className={`btn btn-sm ${activeTab === 'timesheets' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
          onClick={() => setActiveTab('timesheets')}
        >
          <FileCheck2 size={15} />
          <span>Timesheet Approvals</span>
          {teamTimesheets.filter((t) => t.submission_status === 'submitted').length > 0 && (
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '10px',
                background: '#f59e0b',
                color: '#000',
                fontWeight: 700,
              }}
            >
              {teamTimesheets.filter((t) => t.submission_status === 'submitted').length}
            </span>
          )}
        </button>

        <button
          className={`btn btn-sm ${activeTab === 'cost' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
          onClick={() => setActiveTab('cost')}
        >
          <DollarSign size={15} />
          <span>Feature & Epic Cost Engine</span>
        </button>

        <button
          className={`btn btn-sm ${activeTab === 'sentinel' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
          onClick={() => setActiveTab('sentinel')}
        >
          <Flame size={15} color={burnoutSentinel?.overall_tier === 'high_risk' ? '#ef4444' : '#f59e0b'} />
          <span>Burnout Sentinel</span>
          {burnoutSentinel && (
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '10px',
                background:
                  burnoutSentinel.overall_tier === 'high_risk'
                    ? 'rgba(239, 68, 68, 0.3)'
                    : 'rgba(16, 185, 129, 0.2)',
                color: burnoutSentinel.overall_tier === 'high_risk' ? '#f87171' : '#34d399',
                fontWeight: 600,
              }}
            >
              {burnoutSentinel.team_burnout_index}/100
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: WORKLOAD & PRESENCE MATRIX */}
      {/* ========================================================================= */}
      {activeTab === 'workload' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 4 Summary Metric Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
            }}
          >
            {/* Total Engineers */}
            <div className="glass-panel" style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Engineers</span>
                <Users size={16} color="var(--text-muted)" />
              </div>
              <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '6px' }}>
                {teamCapacity?.total_engineers || 0}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Cross-department workforce
              </div>
            </div>

            {/* Present Today */}
            <div className="glass-panel" style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Clocked In & Present</span>
                <CheckCircle2 size={16} color="var(--accent-emerald)" />
              </div>
              <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--accent-emerald)', marginTop: '6px' }}>
                {teamCapacity?.clocked_in_count || 0}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Active workday shifts
              </div>
            </div>

            {/* On Leave */}
            <div className="glass-panel" style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>On Leave Today</span>
                <Calendar size={16} color="var(--accent-amber)" />
              </div>
              <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--accent-amber)', marginTop: '6px' }}>
                {teamCapacity?.on_leave_count || 0}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Approved absence records
              </div>
            </div>

            {/* Overloaded Members */}
            <div className="glass-panel" style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sprint Load Risk (&gt;15 pts)</span>
                <AlertTriangle size={16} color="var(--accent-crimson)" />
              </div>
              <div style={{ fontSize: '24px', fontWeight: 600, color: (teamCapacity?.overallocated_count || 0) > 0 ? 'var(--accent-crimson)' : 'var(--accent-emerald)', marginTop: '6px' }}>
                {teamCapacity?.overallocated_count || 0}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {(teamCapacity?.overallocated_count || 0) > 0 ? 'Workload rebalance advised' : 'Capacity well-balanced'}
              </div>
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className={`btn btn-sm ${filterPresence === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterPresence('all')}
              >
                All Members ({members.length})
              </button>
              <button
                className={`btn btn-sm ${filterPresence === 'in_office' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterPresence('in_office')}
              >
                In Office ({teamCapacity?.clocked_in_count || 0})
              </button>
              <button
                className={`btn btn-sm ${filterPresence === 'on_leave' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterPresence('on_leave')}
              >
                On Leave ({teamCapacity?.on_leave_count || 0})
              </button>
              <button
                className={`btn btn-sm ${filterPresence === 'overloaded' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterPresence('overloaded')}
              >
                Overloaded ({teamCapacity?.overallocated_count || 0})
              </button>
            </div>

            <div style={{ position: 'relative', width: '280px' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                className="input-field"
                style={{ paddingLeft: '32px', fontSize: '12px', width: '100%' }}
                placeholder="Search by name, department, code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Team Capacity Matrix Table */}
          <div className="glass-panel" style={{ overflow: 'hidden', padding: 0 }}>
            <table className="table-high-density" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-hairline)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 18px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    TEAM MEMBER
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    DEPARTMENT & ROLE
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    LIVE PRESENCE
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    SPRINT POINTS LOAD
                  </th>
                  <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    CURRENT FOCUS ISSUE
                  </th>
                  <th style={{ textAlign: 'right', padding: '12px 18px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    COPILOT ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => {
                  const pts = member.total_story_points;
                  const maxPts = 20;
                  const loadPercent = Math.min(100, Math.round((pts / maxPts) * 100));
                  const isOverloaded = member.capacity_status === 'overloaded';

                  return (
                    <tr
                      key={member.employee_id}
                      style={{
                        borderBottom: '1px solid var(--border-hairline)',
                        background: isOverloaded ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: 'var(--surface-3)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 600,
                              fontSize: '12px',
                              color: 'var(--text-primary)',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            {member.employee_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {member.employee_name}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {member.employee_code}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                          {member.designation_title || 'Software Engineer'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {member.department_name || 'Engineering'}
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '3px 9px',
                            borderRadius: '12px',
                            background:
                              member.presence_status === 'in_office'
                                ? 'rgba(16, 185, 129, 0.15)'
                                : member.presence_status === 'on_leave'
                                ? 'rgba(245, 158, 11, 0.15)'
                                : 'rgba(255, 255, 255, 0.05)',
                            color:
                              member.presence_status === 'in_office'
                                ? '#34d399'
                                : member.presence_status === 'on_leave'
                                ? '#fbbf24'
                                : 'var(--text-muted)',
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: 'currentColor',
                            }}
                          />
                          {member.presence_status === 'in_office'
                            ? 'In Office'
                            : member.presence_status === 'on_leave'
                            ? 'On Leave'
                            : 'Away / Offline'}
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px', width: '180px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: isOverloaded ? 'var(--accent-crimson)' : 'var(--text-primary)' }}>
                            {pts} pts ({member.assigned_issue_count} issues)
                          </span>
                          {isOverloaded && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: '3px',
                                background: 'rgba(239, 68, 68, 0.2)',
                                color: '#f87171',
                              }}
                            >
                              OVERLOADED
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            height: '6px',
                            width: '100%',
                            background: 'var(--surface-3)',
                            borderRadius: '3px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${loadPercent}%`,
                              background: isOverloaded ? '#ef4444' : 'var(--accent-primary)',
                              borderRadius: '3px',
                            }}
                          />
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px', maxWidth: '240px' }}>
                        {member.current_focus_issue ? (
                          <div>
                            <span className="issue-key" style={{ fontSize: '11px', fontWeight: 600, marginRight: '6px' }}>
                              {member.current_focus_issue}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No active sprint task</span>
                        )}
                      </td>

                      <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                        {member.current_focus_issue ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '11px', gap: '4px', padding: '3px 8px' }}
                            onClick={() => {
                              setReassignModalTarget(member);
                              setSelectedTargetEmployeeId('');
                            }}
                          >
                            <ArrowRightLeft size={12} />
                            Rebalance
                          </button>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TIMESHEET APPROVALS (Engine 2) */}
      {/* ========================================================================= */}
      {activeTab === 'timesheets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 600, margin: 0 }}>
                Squad Timesheet Submissions & Sign-Off
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                Review reconciled weekly attendance punches against Jira/Linear task worklogs with manager sign-off authority.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', alignSelf: 'center' }}>
                {teamTimesheets.length} Weekly Submissions Recorded
              </span>
            </div>
          </div>

          {teamTimesheets.length === 0 ? (
            <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No timesheets submitted for approval yet. Team members can submit from My Workday Hub.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '16px' }}>
              {teamTimesheets.map((ts) => {
                const isPending = ts.submission_status === 'submitted';
                const isApproved = ts.submission_status === 'approved';
                const isRejected = ts.submission_status === 'rejected';

                return (
                  <div
                    key={ts.submission_id || `${ts.employee_id}-${ts.week_start_date}`}
                    className="glass-panel"
                    style={{
                      padding: '20px',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      border: isPending
                        ? '1px solid rgba(245, 158, 11, 0.35)'
                        : isApproved
                        ? '1px solid rgba(16, 185, 129, 0.3)'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: 'rgba(99, 102, 241, 0.2)',
                            color: '#818cf8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '14px',
                          }}
                        >
                          {ts.employee_name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600 }}>{ts.employee_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Week: {ts.week_start_date} &rarr; {ts.week_end_date}
                          </div>
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: '12px',
                          textTransform: 'uppercase',
                          background: isApproved
                            ? 'rgba(16, 185, 129, 0.2)'
                            : isPending
                            ? 'rgba(245, 158, 11, 0.2)'
                            : isRejected
                            ? 'rgba(239, 68, 68, 0.2)'
                            : 'rgba(255, 255, 255, 0.08)',
                          color: isApproved ? '#34d399' : isPending ? '#fbbf24' : isRejected ? '#f87171' : 'var(--text-muted)',
                        }}
                      >
                        {ts.submission_status}
                      </span>
                    </div>

                    {/* Metrics Grid */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '8px',
                        padding: '10px 12px',
                        background: 'rgba(0, 0, 0, 0.25)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>Clocked</span>
                        <strong>{ts.total_clocked_hours}h</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>Logged</span>
                        <strong style={{ color: '#818cf8' }}>{ts.total_logged_hours}h</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>Variance</span>
                        <strong style={{ color: ts.variance_hours > 0 ? '#f59e0b' : '#34d399' }}>
                          {ts.variance_hours > 0 ? `+${ts.variance_hours}h` : `${ts.variance_hours}h`}
                        </strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>Sync Fidelity</span>
                        <strong style={{ color: ts.sync_percentage >= 80 ? 'var(--accent-primary)' : 'var(--accent-amber)' }}>
                          {ts.sync_percentage}%
                        </strong>
                      </div>
                    </div>

                    {/* Review Comments / Audit trail */}
                    {ts.reviewed_by && (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '6px 10px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Reviewed by: </span>
                        <strong>{ts.reviewed_by}</strong>
                        {ts.reviewer_comments && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontStyle: 'italic' }}>
                            "{ts.reviewer_comments}"
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action buttons if submitted or can be re-reviewed */}
                    {ts.submission_id && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                        {reviewingSubmissionId === ts.submission_id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                            <input
                              type="text"
                              placeholder="Reviewer feedback / approval comment..."
                              value={reviewerComment}
                              onChange={(e) => setReviewerComment(e.target.value)}
                              className="input-field"
                              style={{ fontSize: '12px', padding: '6px 10px' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setReviewingSubmissionId(null)}
                              >
                                Cancel
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                disabled={isReviewingTimesheet}
                                onClick={() => handleReviewTimesheet(ts.submission_id!, 'rejected')}
                              >
                                <ThumbsDown size={12} />
                                Reject
                              </button>
                              <button
                                className="btn btn-primary btn-sm"
                                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                disabled={isReviewingTimesheet}
                                onClick={() => handleReviewTimesheet(ts.submission_id!, 'approved')}
                              >
                                <ThumbsUp size={12} />
                                Approve
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
                            onClick={() => {
                              setReviewingSubmissionId(ts.submission_id!);
                              setReviewerComment('');
                            }}
                          >
                            <ShieldCheck size={14} color="#818cf8" />
                            {isPending ? 'Review & Decide' : 'Update Review'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: FEATURE & EPIC COST ENGINE (Engine 3) */}
      {/* ========================================================================= */}
      {activeTab === 'cost' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 600, margin: 0 }}>
              Real-Time Feature & Epic Cost Engine
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '3px' }}>
              Multiplies ticket worklogs by employee hourly cost rates to project true R&D spend and budget burn.
            </p>
          </div>

          {costAnalysis.map((proj) => (
            <div
              key={proj.project_id}
              className="glass-panel"
              style={{
                padding: '24px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              {/* Project Financial Summary Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: '16px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      padding: '10px',
                      borderRadius: '10px',
                      background: 'rgba(99, 102, 241, 0.2)',
                      color: '#818cf8',
                    }}
                  >
                    <BarChart3 size={22} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>
                      {proj.project_name} ({proj.project_key})
                    </h3>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Total Tracked Epics: {proj.total_epics}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '24px', fontSize: '13px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Estimated Budget</span>
                    <strong style={{ fontSize: '16px', color: '#fff' }}>
                      ${proj.total_estimated_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Actual Incurred R&D</span>
                    <strong style={{ fontSize: '16px', color: '#818cf8' }}>
                      ${proj.total_incurred_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Epics Breakdown */}
              {proj.epics && proj.epics.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {proj.epics.map((epic) => (
                    <div
                      key={epic.epic_id}
                      style={{
                        padding: '16px 18px',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: `1px solid ${epic.is_over_budget ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#818cf8', marginRight: '8px' }}>
                            {epic.epic_key}
                          </span>
                          <span style={{ fontSize: '14px', fontWeight: 600 }}>{epic.epic_title}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px' }}>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Budget: </span>
                            <strong>${epic.budget_cost.toLocaleString()}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Spend: </span>
                            <strong style={{ color: epic.is_over_budget ? '#ef4444' : '#34d399' }}>
                              ${epic.actual_cost.toLocaleString()}
                            </strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Burn: </span>
                            <strong style={{ color: epic.is_over_budget ? '#ef4444' : '#818cf8' }}>
                              {epic.budget_burn_pct}%
                            </strong>
                          </div>
                        </div>
                      </div>

                      {/* Burn Bar */}
                      <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(100, epic.budget_burn_pct)}%`,
                            background: epic.is_over_budget ? '#ef4444' : 'var(--accent-gradient)',
                          }}
                        />
                      </div>

                      {/* Contributors */}
                      {epic.contributors && epic.contributors.length > 0 && (
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
                          {epic.contributors.map((c) => (
                            <div
                              key={c.employee_id}
                              style={{
                                fontSize: '11px',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                background: 'rgba(0, 0, 0, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              <span>{c.employee_name} ({c.logged_hours}h @ ${c.hourly_rate}/h):</span>
                              <strong style={{ color: '#34d399' }}>${c.incurred_cost.toFixed(2)}</strong>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No standalone epics created yet for this project. As epics and child tickets log hours, real-time financial burn will calculate here automatically.
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: DEVELOPER WELL-BEING & BURNOUT SENTINEL (Engine 4) */}
      {/* ========================================================================= */}
      {activeTab === 'sentinel' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 600, margin: 0 }}>
              Developer Well-Being & Burnout Sentinel
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '3px' }}>
              Multi-signal fatigue detection correlating late biometric checkouts, weekend tickets, active sprint points, and time since last leave.
            </p>
          </div>

          {/* Team Burnout Index Gauge & Recommendations */}
          {burnoutSentinel && (
            <div
              className="glass-panel"
              style={{
                padding: '24px',
                borderRadius: 'var(--radius-md)',
                background:
                  burnoutSentinel.overall_tier === 'high_risk'
                    ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(13, 15, 23, 0.95) 100%)'
                    : 'linear-gradient(135deg, rgba(20, 24, 39, 0.9) 0%, rgba(13, 15, 23, 0.95) 100%)',
                border:
                  burnoutSentinel.overall_tier === 'high_risk'
                    ? '1px solid rgba(239, 68, 68, 0.4)'
                    : '1px solid rgba(99, 102, 241, 0.3)',
                display: 'grid',
                gridTemplateColumns: '1.2fr 2fr',
                gap: '24px',
              }}
            >
              {/* Dial / Index */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Team Fatigue Sentinel Index
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '6px' }}>
                  <span style={{ fontSize: '44px', fontWeight: 800, color: burnoutSentinel.overall_tier === 'high_risk' ? '#ef4444' : 'var(--accent-primary)' }}>
                    {burnoutSentinel.team_burnout_index}
                  </span>
                  <span style={{ fontSize: '16px', color: 'var(--text-muted)' }}>/ 100</span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: '12px',
                      textTransform: 'uppercase',
                      background:
                        burnoutSentinel.overall_tier === 'high_risk'
                          ? 'rgba(239, 68, 68, 0.2)'
                          : 'rgba(16, 185, 129, 0.2)',
                      color: burnoutSentinel.overall_tier === 'high_risk' ? '#f87171' : '#34d399',
                    }}
                  >
                    {burnoutSentinel.overall_tier}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '16px', marginTop: '16px', fontSize: '12px' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Optimal: </span>
                    <strong style={{ color: '#34d399' }}>{burnoutSentinel.optimal_count}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Moderate: </span>
                    <strong style={{ color: '#fbbf24' }}>{burnoutSentinel.moderate_count}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>High Risk: </span>
                    <strong style={{ color: '#ef4444' }}>{burnoutSentinel.high_risk_count}</strong>
                  </div>
                </div>
              </div>

              {/* Prescriptive Recommendations */}
              <div
                style={{
                  padding: '16px 18px',
                  borderRadius: '10px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
                  <HeartHandshake size={16} color="#818cf8" />
                  <span>Prescriptive Sentinel Recommendations</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                  {burnoutSentinel.system_recommendations.map((rec, idx) => (
                    <div key={idx} style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                      <span style={{ color: '#818cf8' }}>&bull;</span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Engineer Risk Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
            {(burnoutSentinel?.members || []).map((eng) => {
              const isHigh = eng.risk_tier === 'high_risk';
              const isMod = eng.risk_tier === 'moderate';

              return (
                <div
                  key={eng.employee_id}
                  className="glass-panel"
                  style={{
                    padding: '20px',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    border: isHigh
                      ? '1px solid rgba(239, 68, 68, 0.35)'
                      : isMod
                      ? '1px solid rgba(245, 158, 11, 0.35)'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: 'rgba(99, 102, 241, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                        }}
                      >
                        {eng.employee_name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600 }}>{eng.employee_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {eng.designation_title} &bull; {eng.employee_code}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          textTransform: 'uppercase',
                          background: isHigh
                            ? 'rgba(239, 68, 68, 0.2)'
                            : isMod
                            ? 'rgba(245, 158, 11, 0.2)'
                            : 'rgba(16, 185, 129, 0.15)',
                          color: isHigh ? '#f87171' : isMod ? '#fbbf24' : '#34d399',
                        }}
                      >
                        Score: {eng.risk_score} ({eng.risk_tier})
                      </span>
                    </div>
                  </div>

                  {/* Signals Matrix */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: 'rgba(0, 0, 0, 0.25)',
                      fontSize: '11px',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>Late Outs</span>
                      <strong>{eng.late_checkout_days}d</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>Weekend</span>
                      <strong>{eng.weekend_hours_logged}h</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>Sprint Pts</span>
                      <strong style={{ color: eng.active_sprint_points > 15 ? '#ef4444' : '#818cf8' }}>
                        {eng.active_sprint_points}p
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>Since PTO</span>
                      <strong>{eng.days_since_last_leave}d</strong>
                    </div>
                  </div>

                  {/* Trigger & Recommendation */}
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Primary Driver:</div>
                    <div style={{ fontWeight: 600, color: isHigh ? '#fca5a5' : '#fff' }}>
                      {eng.primary_risk_trigger}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      background: 'rgba(99, 102, 241, 0.08)',
                      border: '1px solid rgba(99, 102, 241, 0.2)',
                      fontSize: '11px',
                      color: '#c7d2fe',
                    }}
                  >
                    <strong>Action: </strong>
                    {eng.action_recommendation}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Task Rebalance Modal */}
      {reassignModalTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              width: '460px',
              background: 'var(--surface-1)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-hairline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowRightLeft size={16} color="var(--accent-primary)" />
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Workload Rebalancer
                </span>
              </div>
              <button
                className="btn-ghost"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                onClick={() => setReassignModalTarget(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Issue to Reassign
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    background: 'var(--surface-2)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-hairline)',
                    marginTop: '6px',
                  }}
                >
                  <span className="issue-key" style={{ fontSize: '12px', fontWeight: 600 }}>
                    {reassignModalTarget.current_focus_issue}
                  </span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Currently Assigned To
                </label>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {reassignModalTarget.employee_name} ({reassignModalTarget.presence_status === 'on_leave' ? 'Currently On Leave' : `${reassignModalTarget.total_story_points} pts allocated`})
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Select Target Assignee (With Available Capacity)
                </label>
                <select
                  className="select-field"
                  style={{ width: '100%', marginTop: '6px', padding: '8px 12px', fontSize: '13px' }}
                  value={selectedTargetEmployeeId}
                  onChange={(e) => setSelectedTargetEmployeeId(e.target.value)}
                >
                  <option value="">-- Select Available Team Member --</option>
                  {members
                    .filter((m) => m.employee_id !== reassignModalTarget.employee_id && m.capacity_status !== 'overloaded')
                    .map((m) => (
                      <option key={m.employee_id} value={m.employee_id}>
                        {m.employee_name} ({m.total_story_points} pts • {m.presence_status === 'in_office' ? 'In Office' : 'Available'})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid var(--border-hairline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px',
                background: 'var(--surface-2)',
              }}
            >
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setReassignModalTarget(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                disabled={!selectedTargetEmployeeId || isReassigning}
                onClick={handleExecuteReassign}
              >
                <Check size={13} />
                Confirm Rebalance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamCapacityDesk;
