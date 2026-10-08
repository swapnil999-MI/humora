import React, { useEffect, useState } from 'react';
import {
  DollarSign,
  Users,
  Zap,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import {
  api,
} from '../../../api/client';
import type { TeamCapacityResponse } from '../../../types';

interface FounderPulseBarProps {
  pendingCount: number;
  highRiskCount: number;
  lowRiskCount: number;
  onFilterHighRisk?: () => void;
  onFilterLowRisk?: () => void;
}

interface PayrollRunSummary {
  month: number;
  year: number;
  status: string;
  total_employees: number;
  total_net: number;
  total_gross: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const card: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border-hairline)',
  borderRadius: 'var(--radius-lg, 12px)',
  padding: '16px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.2))',
};

const Card: React.FC<{
  title: string;
  icon: React.ReactNode;
  accent?: string;
  value: React.ReactNode;
  unit?: React.ReactNode;
  footer: React.ReactNode;
}> = ({ title, icon, accent = 'var(--text-muted)', value, unit, footer }) => (
  <div style={card}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: '12px', fontWeight: 600, color: accent, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</span>
      <div
        style={{
          width: '28px', height: '28px', borderRadius: '8px', background: 'var(--surface-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent,
        }}
      >
        {icon}
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
      <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{value}</span>
      {unit && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{unit}</span>}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>{footer}</div>
  </div>
);

/**
 * Live organisation vitals for the approvals console: the latest payroll run, who is clocked in
 * today, team load from assigned story points, and the decision inbox. Every number comes from the
 * server; a card shows "—" until (or unless) its data exists.
 */
export const FounderPulseBar: React.FC<FounderPulseBarProps> = ({
  pendingCount,
  highRiskCount,
  lowRiskCount,
  onFilterHighRisk,
  onFilterLowRisk,
}) => {
  const [payroll, setPayroll] = useState<PayrollRunSummary | null | undefined>(undefined);
  const [capacity, setCapacity] = useState<TeamCapacityResponse | null | undefined>(undefined);

  useEffect(() => {
    api.get<PayrollRunSummary[]>('/hrms/payroll/runs')
      .then((runs) => {
        const done = (runs || []).filter((r) => r.status === 'completed').sort((a, b) => b.year - a.year || b.month - a.month);
        setPayroll(done[0] ?? null);
      })
      .catch(() => setPayroll(null));
    api.get<TeamCapacityResponse>('/fusion/team-capacity')
      .then((c) => setCapacity(c ?? null))
      .catch(() => setCapacity(null));
  }, []);

  const loading = <span style={{ color: 'var(--text-muted)' }}>…</span>;

  return (
    <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
      <Card
        title="Last Payroll Run"
        icon={<DollarSign size={16} />}
        value={payroll === undefined ? loading : payroll ? inr(payroll.total_net) : '—'}
        unit={payroll ? 'net paid' : undefined}
        footer={
          payroll ? (
            <span>
              {MONTHS[payroll.month - 1]} {payroll.year} • {payroll.total_employees} employees • gross {inr(payroll.total_gross)}
            </span>
          ) : payroll === null ? (
            <span>No completed payroll run yet</span>
          ) : null
        }
      />

      <Card
        title="Clocked In Today"
        icon={<Users size={16} />}
        value={capacity === undefined ? loading : capacity ? `${capacity.clocked_in_count} / ${capacity.total_engineers}` : '—'}
        footer={
          capacity ? (
            <span>{capacity.on_leave_count} on leave today</span>
          ) : capacity === null ? (
            <span>Attendance data unavailable</span>
          ) : null
        }
      />

      <Card
        title="Team Load"
        icon={<Zap size={16} />}
        accent={capacity && capacity.overallocated_count > 0 ? '#fbbf24' : undefined}
        value={capacity === undefined ? loading : capacity ? capacity.overallocated_count : '—'}
        unit={capacity ? 'overloaded' : undefined}
        footer={
          capacity ? (
            <span>
              More than 15 story points assigned • {capacity.available_count} with spare capacity
            </span>
          ) : capacity === null ? (
            <span>Sprint data unavailable</span>
          ) : null
        }
      />

      <Card
        title="Decision Inbox"
        icon={<ShieldCheck size={16} />}
        accent={pendingCount > 0 ? '#fbbf24' : undefined}
        value={pendingCount}
        unit="pending sign-offs"
        footer={
          <>
            {highRiskCount > 0 ? (
              <button
                onClick={onFilterHighRisk}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '4px', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '4px',
                  fontWeight: 700, cursor: 'pointer', fontSize: '11px',
                }}
                title="Show high-risk items"
              >
                <AlertCircle size={11} />
                {highRiskCount} High Risk
              </button>
            ) : (
              <span style={{ color: 'var(--accent-emerald, #10b981)', fontWeight: 600 }}>No high-risk items</span>
            )}
            {lowRiskCount > 0 && (
              <button
                onClick={onFilterLowRisk}
                style={{
                  background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '4px', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '4px',
                  fontWeight: 700, cursor: 'pointer', fontSize: '11px',
                }}
                title="Show low-risk items"
              >
                <CheckCircle2 size={11} />
                {lowRiskCount} Low Risk
              </button>
            )}
          </>
        }
      />
    </div>
  );
};
