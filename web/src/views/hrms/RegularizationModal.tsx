import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { setRegularizationOpen, addToast } from '../../store/uiSlice';
import { submitRegularization, fetchMonthlyAttendance, fetchAttendanceSession } from '../../store/hrmsSlice';
import { X, FileCheck2, Clock, Calendar, AlertCircle, Check } from 'lucide-react';

export const RegularizationModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isRegularizationOpen } = useAppSelector((state) => state.ui);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [punchType, setPunchType] = useState('in');
  const [time, setTime] = useState('09:30');
  const [reasonCategory, setReasonCategory] = useState('Forgot to punch');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isRegularizationOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = {
      request_type: reasonCategory.toLowerCase().includes('remote') || reasonCategory.toLowerCase().includes('wfh')
        ? 'wfh'
        : reasonCategory.toLowerCase().includes('client') || reasonCategory.toLowerCase().includes('duty')
        ? 'on_duty'
        : 'missed_punch',
      request_date: date,
      requested_punch_in: punchType === 'in' ? time : undefined,
      requested_punch_out: punchType === 'out' ? time : undefined,
      reason: `${reasonCategory}: ${note}`,
    };

    dispatch(submitRegularization(payload))
      .unwrap()
      .then(() => {
        setIsSubmitting(false);
        dispatch(setRegularizationOpen(false));
        dispatch(
          addToast({
            type: 'success',
            message: `Attendance regularization for ${date} (${time}) submitted for manager sign-off.`,
          })
        );
        setNote('');
        const d = new Date(date);
        dispatch(fetchMonthlyAttendance({ year: d.getFullYear(), month: d.getMonth() + 1 }));
        dispatch(fetchAttendanceSession());
      })
      .catch((err: any) => {
        setIsSubmitting(false);
        dispatch(addToast({ type: 'error', message: err || 'Failed to submit regularization' }));
      });
  };

  return (
    <div className="modal-backdrop" onClick={() => dispatch(setRegularizationOpen(false))}>
      <div
        className="modal-card"
        style={{ maxWidth: '480px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#a5b4fc',
              }}
            >
              <FileCheck2 size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
                Attendance Regularization
              </h2>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Submit missed biometric or geofenced clock event
              </div>
            </div>
          </div>
          <button
            className="btn-ghost"
            style={{ padding: '4px', borderRadius: '6px' }}
            onClick={() => dispatch(setRegularizationOpen(false))}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
          {/* Policy Notice */}
          <div
            style={{
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: '8px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
            }}
          >
            <AlertCircle size={16} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '1px' }} />
            <div>
              All regularizations require direct manager approval and are audited during monthly payroll processing.
            </div>
          </div>

          {/* Date & Punch Type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Date of Missed Punch
              </label>
              <input
                type="date"
                className="input-field"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Punch Event Type
              </label>
              <select
                className="select-field"
                value={punchType}
                onChange={(e) => setPunchType(e.target.value)}
              >
                <option value="in">Punch In (Start of Day)</option>
                <option value="out">Punch Out (End of Day)</option>
                <option value="break_start">Break Out</option>
                <option value="break_end">Break In</option>
              </select>
            </div>
          </div>

          {/* Time & Reason Category */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Estimated Actual Time
              </label>
              <input
                type="time"
                className="input-field"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Reason Category
              </label>
              <select
                className="select-field"
                value={reasonCategory}
                onChange={(e) => setReasonCategory(e.target.value)}
              >
                <option value="Forgot to punch">Forgot to punch</option>
                <option value="Biometric scanner issue">Biometric hardware glitch</option>
                <option value="Client site visit">Client site visit / Travel</option>
                <option value="Remote network issue">WFH Network / GPS issue</option>
                <option value="Power outage">Office Power outage</option>
              </select>
            </div>
          </div>

          {/* Explanation Note */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Justification / Note to Manager
            </label>
            <textarea
              className="textarea-field"
              rows={3}
              placeholder="Describe the context for missing the punch..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => dispatch(setRegularizationOpen(false))}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={isSubmitting}
            >
              <Check size={14} />
              {isSubmitting ? 'Submitting...' : 'Submit Regularization'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
