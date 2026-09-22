import React, { useEffect, useState, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/store';
import {
  fetchLeaveBalances,
  fetchLeaveTypes,
  fetchMyLeaves,
  previewLeave,
  applyLeave,
  clearLeavePreview,
} from '../../store/hrmsSlice';
import { addToast } from '../../store/uiSlice';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  Sparkles,
  CalendarCheck,
  CalendarDays,
  Gift,
  ArrowRight,
  TrendingUp,
  Info,
  Layers,
  FileCheck,
  Sun,
  PartyPopper,
} from 'lucide-react';

interface CompanyHoliday {
  id: string;
  name: string;
  date: string;
  dayOfWeek: string;
  type: 'national' | 'festival' | 'restricted';
  daysAway: number;
}

export const HrmsDashboard: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { leaveBalances, leaveTypes, myLeaves, currentPreview } = useAppSelector((state) => state.hrms);

  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedLeaveType, setSelectedLeaveType] = useState('');
  const [fromDate, setFromDate] = useState('2026-09-18');
  const [toDate, setToDate] = useState('2026-09-21');
  const [reason, setReason] = useState('Personal time off');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    dispatch(fetchLeaveBalances());
    dispatch(fetchLeaveTypes());
    dispatch(fetchMyLeaves());
  }, [dispatch]);

  useEffect(() => {
    if (leaveTypes.length > 0 && !selectedLeaveType) {
      setSelectedLeaveType(leaveTypes[0].id);
    }
  }, [leaveTypes, selectedLeaveType]);

  // Automatically compute preview whenever dates or leave type change
  useEffect(() => {
    if (isApplyModalOpen && selectedLeaveType && fromDate && toDate) {
      dispatch(
        previewLeave({
          leave_type_id: selectedLeaveType,
          from_date: fromDate,
          to_date: toDate,
          reason: reason || 'Absence',
        })
      );
    }
  }, [dispatch, isApplyModalOpen, selectedLeaveType, fromDate, toDate, reason]);

  // Company holiday list (Sep 2026 onwards)
  const upcomingHolidays: CompanyHoliday[] = useMemo(() => {
    return [
      { id: 'h1', name: 'Gandhi Jayanti', date: '2026-10-02', dayOfWeek: 'Friday', type: 'national', daysAway: 16 },
      { id: 'h2', name: 'Dussehra / Vijayadashami', date: '2026-10-20', dayOfWeek: 'Tuesday', type: 'festival', daysAway: 34 },
      { id: 'h3', name: 'Diwali / Deepavali', date: '2026-11-08', dayOfWeek: 'Sunday', type: 'festival', daysAway: 53 },
      { id: 'h4', name: 'Guru Nanak Jayanti', date: '2026-11-24', dayOfWeek: 'Tuesday', type: 'restricted', daysAway: 69 },
      { id: 'h5', name: 'Christmas Day', date: '2026-12-25', dayOfWeek: 'Friday', type: 'festival', daysAway: 100 },
      { id: 'h6', name: "New Year's Day", date: '2027-01-01', dayOfWeek: 'Friday', type: 'festival', daysAway: 107 },
    ];
  }, []);

  // Summary counts
  const totalBalanceDays = useMemo(() => {
    return (leaveBalances || []).reduce((sum, b) => sum + (b.balance || 0), 0);
  }, [leaveBalances]);

  const pendingLeavesCount = useMemo(() => {
    return (myLeaves || []).filter((l) => l.status === 'pending').length;
  }, [myLeaves]);

  const usedLeavesCount = useMemo(() => {
    return (leaveBalances || []).reduce((sum, b) => sum + (b.used || 0), 0);
  }, [leaveBalances]);

  // Upcoming user leaves (approved or pending from today onwards)
  const upcomingLeaves = useMemo(() => {
    return (myLeaves || []).filter((l) => l.status !== 'rejected');
  }, [myLeaves]);

  // Filtered requests for the table
  const filteredLeaves = useMemo(() => {
    if (statusFilter === 'all') return myLeaves || [];
    return (myLeaves || []).filter((l) => l.status === statusFilter);
  }, [myLeaves, statusFilter]);

  const handleOpenApplyModal = (typeId?: string) => {
    if (typeId) setSelectedLeaveType(typeId);
    setIsApplyModalOpen(true);
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeaveType || !fromDate || !toDate) return;

    setIsSubmitting(true);
    try {
      await dispatch(
        applyLeave({
          leave_type_id: selectedLeaveType,
          from_date: fromDate,
          to_date: toDate,
          reason: reason || 'Absence',
        })
      ).unwrap();
      dispatch(
        addToast({
          type: 'success',
          message: 'Leave application submitted successfully!',
        })
      );
      setIsApplyModalOpen(false);
      dispatch(fetchLeaveBalances());
      dispatch(fetchMyLeaves());
    } catch (err: any) {
      dispatch(addToast({ type: 'error', message: err || 'Failed to submit leave' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyPreset = (preset: 'single' | 'midweek' | 'week') => {
    if (preset === 'single') {
      const todayStr = new Date().toISOString().split('T')[0];
      setFromDate(todayStr);
      setToDate(todayStr);
      setReason('Personal appointment');
    } else if (preset === 'midweek') {
      setFromDate('2026-09-23');
      setToDate('2026-09-25');
      setReason('Family event');
    } else if (preset === 'week') {
      setFromDate('2026-09-21');
      setToDate('2026-09-25');
      setReason('Annual vacation');
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1360px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* 1. Header Bar with Summary KPI Stats & Apply Action */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary)',
              }}
            >
              <CalendarDays size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                Leaves & Holidays Hub
              </h1>
              <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                Personal time-off quotas, company holiday calendar, and leave request management.
              </p>
            </div>
          </div>
        </div>

        <button
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px', fontSize: '13px', boxShadow: 'var(--shadow-sm)' }}
          onClick={() => handleOpenApplyModal()}
        >
          <Plus size={16} />
          <span>Apply for Leave</span>
        </button>
      </div>

      {/* 2. Top Metric Counters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-hairline)',
            borderRadius: '12px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Available Balance
            </span>
            <CalendarCheck size={16} color="var(--accent-primary)" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px' }}>
            {totalBalanceDays}{' '}
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>Days</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Across all leave categories</div>
        </div>

        <div
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-hairline)',
            borderRadius: '12px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Pending Approvals
            </span>
            <Clock size={16} color="var(--text-muted)" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px' }}>
            {pendingLeavesCount}{' '}
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>Requests</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Awaiting manager sign-off</div>
        </div>

        <div
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-hairline)',
            borderRadius: '12px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Leaves Taken (YTD)
            </span>
            <CheckCircle2 size={16} color="var(--accent-emerald)" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px' }}>
            {usedLeavesCount}{' '}
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>Days</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Utilized in current year 2026</div>
        </div>

        <div
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-hairline)',
            borderRadius: '12px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Upcoming Holidays
            </span>
            <Gift size={16} color="var(--text-secondary)" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px' }}>
            {upcomingHolidays.length}{' '}
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>Days</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Next: {upcomingHolidays[0].name} (in {upcomingHolidays[0].daysAway}d)
          </div>
        </div>
      </div>

      {/* 3. LEAVE ALLOWANCE CARDS (FIRST ON PAGE, PROMINENT) */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
              Leave Allowances & Balances
            </h2>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>• Annual Quota 2026</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          {(leaveBalances || []).map((bal) => {
            const credited = bal.credited || (bal.balance + bal.used) || 12;
            const used = bal.used || 0;
            const usedPercent = Math.min(100, Math.round((used / credited) * 100));

            return (
              <div
                key={bal.id || bal.leave_type_id}
                style={{
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: '12px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px',
                  boxShadow: 'var(--shadow-sm)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {bal.leave_type_name}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 'var(--surface-3)',
                        color: 'var(--text-secondary)',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      {bal.leave_type_code}
                    </span>
                  </div>

                  {/* Big Balance Display */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '8px 0 4px' }}>
                    <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {bal.balance}
                    </span>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>
                      days available
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                      <span>Used: {used} days</span>
                      <span>Total Quota: {credited} days</span>
                    </div>
                    <div
                      style={{
                        height: '6px',
                        borderRadius: '6px',
                        background: 'var(--surface-3)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${usedPercent}%`,
                          background: 'var(--text-primary)',
                          borderRadius: '6px',
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-hairline)', paddingTop: '12px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Auto-accrued monthly
                  </span>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{
                      fontSize: '12px',
                      padding: '4px 10px',
                      color: 'var(--accent-primary)',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    onClick={() => handleOpenApplyModal(bal.leave_type_id)}
                  >
                    <span>Apply</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. UPCOMING HOLIDAYS & UPCOMING TIME-OFF (Side-by-Side Grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
        {/* Left: Upcoming Company Holidays */}
        <div
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-hairline)',
            borderRadius: '12px',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PartyPopper size={18} color="var(--text-primary)" />
              <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                Upcoming Company Holidays
              </h3>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Mandatory & Festive</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {upcomingHolidays.map((holiday) => (
              <div
                key={holiday.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-hairline)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      background: 'var(--surface-3)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      textAlign: 'center',
                      minWidth: '46px',
                    }}
                  >
                    <div style={{ fontSize: '9px', textTransform: 'uppercase', fontWeight: 600 }}>
                      {new Date(holiday.date).toLocaleString('default', { month: 'short' })}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700 }}>
                      {new Date(holiday.date).getDate()}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {holiday.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {holiday.dayOfWeek} &bull; {holiday.type.toUpperCase()}
                    </div>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: 'var(--surface-3)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                    fontWeight: 600,
                  }}
                >
                  In {holiday.daysAway} days
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: My Upcoming Leaves & Approved Time Off */}
        <div
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-hairline)',
            borderRadius: '12px',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarCheck size={18} color="var(--accent-emerald)" />
              <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                My Scheduled Time-Off
              </h3>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{upcomingLeaves.length} scheduled</span>
          </div>

          {upcomingLeaves.length === 0 ? (
            <div
              style={{
                background: 'var(--surface-2)',
                borderRadius: '8px',
                padding: '36px 20px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px',
              }}
            >
              <Calendar size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
              <div>No upcoming leaves scheduled.</div>
              <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
                Plan your vacation or time-off in advance.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {upcomingLeaves.slice(0, 5).map((l) => (
                <div
                  key={l.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-hairline)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {l.leave_type_name || 'Paid Leave'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {new Date(l.from_date).toLocaleDateString()} &rarr; {new Date(l.to_date).toLocaleDateString()} ({l.total_days} {l.total_days === 1 ? 'day' : 'days'})
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      background: 'var(--surface-3)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {l.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. LEAVE REQUESTS & AUDIT HISTORY TABLE */}
      <div
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border-hairline)',
          borderRadius: '12px',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
              Leave History & Applications
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Track approval status and details for all submitted requests.
            </p>
          </div>

          {/* Filter Pills */}
          <div
            style={{
              display: 'flex',
              background: 'var(--surface-2)',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid var(--border-hairline)',
              gap: '4px',
            }}
          >
            {(['all', 'pending', 'approved', 'rejected'] as const).map((filter) => (
              <button
                key={filter}
                className={`btn-ghost ${statusFilter === filter ? 'active' : ''}`}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  textTransform: 'capitalize',
                  background: statusFilter === filter ? 'var(--surface-4)' : 'transparent',
                  color: statusFilter === filter ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
                onClick={() => setStatusFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid var(--border-hairline)', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-hairline)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Leave Type</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Duration</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Days Deducted</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Reason</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Applied On</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No leave requests found for this filter.
                  </td>
                </tr>
              ) : (
                filteredLeaves.map((leave) => (
                  <tr key={leave.id} style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {leave.leave_type_name || 'Paid Leave'}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      {new Date(leave.from_date).toLocaleDateString()} &rarr; {new Date(leave.to_date).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{leave.total_days}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', maxWidth: '260px' }}>
                      {leave.reason || '-'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          background: 'var(--surface-3)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        {leave.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '11px' }}>
                      {new Date(leave.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. MODAL: APPLY FOR LEAVE */}
      {isApplyModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setIsApplyModalOpen(false)}
        >
          <div
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border-hairline)',
              borderRadius: '14px',
              width: '520px',
              padding: '26px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarDays size={18} color="var(--accent-primary)" />
                <h3 style={{ fontSize: '17px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                  Apply for Time-Off
                </h3>
              </div>
              <button className="btn-ghost" onClick={() => setIsApplyModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {/* Presets Row */}
            <div>
              <label className="label" style={{ marginBottom: '6px' }}>Quick Presets</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyPreset('single')}>
                  Single Day
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyPreset('midweek')}>
                  Mid-Week (3d)
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyPreset('week')}>
                  Full Week (5d)
                </button>
              </div>
            </div>

            <form onSubmit={handleApplyLeave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="label">Select Leave Type</label>
                <select
                  className="select-field"
                  value={selectedLeaveType}
                  onChange={(e) => setSelectedLeaveType(e.target.value)}
                  required
                >
                  {leaveTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code}) &bull; Quota: {t.annual_quota} days
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="label">From Date</label>
                  <input
                    type="date"
                    className="input-field"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">To Date</label>
                  <input
                    type="date"
                    className="input-field"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Dynamic Preview Card */}
              {currentPreview && (
                <div
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-hairline)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    fontSize: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Effective Deducted Days:</span>
                    <strong style={{ fontSize: '14px', color: 'var(--accent-primary)' }}>
                      {currentPreview.total_deducted_days} days
                    </strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Projected Balance Remaining:</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {currentPreview.projected_balance} days
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="label">Reason / Handover Notes</label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide brief context for the manager and sprint handover..."
                  required
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn-ghost" onClick={() => setIsApplyModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit Leave Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HrmsDashboard;
