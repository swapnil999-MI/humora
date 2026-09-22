import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Calendar,
  Clock,
  DollarSign,
  Zap,
  Users,
  FileText,
  ShieldCheck,
} from 'lucide-react';

export interface AuditRecord {
  id: string;
  category: 'leaves' | 'regularizations' | 'expenses' | 'sprints' | 'offers';
  title: string;
  requesterName: string;
  requesterRole: string;
  requesterAvatar?: string;
  details: string;
  amountOrMetric?: string;
  outcome: 'approved' | 'rejected';
  decidedBy: string;
  decidedAt: string;
  remarks: string;
}

interface DecisionAuditLedgerProps {
  records: AuditRecord[];
}

export const DecisionAuditLedger: React.FC<DecisionAuditLedgerProps> = ({ records }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'approved' | 'rejected'>('all');

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchesSearch =
        r.requesterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.remarks.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = categoryFilter === 'all' || r.category === categoryFilter;
      const matchesOutcome = outcomeFilter === 'all' || r.outcome === outcomeFilter;

      return matchesSearch && matchesCategory && matchesOutcome;
    });
  }, [records, searchQuery, categoryFilter, outcomeFilter]);

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'leaves':
        return <Calendar size={13} color="var(--accent-primary, #f59e0b)" />;
      case 'regularizations':
        return <Clock size={13} color="#60a5fa" />;
      case 'expenses':
        return <DollarSign size={13} color="var(--accent-emerald, #10b981)" />;
      case 'sprints':
        return <Zap size={13} color="#fbbf24" />;
      case 'offers':
        return <Users size={13} color="#a855f7" />;
      default:
        return <FileText size={13} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Search & Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          background: 'var(--surface-1)',
          border: '1px solid var(--border-hairline)',
          borderRadius: 'var(--radius-lg, 12px)',
          padding: '12px 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 280px', maxWidth: '420px', position: 'relative' }}>
          <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '10px' }} />
          <input
            type="text"
            placeholder="Search decisions by requester, role, or remarks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              padding: '7px 12px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <option value="all">All Categories</option>
            <option value="leaves">Leaves & Time-Off</option>
            <option value="regularizations">Biometric Exceptions</option>
            <option value="expenses">Payroll & Expenses</option>
            <option value="sprints">Sprint Scope</option>
            <option value="offers">Hiring & Offers</option>
          </select>

          {/* Outcome Filter Pills */}
          <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: '8px', padding: '3px', border: '1px solid var(--border-subtle)' }}>
            {(['all', 'approved', 'rejected'] as const).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOutcomeFilter(o)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  background: outcomeFilter === o ? 'var(--surface-4)' : 'transparent',
                  color:
                    outcomeFilter === o
                      ? '#ffffff'
                      : 'var(--text-secondary)',
                }}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border-hairline)',
          borderRadius: 'var(--radius-lg, 12px)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr
                style={{
                  background: 'var(--surface-2)',
                  borderBottom: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                <th style={{ padding: '12px 18px' }}>Requester</th>
                <th style={{ padding: '12px 14px' }}>Category</th>
                <th style={{ padding: '12px 14px' }}>Item Summary</th>
                <th style={{ padding: '12px 14px' }}>Decision</th>
                <th style={{ padding: '12px 14px' }}>Authority</th>
                <th style={{ padding: '12px 14px' }}>Timestamp</th>
                <th style={{ padding: '12px 18px' }}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No audit records match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom: '1px solid var(--border-hairline)',
                      transition: 'background 0.1s ease',
                    }}
                  >
                    {/* Requester */}
                    <td style={{ padding: '12px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            background: 'var(--surface-3)',
                            border: '1px solid var(--border-hairline)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {r.requesterName.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.requesterName}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.requesterRole}</div>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td style={{ padding: '12px 14px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'var(--surface-2)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 600,
                          textTransform: 'capitalize',
                        }}
                      >
                        {getCategoryIcon(r.category)}
                        <span>{r.category}</span>
                      </span>
                    </td>

                    {/* Summary */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.details}</div>
                    </td>

                    {/* Decision Outcome */}
                    <td style={{ padding: '12px 14px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background:
                            r.outcome === 'approved'
                              ? 'rgba(16, 185, 129, 0.12)'
                              : 'rgba(239, 68, 68, 0.12)',
                          color:
                            r.outcome === 'approved'
                              ? 'var(--accent-emerald, #10b981)'
                              : '#f87171',
                          border:
                            r.outcome === 'approved'
                              ? '1px solid rgba(16, 185, 129, 0.25)'
                              : '1px solid rgba(239, 68, 68, 0.25)',
                        }}
                      >
                        {r.outcome === 'approved' ? (
                          <CheckCircle2 size={12} />
                        ) : (
                          <XCircle size={12} />
                        )}
                        <span>{r.outcome.toUpperCase()}</span>
                      </span>
                    </td>

                    {/* Decided By */}
                    <td style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <span style={{ fontWeight: 600 }}>{r.decidedBy}</span>
                    </td>

                    {/* Timestamp */}
                    <td style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {r.decidedAt}
                    </td>

                    {/* Remarks */}
                    <td style={{ padding: '12px 18px', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', maxWidth: '240px' }}>
                      "{r.remarks || 'No notes provided'}"
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
