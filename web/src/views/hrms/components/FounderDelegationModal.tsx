import React, { useState } from 'react';
import {
  ShieldAlert,
  X,
  UserCheck,
  Calendar,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Flame,
} from 'lucide-react';

interface FounderDelegationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (policy: DelegationPolicy) => void;
  currentPolicy: DelegationPolicy;
}

export interface DelegationPolicy {
  isDelegated: boolean;
  delegateName: string;
  delegateRole: string;
  scope: 'all' | 'routine_only' | 'no_financials';
  autoApproveLowRisk: boolean;
  emergencyFreeze: boolean;
  validUntil: string;
}

export const FounderDelegationModal: React.FC<FounderDelegationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentPolicy,
}) => {
  const [policy, setPolicy] = useState<DelegationPolicy>(currentPolicy);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'var(--surface-1)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl, 16px)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-hairline)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface-2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.15)',
                color: 'var(--accent-primary, #f59e0b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Founder Governance & Delegation
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                Configure executive authority, delegate sign-offs, and emergency controls.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '75vh', overflowY: 'auto' }}>
          {/* Section 1: Executive Delegation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Executive Sign-Off Delegation
              </span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={policy.isDelegated}
                  onChange={(e) => setPolicy({ ...policy, isDelegated: e.target.checked })}
                  style={{ accentColor: 'var(--accent-primary, #f59e0b)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '12px', fontWeight: 600, color: policy.isDelegated ? '#fbbf24' : 'var(--text-muted)' }}>
                  {policy.isDelegated ? 'Delegation Active' : 'Direct Founder Authority'}
                </span>
              </label>
            </div>

            {policy.isDelegated && (
              <div
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: '10px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Select Delegate
                  </label>
                  <select
                    value={policy.delegateName}
                    onChange={(e) => {
                      const name = e.target.value;
                      const role =
                        name === 'Sarah Jenkins'
                          ? 'VP of Engineering'
                          : name === 'Elena Rostova'
                          ? 'Head of People & Operations'
                          : 'Principal Architect';
                      setPolicy({ ...policy, delegateName: name, delegateRole: role });
                    }}
                    style={{
                      width: '100%',
                      marginTop: '4px',
                      padding: '8px 12px',
                      background: 'var(--surface-3)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      fontWeight: 600,
                    }}
                  >
                    <option value="Sarah Jenkins">Sarah Jenkins (VP of Engineering)</option>
                    <option value="Elena Rostova">Elena Rostova (Head of People & Operations)</option>
                    <option value="Rohan Deshmukh">Rohan Deshmukh (Principal Architect)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Delegation Authority Scope
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '6px' }}>
                    {[
                      { id: 'all', label: 'Full Authority', sub: 'All decisions' },
                      { id: 'routine_only', label: 'Routine Only', sub: 'Leaves & Punches' },
                      { id: 'no_financials', label: 'Capped Spend', sub: 'No spend > ₹50K' },
                    ].map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setPolicy({ ...policy, scope: s.id as any })}
                        style={{
                          padding: '8px',
                          borderRadius: '6px',
                          border: policy.scope === s.id ? '1px solid var(--accent-primary, #f59e0b)' : '1px solid var(--border-hairline)',
                          background: policy.scope === s.id ? 'rgba(245, 158, 11, 0.12)' : 'var(--surface-3)',
                          color: policy.scope === s.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                          textAlign: 'center',
                        }}
                      >
                        <span style={{ fontSize: '12px', fontWeight: 700 }}>{s.label}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Valid Duration
                  </label>
                  <select
                    value={policy.validUntil}
                    onChange={(e) => setPolicy({ ...policy, validUntil: e.target.value })}
                    style={{
                      width: '100%',
                      marginTop: '4px',
                      padding: '8px 12px',
                      background: 'var(--surface-3)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                    }}
                  >
                    <option value="24_hours">Next 24 Hours (OOD Single Day)</option>
                    <option value="friday">Until Friday (End of Active Workweek)</option>
                    <option value="end_of_month">Until End of Month (Payroll Close)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Smart Auto-Approval Threshold */}
          <div
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border-hairline)',
              borderRadius: '10px',
              padding: '16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
            }}
          >
            <CheckCircle2 size={20} color="var(--accent-emerald, #10b981)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Smart Auto-Approve Low-Risk Requests
                </span>
                <input
                  type="checkbox"
                  checked={policy.autoApproveLowRisk}
                  onChange={(e) => setPolicy({ ...policy, autoApproveLowRisk: e.target.checked })}
                  style={{ accentColor: 'var(--accent-emerald, #10b981)', cursor: 'pointer' }}
                />
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                When enabled, routine 1-2 day leave requests with remaining quota &ge; 8 days and 0 sprint conflict warnings will be pre-cleared to reduce executive bottleneck.
              </p>
            </div>
          </div>

          {/* Section 3: Emergency Circuit Breakers */}
          <div
            style={{
              background: policy.emergencyFreeze ? 'rgba(239, 68, 68, 0.08)' : 'var(--surface-2)',
              border: policy.emergencyFreeze ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-hairline)',
              borderRadius: '10px',
              padding: '16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
            }}
          >
            <Flame size={20} color={policy.emergencyFreeze ? '#ef4444' : '#f59e0b'} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: policy.emergencyFreeze ? '#f87171' : 'var(--text-primary)' }}>
                  Emergency Operations Freeze
                </span>
                <input
                  type="checkbox"
                  checked={policy.emergencyFreeze}
                  onChange={(e) => setPolicy({ ...policy, emergencyFreeze: e.target.checked })}
                  style={{ accentColor: '#ef4444', cursor: 'pointer' }}
                />
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Temporarily locks all unbudgeted sprint scope additions, halts new hiring requisition approvals, and freezes payroll batch modifications.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-hairline)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            background: 'var(--surface-2)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn btn-sm btn-ghost"
            style={{ padding: '8px 16px', borderRadius: '8px' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(policy);
              onClose();
            }}
            className="btn btn-sm btn-primary"
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              fontWeight: 700,
            }}
          >
            Apply Governance Policy
          </button>
        </div>
      </div>
    </div>
  );
};
