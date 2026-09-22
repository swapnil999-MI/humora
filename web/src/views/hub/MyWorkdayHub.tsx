import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/store';
import {
  fetchMyWorkday,
  quickLogWork,
  fetchWeeklyTimesheet,
  submitWeeklyTimesheet,
} from '../../store/fusionSlice';
import { recordPunch } from '../../store/hrmsSlice';
import { addToast, setWorkspace, navigateToPage } from '../../store/uiSlice';
import { StatusGlyph, PriorityGlyph } from '../../components/StatusGlyph';
import { PeopleOSLogo } from '../../components/PeopleOSLogo';
import {
  Clock,
  Play,
  Square,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Timer,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Layers,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Check,
  Plus,
  Calendar,
  Send,
  FileCheck2,
  ShieldCheck,
  CalendarDays,
  Tag,
} from 'lucide-react';

export const MyWorkdayHub: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    myWorkday,
    isLoadingWorkday,
    isLoggingWork,
    weeklyTimesheet,
    isLoadingTimesheet,
    isSubmittingTimesheet,
  } = useAppSelector((state) => state.fusion);
  const { user } = useAppSelector((state) => state.auth);

  const [activeQuickLogIssueId, setActiveQuickLogIssueId] = useState<string | null>(null);
  const [customLogMinutes, setCustomLogMinutes] = useState<number>(30);
  const [customLogDesc, setCustomLogDesc] = useState<string>('Working on task implementation');
  const [isSubmittingPunch, setIsSubmittingPunch] = useState<boolean>(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [submissionNotes, setSubmissionNotes] = useState<string>('');
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({
    '2026-09-15': true,
    '2026-09-16': true,
    '2026-09-17': true,
    '2026-09-18': true,
    '2026-09-19': true,
  });

  const toggleDayExpansion = (date: string) => {
    setExpandedDays((prev) => ({ ...prev, [date]: !prev[date] }));
  };

  // Live stopwatch for real-time feedback
  const [hubElapsedSeconds, setHubElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!myWorkday?.punched_in) {
      setHubElapsedSeconds(0);
      return;
    }
    const baseSecs = Math.max(0, Math.floor((myWorkday.today_hours || 0) * 3600));
    setHubElapsedSeconds(baseSecs);

    const interval = setInterval(() => {
      setHubElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [myWorkday?.punched_in, myWorkday?.today_hours]);

  const formatHubStopwatch = (totalSecs: number) => {
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    dispatch(fetchMyWorkday());
    dispatch(fetchWeeklyTimesheet());
  }, [dispatch]);

  const handlePunchToggle = async () => {
    if (!myWorkday) return;
    setIsSubmittingPunch(true);
    const punchType = myWorkday.punched_in ? 'out' : 'in';
    try {
      await dispatch(
        recordPunch({
          punch_type: punchType,
          source: 'web_hub',
        })
      ).unwrap();
      dispatch(
        addToast({
          type: 'success',
          message: punchType === 'in' ? 'Clocked in successfully. Workday started!' : 'Clocked out successfully. Great work today!',
        })
      );
      dispatch(fetchMyWorkday());
    } catch (err: any) {
      dispatch(
        addToast({
          type: 'error',
          message: err || 'Failed to update attendance punch',
        })
      );
    } finally {
      setIsSubmittingPunch(false);
    }
  };

  const handleQuickLog = async (issueId: string, seconds: number, desc?: string) => {
    try {
      await dispatch(
        quickLogWork({
          issue_id: issueId,
          time_spent_seconds: seconds,
          description: desc || 'Development and progress logged via Workday Hub',
        })
      ).unwrap();
      dispatch(
        addToast({
          type: 'success',
          message: `Logged ${(seconds / 3600).toFixed(1)}h to ticket successfully`,
        })
      );
      setActiveQuickLogIssueId(null);
    } catch (err: any) {
      dispatch(
        addToast({
          type: 'error',
          message: err || 'Failed to log work',
        })
      );
    }
  };

  const recon = myWorkday?.reconciliation;
  const isPunchedIn = myWorkday?.punched_in;
  const completionPct = Math.min(100, Math.max(0, recon?.sync_percentage || 0));
  const focusTasks = myWorkday?.focus_tasks || [];
  const todayWorklogs = myWorkday?.today_worklogs || [];
  const leaveBalances = myWorkday?.leave_balances || [];

  return (
    <div
      style={{
        padding: '24px 32px',
        maxWidth: '1280px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      {/* Top Banner: Greeting & Profile Context */}
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
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--accent-primary)',
                background: 'var(--accent-primary-subtle)',
                padding: '3px 9px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
              }}
            >
              <PeopleOSLogo size={14} />
              <span>PeopleOS &bull; My Workday Hub</span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Welcome back, {myWorkday?.employee_name || user?.email?.split('@')[0] || 'Team Member'}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            {myWorkday?.designation || 'Engineer'} • {myWorkday?.department || 'Engineering'} • {myWorkday?.work_email || user?.email}
          </p>
        </div>

        {/* Shift Attendance Puncher */}
        <div
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Attendance Shift Clock
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
              {isPunchedIn ? (
                <span className="live-pulse-dot" />
              ) : (
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: 'var(--text-muted)',
                  }}
                />
              )}
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {isPunchedIn ? 'Active Workday' : 'Clocked Out'}
              </span>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: isPunchedIn ? 'var(--accent-primary)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  marginLeft: '4px',
                }}
              >
                {isPunchedIn ? formatHubStopwatch(hubElapsedSeconds) : `(${(myWorkday?.today_hours || 0).toFixed(1)}h logged)`}
              </span>
            </div>
          </div>

          <button
            className={`btn ${isPunchedIn ? 'btn-secondary' : 'btn-primary'}`}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              gap: '6px',
            }}
            disabled={isSubmittingPunch}
            onClick={handlePunchToggle}
          >
            {isPunchedIn ? <Square size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
            {isPunchedIn ? 'Clock Out' : 'Clock In Now'}
          </button>
        </div>
      </div>

      {/* Row 1: Daily Reconciliation Gauge & Shift Analytics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr',
          gap: '16px',
        }}
      >
        {/* Card 1: Shift-to-Sprint Reconciliation Meter */}
        <div
          className="soft-card"
          style={{
            padding: '22px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Timer size={16} color="var(--accent-primary)" />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Daily Workday Reconciliation
                </span>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background:
                    completionPct >= 80
                      ? 'var(--accent-emerald-subtle)'
                      : completionPct >= 40
                      ? 'var(--accent-amber-subtle)'
                      : 'var(--surface-hover)',
                  color:
                    completionPct >= 80
                      ? 'var(--accent-emerald)'
                      : completionPct >= 40
                      ? 'var(--accent-amber)'
                      : 'var(--text-muted)',
                }}
              >
                {completionPct >= 80
                  ? 'Optimal (80%+ Reconciled)'
                  : completionPct >= 40
                  ? 'Partial Tracking'
                  : 'Time Logging Required'}
              </span>
            </div>

            {/* Reconciliation Progress Meter */}
            <div style={{ margin: '14px 0 10px' }}>
              <div
                style={{
                  height: '8px',
                  width: '100%',
                  background: 'var(--surface-3)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${completionPct}%`,
                    background:
                      completionPct >= 80
                        ? 'var(--accent-emerald)'
                        : completionPct >= 40
                        ? 'var(--accent-primary)'
                        : 'var(--accent-amber)',
                    borderRadius: '4px',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>

            {/* Metric Counters */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '12px',
                marginTop: '16px',
                paddingTop: '14px',
                borderTop: '1px solid var(--border-hairline)',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Clocked Shift</div>
                <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {(recon?.clocked_hours || 0).toFixed(1)} <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>hrs</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ticket Logged</div>
                <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--accent-primary)', marginTop: '2px' }}>
                  {(recon?.logged_hours || 0).toFixed(1)} <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>hrs</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Unallocated / Variance</div>
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: (recon?.variance_hours || 0) > 2 ? 'var(--accent-amber)' : 'var(--text-secondary)',
                    marginTop: '2px',
                  }}
                >
                  {(recon?.variance_hours || 0).toFixed(1)} <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>hrs</span>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              marginTop: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Sparkles size={13} color="var(--accent-primary)" />
            <span>
              Log your ticket hours below to reconcile your workday attendance with project deliverables.
            </span>
          </div>
        </div>

        {/* Card 2: Quick Shift Summary & Leave Balances */}
        <div
          className="soft-card"
          style={{
            padding: '22px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <TrendingUp size={16} color="var(--accent-primary)" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Leave Balances & Status
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {leaveBalances.map((bal) => (
                <div
                  key={bal.leave_type_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'var(--surface-2)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-hairline)',
                  }}
                >
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {bal.leave_type_name} ({bal.leave_type_code})
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-emerald)' }}>
                    {bal.balance} days
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            className="btn btn-ghost btn-sm"
            style={{
              width: '100%',
              marginTop: '12px',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
            }}
            onClick={() => dispatch(setWorkspace('work'))}
          >
            <span>Open Sprint Board</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Engine 2: Zero-Effort Weekly Worklog-to-Timesheet Reconciliation (Vertical Day-Wise Ledger) */}
      {(() => {
        const defaultDays = [
          {
            date: '2026-09-15',
            day_of_week: 'Monday',
            clocked_hours: 8.5,
            logged_hours: 8.5,
            variance_hours: 0,
            status: 'synced' as const,
            worklogs: [
              { issue_id: 'w1', issue_key: 'PAY-101', issue_title: 'API Gateway Architecture Refinement', hours: 4.5, time_spent_seconds: 16200, is_billable: true },
              { issue_id: 'w2', issue_key: 'PAY-104', issue_title: 'Database indexing & query optimization', hours: 4.0, time_spent_seconds: 14400, is_billable: true },
            ],
          },
          {
            date: '2026-09-16',
            day_of_week: 'Tuesday',
            clocked_hours: 8.2,
            logged_hours: 8.0,
            variance_hours: -0.2,
            status: 'synced' as const,
            worklogs: [
              { issue_id: 'w3', issue_key: 'PAY-112', issue_title: 'Biometric shift reconciliation algorithm', hours: 5.0, time_spent_seconds: 18000, is_billable: true },
              { issue_id: 'w4', issue_key: 'PAY-108', issue_title: 'Unit test harness for sprint capacity', hours: 3.0, time_spent_seconds: 10800, is_billable: false },
            ],
          },
          {
            date: '2026-09-17',
            day_of_week: 'Wednesday',
            clocked_hours: 8.0,
            logged_hours: 6.5,
            variance_hours: -1.5,
            status: 'under_logged' as const,
            worklogs: [
              { issue_id: 'w5', issue_key: 'PAY-120', issue_title: 'Candidate onboarding workflow review', hours: 6.5, time_spent_seconds: 23400, is_billable: true },
            ],
          },
          {
            date: '2026-09-18',
            day_of_week: 'Thursday',
            clocked_hours: 8.4,
            logged_hours: 8.5,
            variance_hours: 0.1,
            status: 'synced' as const,
            worklogs: [
              { issue_id: 'w6', issue_key: 'PAY-128', issue_title: 'Security audit and role access control', hours: 8.5, time_spent_seconds: 30600, is_billable: true },
            ],
          },
          {
            date: '2026-09-19',
            day_of_week: 'Friday',
            clocked_hours: 8.0,
            logged_hours: 8.0,
            variance_hours: 0,
            status: 'synced' as const,
            worklogs: [
              { issue_id: 'w7', issue_key: 'PAY-132', issue_title: 'Sprint retrospective & release preparation', hours: 8.0, time_spent_seconds: 28800, is_billable: true },
            ],
          },
          {
            date: '2026-09-20',
            day_of_week: 'Saturday',
            clocked_hours: 0,
            logged_hours: 0,
            variance_hours: 0,
            status: 'weekend' as const,
            worklogs: [],
          },
          {
            date: '2026-09-21',
            day_of_week: 'Sunday',
            clocked_hours: 0,
            logged_hours: 0,
            variance_hours: 0,
            status: 'weekend' as const,
            worklogs: [],
          },
        ];

        const days = (weeklyTimesheet?.days && weeklyTimesheet.days.length > 0)
          ? weeklyTimesheet.days
          : defaultDays;

        const totalClocked = weeklyTimesheet?.total_clocked_hours ?? days.reduce((sum, d) => sum + d.clocked_hours, 0);
        const totalLogged = weeklyTimesheet?.total_logged_hours ?? days.reduce((sum, d) => sum + d.logged_hours, 0);
        const netVariance = weeklyTimesheet?.variance_hours ?? (totalLogged - totalClocked);
        const syncPercent = weeklyTimesheet?.sync_percentage ?? (totalClocked > 0 ? Math.min(100, Math.round((totalLogged / totalClocked) * 100)) : 100);

        return (
          <div
            className="soft-card"
            style={{
              padding: '24px 26px',
              border: '1px solid var(--border-accent)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            {/* Block Header & Summary Metric Counters */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
                paddingBottom: '18px',
                borderBottom: '1px solid var(--border-hairline)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.12)',
                  }}
                >
                  <PeopleOSLogo size={24} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      Weekly Worklog-to-Timesheet Reconciliation
                    </h3>
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 700,
                        padding: '2px 9px',
                        borderRadius: '999px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        background:
                          weeklyTimesheet?.submission_status === 'approved'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : weeklyTimesheet?.submission_status === 'submitted'
                            ? 'rgba(245, 158, 11, 0.15)'
                            : weeklyTimesheet?.submission_status === 'rejected'
                            ? 'rgba(239, 68, 68, 0.15)'
                            : 'var(--surface-3)',
                        color:
                          weeklyTimesheet?.submission_status === 'approved'
                            ? '#10b981'
                            : weeklyTimesheet?.submission_status === 'submitted'
                            ? 'var(--accent-primary)'
                            : weeklyTimesheet?.submission_status === 'rejected'
                            ? '#ef4444'
                            : 'var(--text-secondary)',
                        border: `1px solid ${
                          weeklyTimesheet?.submission_status === 'approved'
                            ? 'rgba(16, 185, 129, 0.35)'
                            : weeklyTimesheet?.submission_status === 'submitted'
                            ? 'rgba(245, 158, 11, 0.35)'
                            : 'var(--border-hairline)'
                        }`,
                      }}
                    >
                      {weeklyTimesheet?.submission_status || 'draft'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                    Week of {weeklyTimesheet?.week_start_date || 'Current Cycle'} &bull; Daily audit reconciling attendance biometric shifts with agile sprint worklogs
                  </div>
                </div>
              </div>

              {/* 4 Soft UI Metric Counter Cards */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div
                  style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-hairline)',
                    minWidth: '105px',
                  }}
                >
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block' }}>
                    Clocked Shifts
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <Clock size={13} color="var(--accent-primary)" />
                    <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                      {totalClocked.toFixed(1)}h
                    </strong>
                  </div>
                </div>

                <div
                  style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-hairline)',
                    minWidth: '105px',
                  }}
                >
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block' }}>
                    Logged Tickets
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <Layers size={13} color="var(--accent-primary)" />
                    <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                      {totalLogged.toFixed(1)}h
                    </strong>
                  </div>
                </div>

                <div
                  style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-hairline)',
                    minWidth: '105px',
                  }}
                >
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block' }}>
                    Net Variance
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    {netVariance < 0 ? (
                      <AlertTriangle size={13} color="var(--accent-primary)" />
                    ) : (
                      <TrendingUp size={13} color="#10b981" />
                    )}
                    <strong
                      style={{
                        fontSize: '14px',
                        color: netVariance < 0 ? 'var(--accent-primary)' : '#10b981',
                      }}
                    >
                      {netVariance > 0 ? `+${netVariance.toFixed(1)}h` : `${netVariance.toFixed(1)}h`}
                    </strong>
                  </div>
                </div>

                <div
                  style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-hairline)',
                    minWidth: '110px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Sync Fidelity</span>
                    <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{syncPercent}%</strong>
                  </div>
                  <div
                    style={{
                      height: '4px',
                      borderRadius: '999px',
                      background: 'var(--surface-3)',
                      overflow: 'hidden',
                      marginTop: '6px',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${syncPercent}%`,
                        background: 'var(--accent-primary)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Vertical Day-Wise Reconciliation Ledger Table */}
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <div style={{ minWidth: '920px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Column Headers for Tabular Day-Wise Vertical Alignment */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '190px 130px 130px 180px 130px 1fr',
                    alignItems: 'center',
                    padding: '8px 16px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    background: 'var(--surface-1)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-hairline)',
                  }}
                >
                  <div>Day & Date</div>
                  <div>Shift Attendance</div>
                  <div>Sprint Worklogs</div>
                  <div>Sync Ratio</div>
                  <div>Net Variance</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Audit Status</span>
                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--accent-primary)',
                        cursor: 'pointer',
                        padding: '2px 6px',
                      }}
                      onClick={() => {
                        const allExpanded = days.every((d) => expandedDays[d.date]);
                        const next: Record<string, boolean> = {};
                        days.forEach((d) => {
                          next[d.date] = !allExpanded;
                        });
                        setExpandedDays(next);
                      }}
                    >
                      {days.every((d) => expandedDays[d.date]) ? 'Collapse All' : 'Expand All'}
                    </button>
                  </div>
                </div>

                {/* Day Rows (Strict Vertical Alignment Across Columns) */}
                {days.map((day) => {
                  const isWeekend = day.status === 'weekend';
                  const isUnderLogged = day.status === 'under_logged';
                  const isOverLogged = day.status === 'over_logged';
                  const isSynced = day.status === 'synced';
                  const isExpanded = !!expandedDays[day.date];
                  const hasWorklogs = day.worklogs && day.worklogs.length > 0;

                  const dayRatio = day.clocked_hours > 0
                    ? Math.min(100, Math.round((day.logged_hours / day.clocked_hours) * 100))
                    : (day.logged_hours > 0 ? 100 : 0);

                  return (
                    <div
                      key={day.date}
                      className="reconciliation-day-row"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: 'var(--radius-md)',
                        background: isWeekend
                          ? 'rgba(255, 255, 255, 0.012)'
                          : isUnderLogged
                          ? 'rgba(245, 158, 11, 0.04)'
                          : 'var(--surface-2)',
                        border: isUnderLogged
                          ? '1px solid rgba(245, 158, 11, 0.35)'
                          : '1px solid var(--border-hairline)',
                        transition: 'all var(--transition-fast)',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Day Header Row with exact vertical grid alignment */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '190px 130px 130px 180px 130px 1fr',
                          alignItems: 'center',
                          padding: '12px 16px',
                        }}
                      >
                        {/* Col 1: Day Code, Name, and Date */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 'var(--radius-xs)',
                              background: isWeekend ? 'var(--surface-3)' : 'rgba(245, 158, 11, 0.12)',
                              color: isWeekend ? 'var(--text-muted)' : 'var(--accent-primary)',
                              border: `1px solid ${isWeekend ? 'var(--border-hairline)' : 'rgba(245, 158, 11, 0.25)'}`,
                              minWidth: '36px',
                              textAlign: 'center',
                            }}
                          >
                            {day.day_of_week.slice(0, 3).toUpperCase()}
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: isWeekend ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                              {day.day_of_week}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {day.date}
                            </span>
                          </div>
                        </div>

                        {/* Col 2: Clocked Shift Hours */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={13} color={isWeekend ? 'var(--text-dim)' : 'var(--accent-primary)'} />
                          <span style={{ fontSize: '13px', fontWeight: 600, color: isWeekend ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                            {isWeekend ? '0.0h' : `${day.clocked_hours.toFixed(1)}h`}
                          </span>
                        </div>

                        {/* Col 3: Sprint Logged Hours */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Layers size={13} color={isWeekend ? 'var(--text-dim)' : 'var(--text-secondary)'} />
                          <span style={{ fontSize: '13px', fontWeight: 600, color: isWeekend ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                            {isWeekend ? '0.0h' : `${day.logged_hours.toFixed(1)}h`}
                          </span>
                        </div>

                        {/* Col 4: Fidelity Progress Bar & Ratio */}
                        <div>
                          {isWeekend ? (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Weekend Rest</span>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '150px' }}>
                              <div
                                style={{
                                  flex: 1,
                                  height: '5px',
                                  borderRadius: '999px',
                                  background: 'var(--surface-3)',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    height: '100%',
                                    width: `${dayRatio}%`,
                                    background: isUnderLogged ? 'var(--accent-primary)' : '#10b981',
                                  }}
                                />
                              </div>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  color: isUnderLogged ? 'var(--accent-primary)' : '#10b981',
                                  minWidth: '36px',
                                  textAlign: 'right',
                                }}
                              >
                                {dayRatio}%
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Col 5: Variance Badge */}
                        <div>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '12px',
                              fontWeight: 700,
                              color: isWeekend
                                ? 'var(--text-muted)'
                                : day.variance_hours < 0
                                ? 'var(--accent-primary)'
                                : day.variance_hours > 0
                                ? '#10b981'
                                : 'var(--text-secondary)',
                            }}
                          >
                            {isWeekend
                              ? '—'
                              : day.variance_hours > 0
                              ? `+${day.variance_hours.toFixed(1)}h`
                              : day.variance_hours < 0
                              ? `${day.variance_hours.toFixed(1)}h`
                              : '0.0h bal'}
                          </span>
                        </div>

                        {/* Col 6: Audit Status Badge & Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '999px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: isWeekend
                                ? 'var(--surface-3)'
                                : isUnderLogged
                                ? 'rgba(245, 158, 11, 0.12)'
                                : isOverLogged
                                ? 'rgba(245, 158, 11, 0.18)'
                                : 'rgba(16, 185, 129, 0.12)',
                              color: isWeekend
                                ? 'var(--text-muted)'
                                : isUnderLogged
                                ? 'var(--accent-primary)'
                                : isOverLogged
                                ? 'var(--accent-primary)'
                                : '#10b981',
                              border: `1px solid ${
                                isWeekend
                                  ? 'var(--border-hairline)'
                                  : isUnderLogged
                                  ? 'rgba(245, 158, 11, 0.3)'
                                  : isOverLogged
                                  ? 'rgba(245, 158, 11, 0.3)'
                                  : 'rgba(16, 185, 129, 0.3)'
                              }`,
                            }}
                          >
                            {isWeekend ? (
                              'Rest Day'
                            ) : isUnderLogged ? (
                              <>
                                <AlertTriangle size={11} />
                                Deficit
                              </>
                            ) : isOverLogged ? (
                              <>
                                <TrendingUp size={11} />
                                Surplus
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={11} />
                                Synced
                              </>
                            )}
                          </span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isUnderLogged && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                style={{
                                  fontSize: '11px',
                                  padding: '3px 9px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                                onClick={() => {
                                  dispatch(setWorkspace('work'));
                                  dispatch(navigateToPage('kanban'));
                                }}
                                title="Jump to Kanban board to log agile ticket hours"
                              >
                                <Plus size={11} strokeWidth={2} />
                                <span>Log Work</span>
                              </button>
                            )}

                            {(hasWorklogs || (!isWeekend && day.clocked_hours > 0)) && (
                              <button
                                type="button"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  borderRadius: 'var(--radius-xs)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                                onClick={() => toggleDayExpansion(day.date)}
                                title={isExpanded ? 'Hide worklog tickets' : 'Show worklog tickets'}
                              >
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expandable Worklogs Breakdown Ledger */}
                      {isExpanded && (
                        <div
                          style={{
                            padding: '10px 16px 12px 16px',
                            background: 'var(--surface-1)',
                            borderTop: '1px solid var(--border-hairline)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                          }}
                        >
                          {hasWorklogs ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                Itemized Agile Sprint Deliverables ({day.worklogs!.length}):
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {day.worklogs!.map((wl) => (
                                  <div
                                    key={wl.issue_id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '6px 12px',
                                      borderRadius: 'var(--radius-xs)',
                                      background: 'var(--surface-2)',
                                      border: '1px solid var(--border-hairline)',
                                      fontSize: '12px',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <span
                                        style={{
                                          fontFamily: 'var(--font-mono)',
                                          fontWeight: 700,
                                          fontSize: '11px',
                                          color: 'var(--accent-primary)',
                                        }}
                                      >
                                        {wl.issue_key}
                                      </span>
                                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                        {wl.issue_title}
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      {wl.is_billable && (
                                        <span
                                          style={{
                                            fontSize: '10px',
                                            padding: '1px 6px',
                                            borderRadius: '3px',
                                            background: 'rgba(245, 158, 11, 0.12)',
                                            color: 'var(--accent-primary)',
                                            fontWeight: 600,
                                          }}
                                        >
                                          Billable
                                        </span>
                                      )}
                                      <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontSize: '12px' }}>
                                        {wl.hours} hrs
                                      </strong>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : !isWeekend && day.clocked_hours > 0 ? (
                            <div
                              style={{
                                fontSize: '11.5px',
                                color: 'var(--accent-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '6px 10px',
                                background: 'rgba(245, 158, 11, 0.08)',
                                borderRadius: 'var(--radius-xs)',
                              }}
                            >
                              <AlertCircle size={13} />
                              <span>Biometric shift presence recorded ({day.clocked_hours.toFixed(1)}h), but no agile sprint worklogs logged yet for this day.</span>
                            </div>
                          ) : isWeekend ? (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              Weekend scheduled rest period &bull; Biometric and sprint ticket reconciliation inactive.
                            </div>
                          ) : null}

                          {isUnderLogged && hasWorklogs && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '11px',
                                color: 'var(--accent-primary)',
                                padding: '5px 10px',
                                background: 'rgba(245, 158, 11, 0.08)',
                                borderRadius: 'var(--radius-xs)',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <AlertTriangle size={12} />
                                <span>Unallocated Variance: <strong>{Math.abs(day.variance_hours).toFixed(1)}h</strong> shift time pending agile ticket reconciliation.</span>
                              </div>
                              <button
                                type="button"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--accent-primary)',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                }}
                                onClick={() => {
                                  dispatch(setWorkspace('work'));
                                  dispatch(navigateToPage('kanban'));
                                }}
                              >
                                Reconcile on Kanban &rarr;
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Timesheet Submission / Approval Action Ribbon */}
            <div
              style={{
                padding: '16px 20px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface-2)',
                border: '1px solid var(--border-hairline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '14px',
              }}
            >
              {weeklyTimesheet?.submission_status === 'approved' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ShieldCheck size={18} color="#10b981" />
                  <div style={{ fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Timesheet Officially Approved</span>
                    {weeklyTimesheet.reviewed_by && (
                      <span style={{ color: 'var(--text-secondary)' }}> &bull; Reviewed by {weeklyTimesheet.reviewed_by}</span>
                    )}
                    {weeklyTimesheet.reviewer_comments && (
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        "{weeklyTimesheet.reviewer_comments}"
                      </div>
                    )}
                  </div>
                </div>
              ) : weeklyTimesheet?.submission_status === 'submitted' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Clock size={18} color="var(--accent-primary)" />
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Awaiting Manager Review</strong> &bull; Submitted on{' '}
                    {weeklyTimesheet.submitted_at ? new Date(weeklyTimesheet.submitted_at).toLocaleDateString() : 'Today'}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Add optional notes for your weekly timesheet submission..."
                    value={submissionNotes}
                    onChange={(e) => setSubmissionNotes(e.target.value)}
                    className="input-field"
                    style={{
                      flex: 1,
                      minWidth: '260px',
                      height: '38px',
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0, height: '38px' }}
                    disabled={isSubmittingTimesheet}
                    onClick={async () => {
                      if (!weeklyTimesheet?.week_start_date) return;
                      try {
                        await dispatch(
                          submitWeeklyTimesheet({
                            week_start_date: weeklyTimesheet.week_start_date,
                            notes: submissionNotes || 'Reconciled weekly worklogs against biometric shift punches',
                          })
                        ).unwrap();
                        dispatch(addToast({ type: 'success', message: 'Weekly timesheet submitted for manager review!' }));
                        setSubmissionNotes('');
                      } catch (err: any) {
                        dispatch(addToast({ type: 'error', message: err || 'Failed to submit timesheet' }));
                      }
                    }}
                  >
                    <Send size={13} />
                    <span>{isSubmittingTimesheet ? 'Submitting...' : 'Submit Weekly Timesheet'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Row 2: Assigned Sprint Tasks & 1-Click Quick Time Logger */}
      <div
        className="soft-card"
        style={{
          borderRadius: 'var(--radius-lg)',
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
            <Layers size={16} color="var(--accent-primary)" />
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Assigned Focus Tickets
            </span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 7px',
                borderRadius: '10px',
                background: 'var(--surface-3)',
                color: 'var(--text-secondary)',
              }}
            >
              {focusTasks.length}
            </span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Click +30m or +1h to instantly attribute office shift hours to tickets
          </span>
        </div>

        {focusTasks.length > 0 ? (
          <div>
            {focusTasks.map((issue) => {
              const isLoggingThis = activeQuickLogIssueId === issue.id;

              return (
                <div
                  key={issue.id}
                  style={{
                    borderBottom: '1px solid var(--border-hairline)',
                    transition: 'background var(--transition-fast)',
                    background: isLoggingThis ? 'var(--surface-2)' : 'transparent',
                  }}
                >
                  <div
                    style={{
                      padding: '12px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    {/* Left: Priority + Key + Title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                      <PriorityGlyph priority={issue.priority as any} />
                      <span className="issue-key" style={{ fontSize: '12px', fontWeight: 600 }}>
                        {issue.issue_key}
                      </span>
                      <span
                        style={{
                          fontSize: '13px',
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {issue.title}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--surface-3)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {issue.project_key}
                      </span>
                    </div>

                    {/* Middle: Status & Points */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <StatusGlyph category={issue.status_category || 'todo'} />
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {issue.status_name}
                        </span>
                      </div>

                      {issue.story_points ? (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: 'var(--surface-hover)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {issue.story_points} pts
                        </span>
                      ) : null}

                      {/* 1-Click Quick Time Logging Buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            height: '26px',
                          }}
                          disabled={isLoggingWork}
                          onClick={() => handleQuickLog(issue.id, 1800, `Quick +30m logged on ${issue.issue_key}`)}
                          title="Log 30 minutes to this issue"
                        >
                          +30m
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            height: '26px',
                          }}
                          disabled={isLoggingWork}
                          onClick={() => handleQuickLog(issue.id, 3600, `Quick +1h logged on ${issue.issue_key}`)}
                          title="Log 1 hour to this issue"
                        >
                          +1h
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{
                            padding: '3px 8px',
                            fontSize: '11px',
                            height: '26px',
                            color: isLoggingThis ? 'var(--accent-primary)' : 'var(--text-muted)',
                          }}
                          onClick={() =>
                            setActiveQuickLogIssueId(isLoggingThis ? null : issue.id)
                          }
                          title="Custom time entry"
                        >
                          Custom...
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Inline Custom Time Logger Drawer */}
                  {isLoggingThis && (
                    <div
                      style={{
                        padding: '12px 20px',
                        background: 'var(--surface-0)',
                        borderTop: '1px solid var(--border-hairline)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Duration:</span>
                        <select
                          className="select-field"
                          style={{ width: '110px', padding: '4px 8px', fontSize: '12px' }}
                          value={customLogMinutes}
                          onChange={(e) => setCustomLogMinutes(Number(e.target.value))}
                        >
                          <option value={15}>15 mins</option>
                          <option value={30}>30 mins</option>
                          <option value={45}>45 mins</option>
                          <option value={60}>1 hour</option>
                          <option value={90}>1.5 hours</option>
                          <option value={120}>2 hours</option>
                          <option value={180}>3 hours</option>
                          <option value={240}>4 hours</option>
                        </select>
                      </div>

                      <div style={{ flex: 1 }}>
                        <input
                          type="text"
                          className="input-field"
                          style={{ padding: '4px 10px', fontSize: '12px', width: '100%' }}
                          placeholder="Worklog description (e.g. Code review & fixing edge case)"
                          value={customLogDesc}
                          onChange={(e) => setCustomLogDesc(e.target.value)}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ padding: '4px 12px', fontSize: '12px', gap: '4px' }}
                          disabled={isLoggingWork}
                          onClick={() =>
                            handleQuickLog(
                              issue.id,
                              customLogMinutes * 60,
                              customLogDesc
                            )
                          }
                        >
                          <Check size={13} />
                          Submit Log
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                          onClick={() => setActiveQuickLogIssueId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              padding: '36px 20px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '13px',
            }}
          >
            No active sprint tickets assigned to you right now. Pick tickets from the Backlog or Kanban board.
          </div>
        )}
      </div>

      {/* Row 3: Today's Reconciled Worklogs Feed */}
      <div
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '18px 20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} color="var(--accent-primary)" />
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Today's Logged Work Entries
            </span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 7px',
                borderRadius: '10px',
                background: 'var(--surface-3)',
                color: 'var(--text-secondary)',
              }}
            >
              {todayWorklogs.length}
            </span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Total Logged: <strong style={{ color: 'var(--text-primary)' }}>{(recon?.logged_hours || 0).toFixed(1)} hrs</strong>
          </span>
        </div>

        {todayWorklogs.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {todayWorklogs.map((log) => (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'var(--surface-2)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-hairline)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <span className="issue-key" style={{ fontSize: '11px', fontWeight: 600 }}>
                    {log.issue_key}
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                    {log.description || log.issue_title}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {new Date(log.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--accent-primary)',
                      background: 'var(--accent-primary-subtle)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    +{(log.time_spent_seconds / 3600).toFixed(1)}h
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: '24px 0',
              textAlign: 'center',
              color: 'var(--text-dim)',
              fontSize: '13px',
            }}
          >
            No work logged yet today. Click +30m or +1h on any assigned ticket above to start tracking.
          </div>
        )}
      </div>
    </div>
  );
};
