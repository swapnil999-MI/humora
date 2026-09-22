import React, { useEffect, useState, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/store';
import {
  setActiveIssue,
  fetchIssueWorklogs,
  logWork,
  transitionIssue,
} from '../../store/workSlice';
import { addToast } from '../../store/uiSlice';
import {
  X,
  Clock,
  Send,
  Play,
  Pause,
  RotateCcw,
  Briefcase,
  User,
  CheckCircle,
  Bookmark,
  Bug,
  Sparkles,
  CheckSquare,
} from 'lucide-react';

export const IssueDrawer: React.FC = () => {
  const dispatch = useAppDispatch();
  const { activeIssue, activeIssueWorklogs, activeProject, kanbanBoard } = useAppSelector(
    (state) => state.work
  );

  const worklogs = activeIssueWorklogs || [];

  const [hoursSpent, setHoursSpent] = useState('1');
  const [worklogDesc, setWorklogDesc] = useState('');
  const [isBillable, setIsBillable] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live Stopwatch State
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (activeIssue?.id) {
      dispatch(fetchIssueWorklogs(activeIssue.id));
      setIsTimerRunning(false);
      setTimerSeconds(0);
    }
  }, [dispatch, activeIssue?.id]);

  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning]);

  // Close slide-over on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dispatch(setActiveIssue(null));
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [dispatch]);

  if (!activeIssue) return null;

  const handleLogWork = async (secondsToLog: number, descriptionText: string) => {
    if (!activeProject || !activeIssue || secondsToLog <= 0) return;

    setIsSubmitting(true);
    try {
      await dispatch(
        logWork({
          issueId: activeIssue.id,
          projectId: activeProject.id,
          timeSpentSeconds: secondsToLog,
          description: descriptionText || 'Work recorded',
          isBillable,
        })
      ).unwrap();
      dispatch(addToast({ type: 'success', message: 'Work logged & remaining estimate updated!' }));
      setHoursSpent('1');
      setWorklogDesc('');
      setTimerSeconds(0);
      setIsTimerRunning(false);
    } catch (err: any) {
      dispatch(addToast({ type: 'error', message: err || 'Failed to log work' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const seconds = Math.round(parseFloat(hoursSpent) * 3600);
    handleLogWork(seconds, worklogDesc);
  };

  const handleStopwatchSave = () => {
    if (timerSeconds < 10) {
      alert('Please run timer for at least 10 seconds to record work.');
      return;
    }
    handleLogWork(timerSeconds, worklogDesc || 'Live stopwatch session');
  };

  const handleStatusChange = (statusId: string) => {
    if (!activeProject || !activeIssue) return;
    dispatch(
      transitionIssue({
        issueId: activeIssue.id,
        targetStatusId: statusId,
        projectId: activeProject.id,
      })
    );
  };

  const formatTimerDisplay = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="drawer-overlay" onClick={() => dispatch(setActiveIssue(null))}>
      <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              className="mono-tag"
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--accent-primary)',
              }}
            >
              {activeIssue.issue_key}
            </span>
            <span className={`badge badge-priority-${activeIssue.priority}`}>
              {activeIssue.priority}
            </span>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(255, 255, 255, 0.08)',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              {activeIssue.issue_type}
            </span>
          </div>

          <button
            className="btn btn-ghost btn-sm"
            onClick={() => dispatch(setActiveIssue(null))}
          >
            <X size={18} />
          </button>
        </div>

        {/* Issue Title & Description */}
        <h1 style={{ fontSize: '20px', fontWeight: 700, lineHeight: 1.35, marginBottom: '12px' }}>
          {activeIssue.title}
        </h1>

        <div
          style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            marginBottom: '24px',
            lineHeight: 1.6,
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {activeIssue.description || 'No detailed description provided.'}
        </div>

        {/* Status Transition Selector */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Workflow Status</label>
            <select
              className="select-field"
              value={activeIssue.status_id}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              {kanbanBoard?.columns.map((col) => (
                <option key={col.status_id} value={col.status_id}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Assignee</label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(17, 20, 32, 0.85)',
                border: '1px solid var(--border-subtle)',
                fontSize: '13px',
              }}
            >
              <User size={14} color="var(--accent-primary)" />
              <span>{activeIssue.assignee_name || 'Unassigned'}</span>
            </div>
          </div>
        </div>

        {/* Live Stopwatch Tracker */}
        <div
          className="glass-panel"
          style={{
            padding: '20px',
            background: 'linear-gradient(135deg, rgba(24, 28, 45, 0.9) 0%, rgba(13, 15, 23, 0.95) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} color="var(--accent-primary)" />
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Live Work Stopwatch</span>
            </div>

            <span
              className="mono-tag"
              style={{
                fontSize: '22px',
                fontWeight: 800,
                color: isTimerRunning ? 'var(--accent-emerald)' : 'var(--text-primary)',
              }}
            >
              {formatTimerDisplay(timerSeconds)}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {!isTimerRunning ? (
              <button
                className="btn btn-success btn-sm"
                style={{ flex: 1 }}
                onClick={() => setIsTimerRunning(true)}
              >
                <Play size={13} />
                Start Timer
              </button>
            ) : (
              <button
                className="btn btn-danger btn-sm"
                style={{ flex: 1 }}
                onClick={() => setIsTimerRunning(false)}
              >
                <Pause size={13} />
                Pause Timer
              </button>
            )}

            <button
              className="btn btn-primary btn-sm"
              style={{ flex: 1 }}
              onClick={handleStopwatchSave}
              disabled={timerSeconds === 0 || isSubmitting}
            >
              <Send size={13} />
              Save Session
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setIsTimerRunning(false);
                setTimerSeconds(0);
              }}
              title="Reset Stopwatch"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>

        {/* Time Progress & Estimates */}
        <div
          style={{
            padding: '18px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontWeight: 600, fontSize: '13px' }}>Estimate Countdown</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Remaining: {(activeIssue.remaining_estimate_seconds / 3600).toFixed(1)}h
            </span>
          </div>

          <div
            style={{
              height: '6px',
              borderRadius: '9999px',
              background: 'rgba(255, 255, 255, 0.1)',
              overflow: 'hidden',
              margin: '10px 0',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(
                  100,
                  Math.max(
                    0,
                    100 -
                      (activeIssue.remaining_estimate_seconds /
                        (activeIssue.original_estimate_seconds || 1)) *
                        100
                  )
                )}%`,
                background: 'var(--accent-primary)',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span>Original Estimate: {(activeIssue.original_estimate_seconds / 3600).toFixed(1)}h</span>
            <span>Story Points: {activeIssue.story_points || 'None'}</span>
          </div>
        </div>

        {/* Manual Worklog Form */}
        <div
          style={{
            padding: '20px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border-subtle)',
            marginBottom: '24px',
          }}
        >
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px' }}>
            Log Manual Work Hours
          </h3>

          <form onSubmit={handleManualLogSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="input-group">
                <label className="input-label">Hours Spent</label>
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  className="input-field"
                  value={hoursSpent}
                  onChange={(e) => setHoursSpent(e.target.value)}
                  required
                />
                <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                  {[0.25, 0.5, 1, 2].map((val) => (
                    <button
                      key={val}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '1px 6px', fontSize: '10px', height: '20px' }}
                      onClick={() => setHoursSpent(val.toString())}
                    >
                      +{val >= 1 ? `${val}h` : `${val * 60}m`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Timesheet Billing</label>
                <select
                  className="select-field"
                  value={isBillable ? 'true' : 'false'}
                  onChange={(e) => setIsBillable(e.target.value === 'true')}
                >
                  <option value="true">Billable (Synced)</option>
                  <option value="false">Non-Billable Internal</option>
                </select>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Work Description</label>
              <input
                type="text"
                className="input-field"
                placeholder="What did you complete?"
                value={worklogDesc}
                onChange={(e) => setWorklogDesc(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-secondary"
              style={{ width: '100%' }}
              disabled={isSubmitting}
            >
              <Send size={13} />
              {isSubmitting ? 'Logging...' : 'Submit Worklog Entry'}
            </button>
          </form>
        </div>

        {/* Logged Work History */}
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
            Work Activity Log ({worklogs.length})
          </h3>

          {worklogs.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>
              No time logged yet. Use the stopwatch or form above to record work.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {worklogs.map((wl) => (
                <div
                  key={wl.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '12px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {wl.employee_name || 'Alice Smith'} &bull;{' '}
                      <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>
                        {(wl.time_spent_seconds / 3600).toFixed(2)}h
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {wl.description || 'Sprint task implementation'}
                    </div>
                  </div>

                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {new Date(wl.started_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
