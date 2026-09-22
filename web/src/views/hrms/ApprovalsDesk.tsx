import React, { useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/store';
import {
  fetchCompanyLeaves,
  updateLeaveStatus,
  fetchTeamRegularizations,
  reviewRegularization,
} from '../../store/hrmsSlice';
import { addToast } from '../../store/uiSlice';
import {
  ShieldCheck,
  Check,
  X,
  AlertTriangle,
  Calendar,
  Clock,
  UserCheck,
  Layers,
  FileCheck,
  History,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

type ApprovalCategory = 'leaves' | 'regularizations';
type FilterTab = 'pending' | 'history';

export const ApprovalsDesk: React.FC = () => {
  const dispatch = useAppDispatch();
  const { companyLeaves, teamRegularizations, isLoading } = useAppSelector((state) => state.hrms);

  const [activeCategory, setActiveCategory] = useState<ApprovalCategory>('leaves');
  const [filterTab, setFilterTab] = useState<FilterTab>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchCompanyLeaves());
    dispatch(fetchTeamRegularizations());
  }, [dispatch]);

  // Leave queues
  const pendingLeaves = useMemo(() => {
    return companyLeaves.filter((l) => l.status === 'pending');
  }, [companyLeaves]);

  const historyLeaves = useMemo(() => {
    return companyLeaves.filter((l) => l.status !== 'pending');
  }, [companyLeaves]);

  // Regularization queues
  const pendingRegularizations = useMemo(() => {
    return (teamRegularizations || []).filter((r) => r.status === 'pending');
  }, [teamRegularizations]);

  const historyRegularizations = useMemo(() => {
    return (teamRegularizations || []).filter((r) => r.status !== 'pending');
  }, [teamRegularizations]);

  // Overlap Detection: check if any pending leaves overlap with each other
  const overlaps = useMemo(() => {
    const list = pendingLeaves;
    const conflicts: { req1: string; req2: string; name1: string; name2: string; dateRange: string }[] = [];

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const aFrom = new Date(list[i].from_date).getTime();
        const aTo = new Date(list[i].to_date).getTime();
        const bFrom = new Date(list[j].from_date).getTime();
        const bTo = new Date(list[j].to_date).getTime();

        if (Math.max(aFrom, bFrom) <= Math.min(aTo, bTo)) {
          conflicts.push({
            req1: list[i].id,
            req2: list[j].id,
            name1: list[i].employee_name || 'Employee 1',
            name2: list[j].employee_name || 'Employee 2',
            dateRange: `${new Date(list[i].from_date).toLocaleDateString()} - ${new Date(list[i].to_date).toLocaleDateString()}`,
          });
        }
      }
    }
    return conflicts;
  }, [pendingLeaves]);

  const handleLeaveAction = async (requestId: string, status: 'approved' | 'rejected') => {
    setProcessingId(requestId);
    try {
      await dispatch(updateLeaveStatus({ requestId, status })).unwrap();
      dispatch(
        addToast({
          type: status === 'approved' ? 'success' : 'info',
          message: `Leave request successfully ${status}.`,
        })
      );
    } catch (err: any) {
      dispatch(addToast({ type: 'error', message: err || 'Failed to update leave request' }));
    } finally {
      setProcessingId(null);
    }
  };

  const handleRegularizationAction = async (id: string, status: 'approved' | 'rejected') => {
    setProcessingId(id);
    try {
      await dispatch(reviewRegularization({ id, status })).unwrap();
      dispatch(
        addToast({
          type: status === 'approved' ? 'success' : 'info',
          message: `Regularization request successfully ${status}. Biometric record reconciled.`,
        })
      );
    } catch (err: any) {
      dispatch(addToast({ type: 'error', message: err || 'Failed to update regularization request' }));
    } finally {
      setProcessingId(null);
    }
  };

  const totalPending = pendingLeaves.length + pendingRegularizations.length;

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#a5b4fc',
              }}
            >
              <ShieldCheck size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Management Approvals Console</h1>
            </div>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            Consolidated manager review queue for employee leave requests, missed punch regularizations, and on-duty work logs.
          </p>
        </div>

        {/* Global Summary Badge */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <div
            style={{
              background: totalPending > 0 ? 'rgba(245, 158, 11, 0.12)' : 'var(--surface-2)',
              border: totalPending > 0 ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border-hairline)',
              borderRadius: '8px',
              padding: '6px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
            }}
          >
            <span style={{ color: totalPending > 0 ? '#fbbf24' : 'var(--text-muted)', fontWeight: 600 }}>Total Pending:</span>
            <span
              style={{
                background: totalPending > 0 ? '#f59e0b' : 'transparent',
                color: totalPending > 0 ? '#0f172a' : 'var(--text-primary)',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: '4px',
                fontSize: '11px',
              }}
            >
              {totalPending}
            </span>
          </div>
        </div>
      </div>

      {/* Primary Category Switcher: Leave vs Regularization */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          background: 'var(--surface-2)',
          padding: '4px',
          borderRadius: '10px',
          width: 'fit-content',
          border: '1px solid var(--border-hairline)',
        }}
      >
        <button
          onClick={() => {
            setActiveCategory('leaves');
            setFilterTab('pending');
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            background: activeCategory === 'leaves' ? 'var(--surface-4)' : 'transparent',
            color: activeCategory === 'leaves' ? '#ffffff' : 'var(--text-secondary)',
          }}
        >
          <Calendar size={15} />
          <span>Leave Requests</span>
          {pendingLeaves.length > 0 && (
            <span
              style={{
                background: '#f59e0b',
                color: '#000',
                padding: '1px 6px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              {pendingLeaves.length}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveCategory('regularizations');
            setFilterTab('pending');
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            background: activeCategory === 'regularizations' ? 'var(--surface-4)' : 'transparent',
            color: activeCategory === 'regularizations' ? '#ffffff' : 'var(--text-secondary)',
          }}
        >
          <Clock size={15} />
          <span>Attendance Regularizations</span>
          {pendingRegularizations.length > 0 && (
            <span
              style={{
                background: 'var(--accent-primary)',
                color: '#fff',
                padding: '1px 6px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              {pendingRegularizations.length}
            </span>
          )}
        </button>
      </div>

      {/* Sub Filter: Pending Review vs Audit History */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-hairline)', paddingBottom: '8px' }}>
        <button
          className={`btn btn-sm ${filterTab === 'pending' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setFilterTab('pending')}
        >
          Pending Review ({activeCategory === 'leaves' ? pendingLeaves.length : pendingRegularizations.length})
        </button>
        <button
          className={`btn btn-sm ${filterTab === 'history' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setFilterTab('history')}
        >
          <History size={13} style={{ marginRight: '4px' }} />
          Audit History ({activeCategory === 'leaves' ? historyLeaves.length : historyRegularizations.length})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SECTION A: LEAVE REQUESTS                                                 */}
      {/* ========================================================================= */}
      {activeCategory === 'leaves' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Team Overlap Warning Banner */}
          {overlaps.length > 0 && filterTab === 'pending' && (
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 'var(--radius-lg)',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <AlertTriangle size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: '#fbbf24' }}>
                  Team Capacity & Overlap Alert ({overlaps.length} conflict detected)
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.5 }}>
                  Multiple team members have overlapping time-off requests:
                  <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                    {overlaps.map((o, idx) => (
                      <li key={idx}>
                        <strong>{o.name1}</strong> and <strong>{o.name2}</strong> both requested leave around {o.dateRange}.
                        Check active sprint commitments before approving to avoid bottlenecks.
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {filterTab === 'pending' ? (
            pendingLeaves.length === 0 ? (
              <div
                style={{
                  background: 'var(--surface-1)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-hairline)',
                  padding: '60px 20px',
                  textAlign: 'center',
                }}
              >
                <UserCheck size={40} color="var(--accent-emerald)" style={{ margin: '0 auto 12px', opacity: 0.8 }} />
                <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>
                  All Leave Requests Resolved
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  There are no pending employee leave requests awaiting manager sign-off.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {pendingLeaves.map((leave) => {
                  const isProcessing = processingId === leave.id;

                  return (
                    <div
                      key={leave.id}
                      style={{
                        background: 'var(--surface-1)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-hairline)',
                        padding: '18px 22px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      {/* Top Bar */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '50%',
                              background: 'var(--surface-3)',
                              border: '1px solid var(--border-subtle)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 600,
                              fontSize: '12px',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {leave.employee_name?.charAt(0) || 'E'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                              {leave.employee_name || 'Team Member'}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              Requested on {new Date(leave.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              background: 'rgba(99, 102, 241, 0.12)',
                              color: '#a5b4fc',
                              padding: '3px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                            }}
                          >
                            {leave.leave_type_name || 'Paid Leave'}
                          </span>
                          <span
                            style={{
                              background: 'var(--accent-amber-subtle)',
                              color: 'var(--accent-amber)',
                              padding: '3px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                            }}
                          >
                            Pending
                          </span>
                        </div>
                      </div>

                      {/* Dates & Reason Detail Grid */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                          gap: '12px',
                          background: 'var(--surface-2)',
                          padding: '12px 16px',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      >
                        <div>
                          <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Duration Range:</div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={13} color="var(--accent-primary)" />
                            {new Date(leave.from_date).toLocaleDateString()} → {new Date(leave.to_date).toLocaleDateString()}
                          </div>
                        </div>

                        <div>
                          <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Total Deducted Days:</div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {leave.total_days} {leave.total_days === 1 ? 'day' : 'days'}
                          </div>
                        </div>
                      </div>

                      {/* Reason Text */}
                      {leave.reason && (
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.02)', padding: '10px 14px', borderRadius: '6px', borderLeft: '3px solid var(--accent-primary)' }}>
                          <strong>Reason:</strong> {leave.reason}
                        </div>
                      )}

                      {/* Bottom Action Buttons */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-hairline)' }}>
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={isProcessing}
                          onClick={() => handleLeaveAction(leave.id, 'rejected')}
                          style={{ minWidth: '90px' }}
                        >
                          <X size={14} />
                          Reject
                        </button>
                        <button
                          className="btn btn-success btn-sm"
                          disabled={isProcessing}
                          onClick={() => handleLeaveAction(leave.id, 'approved')}
                          style={{ minWidth: '100px' }}
                        >
                          <Check size={14} />
                          Approve
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* History Table */
            <div
              style={{
                background: 'var(--surface-1)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-hairline)',
                overflow: 'hidden',
              }}
            >
              <table className="linear-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr
                    style={{
                      background: 'var(--surface-2)',
                      borderBottom: '1px solid var(--border-subtle)',
                      color: 'var(--text-muted)',
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      height: '36px',
                    }}
                  >
                    <th style={{ padding: '0 16px' }}>Employee</th>
                    <th style={{ padding: '0 16px' }}>Type</th>
                    <th style={{ padding: '0 16px' }}>Dates</th>
                    <th style={{ padding: '0 16px' }}>Total Days</th>
                    <th style={{ padding: '0 16px' }}>Status</th>
                    <th style={{ padding: '0 16px' }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLeaves.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        No approval history found.
                      </td>
                    </tr>
                  ) : (
                    historyLeaves.map((leave) => (
                      <tr
                        key={leave.id}
                        style={{
                          height: '42px',
                          borderBottom: '1px solid var(--border-hairline)',
                          fontSize: '13px',
                        }}
                      >
                        <td style={{ padding: '0 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {leave.employee_name || 'Team Member'}
                        </td>
                        <td style={{ padding: '0 16px', color: 'var(--text-secondary)' }}>
                          {leave.leave_type_name || 'Paid Leave'}
                        </td>
                        <td style={{ padding: '0 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                          {new Date(leave.from_date).toLocaleDateString()} - {new Date(leave.to_date).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '0 16px', fontWeight: 600 }}>{leave.total_days}</td>
                        <td style={{ padding: '0 16px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              textTransform: 'capitalize',
                              background:
                                leave.status === 'approved'
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : 'rgba(244, 63, 94, 0.15)',
                              color: leave.status === 'approved' ? '#34d399' : '#fb7185',
                            }}
                          >
                            {leave.status}
                          </span>
                        </td>
                        <td style={{ padding: '0 16px', color: 'var(--text-muted)', fontSize: '12px', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {leave.reason || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION B: ATTENDANCE REGULARIZATIONS                                    */}
      {/* ========================================================================= */}
      {activeCategory === 'regularizations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filterTab === 'pending' ? (
            pendingRegularizations.length === 0 ? (
              <div
                style={{
                  background: 'var(--surface-1)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-hairline)',
                  padding: '60px 20px',
                  textAlign: 'center',
                }}
              >
                <CheckCircle2 size={40} color="var(--accent-emerald)" style={{ margin: '0 auto 12px', opacity: 0.8 }} />
                <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>
                  Zero Regularization Backlog
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  All missed punch adjustments and on-duty work logs have been reviewed.
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-hairline)', borderRadius: '12px', background: 'var(--surface-1)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-hairline)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Employee</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Adjustment Type</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Target Date</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Requested In / Out</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Employee Justification</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Manager Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRegularizations.map((r) => {
                      const isProcessing = processingId === r.id;
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.employee_name || 'Team Member'}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.employee_code}</div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span
                              style={{
                                background:
                                  r.request_type === 'missed_punch'
                                    ? 'rgba(245, 158, 11, 0.15)'
                                    : r.request_type === 'on_duty'
                                    ? 'rgba(99, 102, 241, 0.15)'
                                    : 'rgba(59, 130, 246, 0.15)',
                                color:
                                  r.request_type === 'missed_punch'
                                    ? '#fbbf24'
                                    : r.request_type === 'on_duty'
                                    ? '#a5b4fc'
                                    : '#60a5fa',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                fontSize: '10px',
                              }}
                            >
                              {r.request_type.replace('_', ' ')}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                            {new Date(r.request_date).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                            {r.requested_punch_in ? new Date(r.requested_punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '09:00'}{' '}
                            →{' '}
                            {r.requested_punch_out ? new Date(r.requested_punch_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '18:00'}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', maxWidth: '280px' }}>
                            {r.reason}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                              <button
                                className="btn btn-danger btn-sm"
                                disabled={isProcessing}
                                onClick={() => handleRegularizationAction(r.id, 'rejected')}
                                style={{ padding: '4px 10px', fontSize: '11px' }}
                              >
                                <X size={13} />
                                Reject
                              </button>
                              <button
                                className="btn btn-success btn-sm"
                                disabled={isProcessing}
                                onClick={() => handleRegularizationAction(r.id, 'approved')}
                                style={{ padding: '4px 12px', fontSize: '11px' }}
                              >
                                <Check size={13} />
                                Approve
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            /* History Table for Regularizations */
            <div
              style={{
                background: 'var(--surface-1)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-hairline)',
                overflow: 'hidden',
              }}
            >
              <table className="linear-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr
                    style={{
                      background: 'var(--surface-2)',
                      borderBottom: '1px solid var(--border-subtle)',
                      color: 'var(--text-muted)',
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      height: '36px',
                    }}
                  >
                    <th style={{ padding: '0 16px' }}>Employee</th>
                    <th style={{ padding: '0 16px' }}>Type</th>
                    <th style={{ padding: '0 16px' }}>Date</th>
                    <th style={{ padding: '0 16px' }}>In / Out</th>
                    <th style={{ padding: '0 16px' }}>Status</th>
                    <th style={{ padding: '0 16px' }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRegularizations.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        No regularization history found.
                      </td>
                    </tr>
                  ) : (
                    historyRegularizations.map((r) => (
                      <tr
                        key={r.id}
                        style={{
                          height: '42px',
                          borderBottom: '1px solid var(--border-hairline)',
                          fontSize: '13px',
                        }}
                      >
                        <td style={{ padding: '0 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {r.employee_name || 'Team Member'}
                        </td>
                        <td style={{ padding: '0 16px', textTransform: 'uppercase', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {r.request_type.replace('_', ' ')}
                        </td>
                        <td style={{ padding: '0 16px', fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                          {new Date(r.request_date).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '0 16px', fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                          {r.requested_punch_in ? new Date(r.requested_punch_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '09:00'} - {r.requested_punch_out ? new Date(r.requested_punch_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '18:00'}
                        </td>
                        <td style={{ padding: '0 16px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              textTransform: 'capitalize',
                              background:
                                r.status === 'approved'
                                  ? 'rgba(16, 185, 129, 0.15)'
                                  : 'rgba(244, 63, 94, 0.15)',
                              color: r.status === 'approved' ? '#34d399' : '#fb7185',
                            }}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td style={{ padding: '0 16px', color: 'var(--text-muted)', fontSize: '12px', maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.reason || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ApprovalsDesk;
