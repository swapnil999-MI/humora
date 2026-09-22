import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/store';
import {
  fetchMyWorkday,
  quickLogWork,
  fetchWeeklyTimesheet,
  submitWeeklyTimesheet,
} from '../../store/fusionSlice';
import { recordPunch } from '../../store/hrmsSlice';
import { addToast, setWorkspace } from '../../store/uiSlice';
import { StatusGlyph, PriorityGlyph } from '../../components/StatusGlyph';
import {
  Clock,
  Play,
  Square,
  CheckCircle2,
  AlertCircle,
  Timer,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Layers,
  ChevronRight,
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
              My Workday Hub
            </span>
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
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: isPunchedIn ? 'var(--accent-emerald)' : 'var(--text-muted)',
                  boxShadow: isPunchedIn ? '0 0 8px rgba(16, 185, 129, 0.4)' : 'none',
                }}
              />
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {isPunchedIn ? 'Clocked In' : 'Clocked Out'}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '4px' }}>
                ({(myWorkday?.today_hours || 0).toFixed(1)}h office)
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

      {/* Engine 2: Zero-Effort Weekly Worklog-to-Timesheet Reconciliation */}
      <div
        className="soft-card"
        style={{
          padding: '24px 26px',
          border: '1px solid var(--border-accent)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Timesheet Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                padding: '8px',
                borderRadius: '10px',
                background: 'var(--accent-subtle)',
                color: 'var(--accent-primary)',
              }}
            >
              <FileCheck2 size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                  Weekly Worklog-to-Timesheet Reconciliation
                </h3>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    background:
                      weeklyTimesheet?.submission_status === 'approved'
                        ? 'var(--accent-emerald-subtle)'
                        : weeklyTimesheet?.submission_status === 'submitted'
                        ? 'var(--accent-amber-subtle)'
                        : weeklyTimesheet?.submission_status === 'rejected'
                        ? 'var(--accent-rose-subtle)'
                        : 'var(--surface-hover)',
                    color:
                      weeklyTimesheet?.submission_status === 'approved'
                        ? 'var(--accent-emerald)'
                        : weeklyTimesheet?.submission_status === 'submitted'
                        ? 'var(--accent-amber)'
                        : weeklyTimesheet?.submission_status === 'rejected'
                        ? 'var(--accent-rose)'
                        : 'var(--text-secondary)',
                    border: `1px solid ${
                      weeklyTimesheet?.submission_status === 'approved'
                        ? 'rgba(16, 185, 129, 0.3)'
                        : weeklyTimesheet?.submission_status === 'submitted'
                        ? 'rgba(245, 158, 11, 0.3)'
                        : 'var(--border-hairline)'
                    }`,
                  }}
                >
                  {weeklyTimesheet?.submission_status || 'draft'}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Week of {weeklyTimesheet?.week_start_date || 'Current'} &bull; Daily audit reconciling attendance biometric punches with agile worklogs
              </div>
            </div>
          </div>

          {/* Week Summary Counters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '13px' }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Clocked Hours</span>
              <strong style={{ color: 'var(--text-primary)' }}>{(weeklyTimesheet?.total_clocked_hours || 0).toFixed(1)}h</strong>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Logged Tickets</span>
              <strong style={{ color: 'var(--text-primary)' }}>{(weeklyTimesheet?.total_logged_hours || 0).toFixed(1)}h</strong>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Net Variance</span>
              <strong style={{ color: 'var(--text-primary)' }}>
                {(weeklyTimesheet?.variance_hours || 0) > 0 ? `+${(weeklyTimesheet?.variance_hours || 0).toFixed(1)}h` : `${(weeklyTimesheet?.variance_hours || 0).toFixed(1)}h`}
              </strong>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Sync Fidelity</span>
              <strong style={{ color: 'var(--text-primary)' }}>
                {weeklyTimesheet?.sync_percentage || 0}%
              </strong>
            </div>
          </div>
        </div>

        {/* 7-Day Stream Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '10px',
            marginTop: '8px',
          }}
        >
          {(weeklyTimesheet?.days || []).map((day) => {
            const isWeekend = day.status === 'weekend';
            const isUnderLogged = day.status === 'under_logged';
            const isOverLogged = day.status === 'over_logged';
            const isSynced = day.status === 'synced';

            return (
              <div
                key={day.date}
                style={{
                  padding: '12px 10px',
                  borderRadius: '10px',
                  background: isUnderLogged
                    ? 'var(--accent-amber-subtle)'
                    : isWeekend
                    ? 'var(--surface-0)'
                    : 'var(--surface-2)',
                  border: `1px solid ${
                    isUnderLogged
                      ? 'rgba(245, 158, 11, 0.3)'
                      : 'var(--border-hairline)'
                  }`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  minHeight: '140px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: isWeekend ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                    {day.day_of_week.slice(0, 3)}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {day.date.slice(5)}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Clock:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{day.clocked_hours.toFixed(1)}h</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Log:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{day.logged_hours.toFixed(1)}h</strong>
                  </div>
                  {day.clocked_hours > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Var:</span>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {day.variance_hours > 0 ? `+${day.variance_hours.toFixed(1)}h` : `${day.variance_hours.toFixed(1)}h`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Day status badge */}
                <div style={{ marginTop: 'auto' }}>
                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: 600,
                      padding: '2px 5px',
                      borderRadius: '4px',
                      display: 'inline-block',
                      textTransform: 'uppercase',
                      background: isWeekend
                        ? 'var(--surface-hover)'
                        : 'var(--surface-3)',
                      color: isWeekend
                        ? 'var(--text-muted)'
                        : 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {isWeekend ? 'Off' : isUnderLogged ? 'Deficit' : isOverLogged ? 'Over' : 'Synced'}
                  </span>
                </div>

                {/* Worklogs item preview */}
                {day.worklogs && day.worklogs.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                    {day.worklogs.map((wl) => (
                      <div
                        key={wl.issue_id}
                        style={{
                          fontSize: '10px',
                          padding: '3px 6px',
                          borderRadius: 'var(--radius-xs)',
                          background: 'var(--surface-3)',
                          border: '1px solid var(--border-hairline)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          color: 'var(--text-primary)',
                        }}
                        title={wl.issue_title}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{wl.issue_key}</span>
                        <span>{wl.hours}h</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Timesheet Submission / Approval Action Ribbon */}
        <div
          style={{
            marginTop: '8px',
            padding: '14px 18px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border-hairline)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {weeklyTimesheet?.submission_status === 'approved' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldCheck size={18} color="var(--text-primary)" />
              <div style={{ fontSize: '13px' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Timesheet Officially Approved</span>
                {weeklyTimesheet.reviewed_by && (
                  <span style={{ color: 'var(--text-secondary)' }}> &bull; Reviewed by {weeklyTimesheet.reviewed_by}</span>
                )}
                {weeklyTimesheet.reviewer_comments && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    "{weeklyTimesheet.reviewer_comments}"
                  </div>
                )}
              </div>
            </div>
          ) : weeklyTimesheet?.submission_status === 'submitted' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={18} color="var(--text-secondary)" />
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                <strong>Awaiting Manager Review</strong> &bull; Submitted on{' '}
                {weeklyTimesheet.submitted_at ? new Date(weeklyTimesheet.submitted_at).toLocaleDateString() : 'Today'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
              <input
                type="text"
                placeholder="Add optional notes for your weekly timesheet submission..."
                value={submissionNotes}
                onChange={(e) => setSubmissionNotes(e.target.value)}
                className="input-field"
                style={{
                  flex: 1,
                  height: '38px',
                }}
              />
              <button
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, height: '38px' }}
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
