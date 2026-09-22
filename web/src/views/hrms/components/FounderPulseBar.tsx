import React from 'react';
import {
  DollarSign,
  Users,
  Zap,
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  Calendar,
  ShieldCheck,
} from 'lucide-react';

interface FounderPulseBarProps {
  pendingCount: number;
  highRiskCount: number;
  lowRiskCount: number;
  onFilterHighRisk?: () => void;
  onFilterLowRisk?: () => void;
}

export const FounderPulseBar: React.FC<FounderPulseBarProps> = ({
  pendingCount,
  highRiskCount,
  lowRiskCount,
  onFilterHighRisk,
  onFilterLowRisk,
}) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px',
        width: '100%',
      }}
    >
      {/* Metric 1: Monthly Payroll & Expense Commitment */}
      <div
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border-hairline)',
          borderRadius: 'var(--radius-lg, 12px)',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.2))',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Monthly Payroll Run
          </span>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary, #f59e0b)',
            }}
          >
            <DollarSign size={16} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            ₹18,45,000
          </span>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            ($24.6K)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--accent-emerald, #10b981)' }}>
          <TrendingUp size={13} />
          <span style={{ fontWeight: 600 }}>92% of Q3 Budget</span>
          <span style={{ color: 'var(--text-muted)' }}>• 48 Active Compensations</span>
        </div>
      </div>

      {/* Metric 2: Live Workforce Presence */}
      <div
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border-hairline)',
          borderRadius: 'var(--radius-lg, 12px)',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.2))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Workforce Presence
          </span>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-emerald, #10b981)',
            }}
          >
            <Users size={16} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            48 / 50
          </span>
          <span
            style={{
              background: 'rgba(16, 185, 129, 0.15)',
              color: 'var(--accent-emerald, #10b981)',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            96% Active
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <Calendar size={13} color="var(--accent-primary, #f59e0b)" />
          <span>2 Planned Leaves</span>
          <span>• 0 Unexcused • Operations Nominal</span>
        </div>
      </div>

      {/* Metric 3: Agile Sprint Velocity */}
      <div
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border-hairline)',
          borderRadius: 'var(--radius-lg, 12px)',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.2))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Active Sprint Velocity
          </span>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'rgba(59, 130, 246, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#60a5fa',
            }}
          >
            <Zap size={16} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Sprint 24
          </span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-emerald, #10b981)' }}>
            78% Delivered
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <CheckCircle2 size={13} color="var(--accent-emerald, #10b981)" />
          <span>42 / 54 Story Points</span>
          <span>• 0 Critical Blockers</span>
        </div>
      </div>

      {/* Metric 4: Executive Approvals Queue */}
      <div
        style={{
          background: pendingCount > 0 ? 'rgba(245, 158, 11, 0.05)' : 'var(--surface-1)',
          border: pendingCount > 0 ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border-hairline)',
          borderRadius: 'var(--radius-lg, 12px)',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.2))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: pendingCount > 0 ? '#fbbf24' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Decision Inbox
          </span>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: pendingCount > 0 ? 'rgba(245, 158, 11, 0.2)' : 'var(--surface-3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: pendingCount > 0 ? '#fbbf24' : 'var(--text-muted)',
            }}
          >
            <ShieldCheck size={16} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {pendingCount}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            pending sign-offs
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
          {highRiskCount > 0 ? (
            <button
              onClick={onFilterHighRisk}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '4px',
                padding: '2px 6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '11px',
              }}
              title="Filter high-risk items"
            >
              <AlertCircle size={11} />
              {highRiskCount} High Risk
            </button>
          ) : (
            <span style={{ color: 'var(--accent-emerald, #10b981)', fontWeight: 600 }}>Zero High Risk</span>
          )}

          {lowRiskCount > 0 && (
            <button
              onClick={onFilterLowRisk}
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '4px',
                padding: '2px 6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '11px',
              }}
              title="Filter low-risk auto-approvable items"
            >
              <CheckCircle2 size={11} />
              {lowRiskCount} Quick-Pass
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
