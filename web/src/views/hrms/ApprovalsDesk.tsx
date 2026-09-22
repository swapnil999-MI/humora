import React, { useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/store';
import {
  fetchCompanyLeaves,
  updateLeaveStatus,
  fetchTeamRegularizations,
  reviewRegularization,
} from '../../store/hrmsSlice';
import { addToast, navigateToPage } from '../../store/uiSlice';
import {
  ShieldCheck,
  Check,
  X,
  AlertTriangle,
  Calendar,
  Clock,
  UserCheck,
  Layers,
  History,
  CheckCircle2,
  XCircle,
  DollarSign,
  Zap,
  Users,
  MessageSquare,
  Sparkles,
  Flame,
  ShieldAlert,
  ChevronRight,
  Filter,
  ArrowRight,
  Receipt,
  FileCheck,
  Briefcase,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { FounderPulseBar } from './components/FounderPulseBar';
import { FounderDelegationModal, DelegationPolicy } from './components/FounderDelegationModal';
import { DecisionAuditLedger, AuditRecord } from './components/DecisionAuditLedger';

export type MainTab = 'inbox' | 'pulse' | 'audit' | 'governance';
export type ApprovalCategory = 'all' | 'leaves' | 'regularizations' | 'expenses' | 'sprints' | 'offers';
export type RiskLevel = 'low' | 'medium' | 'high';

interface BaseApprovalItem {
  id: string;
  category: 'leaves' | 'regularizations' | 'expenses' | 'sprints' | 'offers';
  requesterName: string;
  requesterRole: string;
  requesterAvatar?: string;
  title: string;
  submittedAt: string;
  riskLevel: RiskLevel;
  riskReason: string;
  details: React.ReactNode;
  metadata?: Record<string, any>;
}

export const ApprovalsDesk: React.FC = () => {
  const dispatch = useAppDispatch();
  const { companyLeaves, teamRegularizations, isLoading } = useAppSelector((state) => state.hrms);

  // Tabs & Navigation
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('inbox');
  const [activeCategory, setActiveCategory] = useState<ApprovalCategory>('all');
  const [riskFilter, setRiskFilter] = useState<'all' | RiskLevel>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Processing state
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeRemarkId, setActiveRemarkId] = useState<string | null>(null);
  const [customRemark, setCustomRemark] = useState<string>('');

  // Delegation Modal State
  const [isDelegationOpen, setIsDelegationOpen] = useState(false);
  const [delegationPolicy, setDelegationPolicy] = useState<DelegationPolicy>({
    isDelegated: false,
    delegateName: 'Sarah Jenkins',
    delegateRole: 'VP of Engineering',
    scope: 'routine_only',
    autoApproveLowRisk: true,
    emergencyFreeze: false,
    validUntil: 'friday',
  });

  // Local simulated records for executive domains (expenses, sprints, offers)
  const [executiveRequests, setExecutiveRequests] = useState<BaseApprovalItem[]>([
    {
      id: 'exp-1',
      category: 'expenses',
      requesterName: 'Rohan Deshmukh',
      requesterRole: 'Principal Platform Architect',
      title: 'AWS Certified Solutions Architect Pro Certification Fee',
      submittedAt: 'Today, 10:15 AM',
      riskLevel: 'low',
      riskReason: 'Pre-approved within engineering learning & development budget',
      details: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
          <div><strong>Claim Amount:</strong> ₹24,500 ($300 USD) • <em>Receipt attached</em></div>
          <div><strong>Cost Center:</strong> Engineering Platform L&D • Manager: Sarah Jenkins</div>
          <div style={{ color: 'var(--text-muted)' }}>Exam scheduled for October 2nd. Boosts enterprise compliance credentials.</div>
        </div>
      ),
    },
    {
      id: 'exp-2',
      category: 'expenses',
      requesterName: 'Sarah Jenkins',
      requesterRole: 'VP of Engineering',
      title: 'Q3 All-Hands Engineering Offsite & Hackathon Venue',
      submittedAt: 'Yesterday, 16:40',
      riskLevel: 'high',
      riskReason: 'High single expenditure requiring Founder co-signature (>₹50,000)',
      details: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
          <div><strong>Claim Amount:</strong> ₹68,500 • <em>Advance Venue Deposit</em></div>
          <div><strong>Event Dates:</strong> October 14-15 (45 attendees)</div>
          <div><strong>Budget Line:</strong> People & Culture Q3 All-Hands Pool (Balance remaining: ₹1,20,000)</div>
        </div>
      ),
    },
    {
      id: 'spr-1',
      category: 'sprints',
      requesterName: 'Sarah Jenkins',
      requesterRole: 'VP of Engineering',
      title: 'Add WebAuthn Biometric Liveness to Active Sprint 24',
      submittedAt: 'Today, 09:30 AM',
      riskLevel: 'medium',
      riskReason: 'Mid-sprint scope injection (+8 Story Points) with release timeline impact',
      details: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
          <div><strong>Target Sprint:</strong> Sprint 24 (Ends Friday) • Impact: +8 pts</div>
          <div><strong>Justification:</strong> Client Enterprise Security Audit requirement for SOC2 compliance.</div>
          <div><strong>Team Capacity:</strong> Devs have 12 buffer hours allocated. No delivery delay projected.</div>
        </div>
      ),
    },
    {
      id: 'off-1',
      category: 'offers',
      requesterName: 'Elena Rostova',
      requesterRole: 'Head of People & Talent',
      title: 'Staff Distributed Systems Engineer — Priya Sharma',
      submittedAt: 'Yesterday, 11:20',
      riskLevel: 'high',
      riskReason: 'Senior Leadership Band CTC + Equity grant exceeding standard hiring band',
      details: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
          <div><strong>Proposed Compensation:</strong> ₹42,00,000 CTC + ₹4,00,000 Joining Bonus</div>
          <div><strong>Equity:</strong> 0.15% ESOPs over 4-year vesting schedule (1-year cliff)</div>
          <div><strong>Interview Score:</strong> 4.9/5.0 (Strong Hire across all 4 technical bars)</div>
        </div>
      ),
    },
  ]);

  // Initial audit records ledger
  const [auditLedger, setAuditLedger] = useState<AuditRecord[]>([
    {
      id: 'aud-1',
      category: 'leaves',
      title: 'Casual Leave • 2 Days',
      requesterName: 'Alex Rivera',
      requesterRole: 'DevOps Lead',
      details: 'Personal family travel • Sep 18 - Sep 19',
      outcome: 'approved',
      decidedBy: 'Founder (Direct)',
      decidedAt: 'Sep 17, 14:22',
      remarks: 'Approved. Backup on-call assigned to Rohan.',
    },
    {
      id: 'aud-2',
      category: 'regularizations',
      title: 'Missed In-Punch Reconciled',
      requesterName: 'Neha Patel',
      requesterRole: 'Frontend Developer',
      details: 'Biometric device offline during morning shift at 09:30 AM',
      outcome: 'approved',
      decidedBy: 'Sarah Jenkins (Delegate)',
      decidedAt: 'Sep 19, 10:15',
      remarks: 'Biometric turnstile log verified.',
    },
    {
      id: 'aud-3',
      category: 'expenses',
      title: 'Datadog APM Monthly Overage Claim',
      requesterName: 'Alex Rivera',
      requesterRole: 'DevOps Lead',
      details: '₹32,000 infrastructure overage charge',
      outcome: 'approved',
      decidedBy: 'Founder (Direct)',
      decidedAt: 'Sep 20, 16:50',
      remarks: 'Approved per AWS traffic switch spike.',
    },
  ]);

  useEffect(() => {
    dispatch(fetchCompanyLeaves());
    dispatch(fetchTeamRegularizations());
  }, [dispatch]);

  // Transform Pending Leaves to Unified Format
  const pendingLeaves = useMemo(() => {
    return companyLeaves.filter((l) => l.status === 'pending');
  }, [companyLeaves]);

  // Overlap Detection for leaves
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

  // Pending Regularizations
  const pendingRegularizations = useMemo(() => {
    return (teamRegularizations || []).filter((r) => r.status === 'pending');
  }, [teamRegularizations]);

  // Convert HRMS Leaves to unified BaseApprovalItem
  const unifiedLeaves: BaseApprovalItem[] = useMemo(() => {
    return pendingLeaves.map((l) => {
      const hasConflict = overlaps.some((o) => o.req1 === l.id || o.req2 === l.id);
      const isLong = (l.total_days || 1) > 3;
      const riskLevel: RiskLevel = hasConflict || isLong ? 'high' : (l.total_days || 1) >= 2 ? 'medium' : 'low';
      const riskReason = hasConflict
        ? 'Overlap detected with another team member in the same period'
        : isLong
        ? 'Extended absence (>3 days) impacting sprint delivery'
        : 'Standard time-off with healthy leave quota balance';

      const leaveTypeName = l.leave_type_name || 'Time-Off';
      const days = l.total_days || 1;

      return {
        id: l.id,
        category: 'leaves',
        requesterName: l.employee_name || 'Team Member',
        requesterRole: 'Engineering',
        title: `${leaveTypeName.toUpperCase()} Request • ${days} ${days === 1 ? 'Day' : 'Days'}`,
        submittedAt: new Date(l.created_at || Date.now()).toLocaleDateString(),
        riskLevel,
        riskReason,
        details: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
            <div>
              <strong>Dates:</strong> {new Date(l.from_date).toLocaleDateString()} &rarr; {new Date(l.to_date).toLocaleDateString()}
            </div>
            <div>
              <strong>Reason:</strong> <em>"{l.reason || 'Personal time-off'}"</em>
            </div>
            {hasConflict && (
              <div style={{ color: '#fbbf24', fontWeight: 600 }}>
                ⚠️ Overlap Alert: Another engineer is scheduled off during this window.
              </div>
            )}
          </div>
        ),
      };
    });
  }, [pendingLeaves, overlaps]);

  // Convert HRMS Regularizations to unified BaseApprovalItem
  const unifiedRegularizations: BaseApprovalItem[] = useMemo(() => {
    return pendingRegularizations.map((r) => {
      const riskLevel: RiskLevel = 'low';
      const riskReason = 'Routine biometric correction verified against workstation shift log';
      const punchType = r.requested_punch_in ? 'Check-In' : r.requested_punch_out ? 'Check-Out' : 'Shift';

      return {
        id: r.id,
        category: 'regularizations',
        requesterName: r.employee_name || 'Team Member',
        requesterRole: 'Product & Operations',
        title: `Attendance Regularization • ${punchType} Missed`,
        submittedAt: r.request_date || r.created_at || 'Recent',
        riskLevel,
        riskReason,
        details: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
            <div>
              <strong>Scheduled Shift:</strong> {r.request_date} (General Shift: 09:00 AM - 06:00 PM)
            </div>
            <div>
              <strong>Requested Punch:</strong> {r.requested_punch_in || r.requested_punch_out || '09:15 AM'}
            </div>
            <div>
              <strong>Employee Reason:</strong> <em>"{r.reason || 'Biometric hardware reader sync delay'}"</em>
            </div>
            <div style={{ color: 'var(--accent-emerald, #10b981)', fontWeight: 600 }}>
              Biometric Liveness Match: 98.4% Confidence Score
            </div>
          </div>
        ),
      };
    });
  }, [pendingRegularizations]);

  // Combine all active pending items
  const allPendingItems = useMemo(() => {
    return [...unifiedLeaves, ...unifiedRegularizations, ...executiveRequests];
  }, [unifiedLeaves, unifiedRegularizations, executiveRequests]);

  // Filter by category, risk, and search
  const filteredItems = useMemo(() => {
    return allPendingItems.filter((item) => {
      const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
      const matchesRisk = riskFilter === 'all' || item.riskLevel === riskFilter;
      const matchesSearch =
        item.requesterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.riskReason.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCategory && matchesRisk && matchesSearch;
    });
  }, [allPendingItems, activeCategory, riskFilter, searchQuery]);

  // Counts for pulse metrics
  const highRiskCount = useMemo(() => allPendingItems.filter((i) => i.riskLevel === 'high').length, [allPendingItems]);
  const lowRiskCount = useMemo(() => allPendingItems.filter((i) => i.riskLevel === 'low').length, [allPendingItems]);

  // Individual Actions
  const handleApproveItem = async (item: BaseApprovalItem, remarks: string = '') => {
    setProcessingId(item.id);
    const remarkText = remarks || customRemark || 'Approved by Founder';

    try {
      if (item.category === 'leaves') {
        await dispatch(updateLeaveStatus({ requestId: item.id, status: 'approved' })).unwrap();
      } else if (item.category === 'regularizations') {
        await dispatch(reviewRegularization({ id: item.id, status: 'approved' })).unwrap();
      } else {
        // Executive items
        setExecutiveRequests((prev) => prev.filter((r) => r.id !== item.id));
      }

      // Add to audit ledger
      const newAudit: AuditRecord = {
        id: `aud-${Date.now()}`,
        category: item.category,
        title: item.title,
        requesterName: item.requesterName,
        requesterRole: item.requesterRole,
        details: item.riskReason,
        outcome: 'approved',
        decidedBy: delegationPolicy.isDelegated ? `${delegationPolicy.delegateName} (Delegate)` : 'Founder (Direct)',
        decidedAt: 'Just now',
        remarks: remarkText,
      };
      setAuditLedger((prev) => [newAudit, ...prev]);

      dispatch(
        addToast({
          type: 'success',
          message: `Approved ${item.title} for ${item.requesterName}.`,
        })
      );
    } catch (err: any) {
      dispatch(addToast({ type: 'error', message: err || 'Approval failed' }));
    } finally {
      setProcessingId(null);
      setActiveRemarkId(null);
      setCustomRemark('');
    }
  };

  const handleRejectItem = async (item: BaseApprovalItem, remarks: string = '') => {
    setProcessingId(item.id);
    const remarkText = remarks || customRemark || 'Declined by Founder';

    try {
      if (item.category === 'leaves') {
        await dispatch(updateLeaveStatus({ requestId: item.id, status: 'rejected' })).unwrap();
      } else if (item.category === 'regularizations') {
        await dispatch(reviewRegularization({ id: item.id, status: 'rejected' })).unwrap();
      } else {
        // Executive items
        setExecutiveRequests((prev) => prev.filter((r) => r.id !== item.id));
      }

      // Add to audit ledger
      const newAudit: AuditRecord = {
        id: `aud-${Date.now()}`,
        category: item.category,
        title: item.title,
        requesterName: item.requesterName,
        requesterRole: item.requesterRole,
        details: item.riskReason,
        outcome: 'rejected',
        decidedBy: delegationPolicy.isDelegated ? `${delegationPolicy.delegateName} (Delegate)` : 'Founder (Direct)',
        decidedAt: 'Just now',
        remarks: remarkText,
      };
      setAuditLedger((prev) => [newAudit, ...prev]);

      dispatch(
        addToast({
          type: 'info',
          message: `Declined ${item.title}. Audit record preserved.`,
        })
      );
    } catch (err: any) {
      dispatch(addToast({ type: 'error', message: err || 'Rejection failed' }));
    } finally {
      setProcessingId(null);
      setActiveRemarkId(null);
      setCustomRemark('');
    }
  };

  // High-Velocity: Approve All Low-Risk
  const handleApproveAllLowRisk = async () => {
    const lowRiskItems = allPendingItems.filter((i) => i.riskLevel === 'low');
    if (lowRiskItems.length === 0) {
      dispatch(addToast({ type: 'info', message: 'No low-risk items pending sign-off.' }));
      return;
    }

    setProcessingId('bulk');
    for (const item of lowRiskItems) {
      if (item.category === 'leaves') {
        try {
          await dispatch(updateLeaveStatus({ requestId: item.id, status: 'approved' })).unwrap();
        } catch (_) {}
      } else if (item.category === 'regularizations') {
        try {
          await dispatch(reviewRegularization({ id: item.id, status: 'approved' })).unwrap();
        } catch (_) {}
      } else {
        setExecutiveRequests((prev) => prev.filter((r) => r.id !== item.id));
      }

      // Log to audit
      setAuditLedger((prev) => [
        {
          id: `aud-${Date.now()}-${item.id}`,
          category: item.category,
          title: item.title,
          requesterName: item.requesterName,
          requesterRole: item.requesterRole,
          details: item.riskReason,
          outcome: 'approved',
          decidedBy: 'Founder (Batch Quick-Pass)',
          decidedAt: 'Just now',
          remarks: 'Automated 1-click low-risk executive sign-off.',
        },
        ...prev,
      ]);
    }

    setProcessingId(null);
    dispatch(
      addToast({
        type: 'success',
        message: `⚡ Batch cleared ${lowRiskItems.length} low-risk approvals in one click.`,
      })
    );
  };

  // Direct Jump to TeamPulse to discuss
  const handleDiscussInChat = (requesterName: string, title: string) => {
    dispatch(navigateToPage('pulse'));
    dispatch(
      addToast({
        type: 'info',
        message: `Opening TeamPulse conversation regarding: ${title}`,
      })
    );
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1360px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ========================================================================= */}
      {/* 1. EXECUTIVE CONSOLE HEADER & FOUNDER STATUS BANNER                        */}
      {/* ========================================================================= */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--surface-1) 0%, var(--surface-2) 100%)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl, 16px)',
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: 'var(--shadow-md)',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(217, 119, 6, 0.15) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary, #f59e0b)',
                boxShadow: '0 2px 10px rgba(245, 158, 11, 0.2)',
              }}
            >
              <ShieldCheck size={26} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
                  Founder Management & Approvals Console
                </h1>
                <span
                  style={{
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#fbbf24',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Executive Suite
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                High-velocity executive command center for cross-departmental approvals, runway liabilities, and company operations.
              </p>
            </div>
          </div>

          {/* Quick Authority & Governance Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Delegation Button */}
            <button
              onClick={() => setIsDelegationOpen(true)}
              style={{
                background: delegationPolicy.isDelegated ? 'rgba(245, 158, 11, 0.15)' : 'var(--surface-3)',
                border: delegationPolicy.isDelegated ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-hairline)',
                borderRadius: '8px',
                padding: '8px 14px',
                color: delegationPolicy.isDelegated ? '#fbbf24' : 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              <ShieldAlert size={15} />
              <span>
                {delegationPolicy.isDelegated
                  ? `Delegate Active: ${delegationPolicy.delegateName}`
                  : 'Configure Delegation'}
              </span>
            </button>

            {/* Quick-Pass Low-Risk Button */}
            {lowRiskCount > 0 && (
              <button
                onClick={handleApproveAllLowRisk}
                disabled={processingId === 'bulk'}
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.25) 100%)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  color: '#34d399',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.15)',
                }}
              >
                <Sparkles size={14} />
                <span>⚡ Approve All Low-Risk ({lowRiskCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Emergency Freeze Alert Banner */}
        {delegationPolicy.emergencyFreeze && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '8px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#f87171',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <Flame size={16} />
            <span>
              <strong>EMERGENCY OPERATIONS FREEZE ENGAGED:</strong> Unbudgeted scope additions, out-of-band expense claims, and hiring requisition approvals are locked.
            </span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. COMPANY VITAL SIGNS & PULSE BAR                                        */}
        {/* ========================================================================= */}
        <FounderPulseBar
          pendingCount={allPendingItems.length}
          highRiskCount={highRiskCount}
          lowRiskCount={lowRiskCount}
          onFilterHighRisk={() => {
            setActiveMainTab('inbox');
            setRiskFilter('high');
          }}
          onFilterLowRisk={() => {
            setActiveMainTab('inbox');
            setRiskFilter('low');
          }}
        />
      </div>

      {/* ========================================================================= */}
      {/* 3. PRIMARY EXECUTIVE TAB NAVIGATION                                       */}
      {/* ========================================================================= */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-hairline)',
          paddingBottom: '4px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveMainTab('inbox')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeMainTab === 'inbox' ? 'var(--surface-3)' : 'transparent',
              color: activeMainTab === 'inbox' ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: activeMainTab === 'inbox' ? '2px solid var(--accent-primary, #f59e0b)' : '2px solid transparent',
            }}
          >
            <span>Decision Inbox</span>
            {allPendingItems.length > 0 && (
              <span
                style={{
                  background: 'var(--accent-primary, #f59e0b)',
                  color: '#000',
                  padding: '1px 7px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 800,
                }}
              >
                {allPendingItems.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('pulse')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeMainTab === 'pulse' ? 'var(--surface-3)' : 'transparent',
              color: activeMainTab === 'pulse' ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: activeMainTab === 'pulse' ? '2px solid var(--accent-primary, #f59e0b)' : '2px solid transparent',
            }}
          >
            <Zap size={14} />
            <span>Company Vitals & Runway</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('audit')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeMainTab === 'audit' ? 'var(--surface-3)' : 'transparent',
              color: activeMainTab === 'audit' ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: activeMainTab === 'audit' ? '2px solid var(--accent-primary, #f59e0b)' : '2px solid transparent',
            }}
          >
            <History size={14} />
            <span>Decision Audit Ledger</span>
            <span
              style={{
                background: 'var(--surface-4)',
                color: 'var(--text-muted)',
                padding: '1px 6px',
                borderRadius: '8px',
                fontSize: '10px',
              }}
            >
              {auditLedger.length}
            </span>
          </button>
        </div>

        {/* Search Bar for Inbox */}
        {activeMainTab === 'inbox' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="text"
              placeholder="Search by requester or ticket..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '6px 12px',
                background: 'var(--surface-1)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '12px',
                outline: 'none',
                width: '240px',
              }}
            />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. TAB 1: DECISION INBOX                                                  */}
      {/* ========================================================================= */}
      {activeMainTab === 'inbox' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Category & Risk Filter Strip */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            {/* Category Selector */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'All Items', count: allPendingItems.length, icon: ShieldCheck },
                { id: 'leaves', label: 'Leaves & Time-Off', count: unifiedLeaves.length, icon: Calendar },
                { id: 'regularizations', label: 'Biometrics', count: unifiedRegularizations.length, icon: Clock },
                { id: 'expenses', label: 'Payroll & Expenses', count: executiveRequests.filter((e) => e.category === 'expenses').length, icon: DollarSign },
                { id: 'sprints', label: 'Sprint Scope', count: executiveRequests.filter((e) => e.category === 'sprints').length, icon: Zap },
                { id: 'offers', label: 'Hiring Offers', count: executiveRequests.filter((e) => e.category === 'offers').length, icon: Users },
              ].map((c) => {
                const Icon = c.icon;
                const isActive = activeCategory === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveCategory(c.id as any)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: isActive ? '1px solid var(--accent-primary, #f59e0b)' : '1px solid var(--border-hairline)',
                      background: isActive ? 'rgba(245, 158, 11, 0.12)' : 'var(--surface-1)',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Icon size={13} color={isActive ? 'var(--accent-primary, #f59e0b)' : 'var(--text-muted)'} />
                    <span>{c.label}</span>
                    <span
                      style={{
                        background: isActive ? 'var(--accent-primary, #f59e0b)' : 'var(--surface-3)',
                        color: isActive ? '#000' : 'var(--text-muted)',
                        padding: '1px 5px',
                        borderRadius: '6px',
                        fontSize: '10px',
                        fontWeight: 700,
                      }}
                    >
                      {c.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Risk Filter Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Risk Tier:</span>
              {(['all', 'high', 'medium', 'low'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRiskFilter(r)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                    background: riskFilter === r ? 'var(--surface-3)' : 'transparent',
                    color:
                      riskFilter === r
                        ? r === 'high'
                          ? '#f87171'
                          : r === 'low'
                          ? '#34d399'
                          : '#fbbf24'
                        : 'var(--text-muted)',
                  }}
                >
                  {r === 'all' ? 'All' : `${r} Risk`}
                </button>
              ))}
            </div>
          </div>

          {/* Cards List */}
          {filteredItems.length === 0 ? (
            <div
              style={{
                background: 'var(--surface-1)',
                borderRadius: 'var(--radius-lg, 12px)',
                border: '1px solid var(--border-hairline)',
                padding: '64px 20px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <UserCheck size={44} color="var(--accent-emerald, #10b981)" style={{ opacity: 0.8 }} />
              <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
                Executive Decision Queue Clear
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '400px' }}>
                All pending items across the selected category and risk filter have been reviewed and reconciled.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {filteredItems.map((item) => {
                const isProcessing = processingId === item.id;
                const isRemarkOpen = activeRemarkId === item.id;

                const getRiskBadge = (risk: RiskLevel) => {
                  switch (risk) {
                    case 'high':
                      return (
                        <span
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <AlertCircle size={11} /> High Risk
                        </span>
                      );
                    case 'medium':
                      return (
                        <span
                          style={{
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#fbbf24',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <AlertTriangle size={11} /> Medium Risk
                        </span>
                      );
                    case 'low':
                      return (
                        <span
                          style={{
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#34d399',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <CheckCircle2 size={11} /> Quick Pass
                        </span>
                      );
                  }
                };

                return (
                  <div
                    key={item.id}
                    style={{
                      background: 'var(--surface-1)',
                      borderRadius: 'var(--radius-lg, 12px)',
                      border: '1px solid var(--border-subtle)',
                      padding: '20px 24px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'border-color 0.15s ease',
                      borderLeft:
                        item.riskLevel === 'high'
                          ? '3px solid #ef4444'
                          : item.riskLevel === 'medium'
                          ? '3px solid #f59e0b'
                          : '3px solid var(--accent-emerald, #10b981)',
                    }}
                  >
                    {/* Top Row: Requester & Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            background: 'var(--surface-3)',
                            border: '1px solid var(--border-hairline)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '13px',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {item.requesterName.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {item.requesterName}
                            </span>
                            <span
                              style={{
                                background: 'var(--surface-3)',
                                color: 'var(--text-muted)',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                              }}
                            >
                              {item.requesterRole}
                            </span>
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Submitted {item.submittedAt}
                          </span>
                        </div>
                      </div>

                      {/* Right Badges */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {getRiskBadge(item.riskLevel)}
                        <span
                          style={{
                            background: 'var(--surface-2)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-hairline)',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                            textTransform: 'capitalize',
                          }}
                        >
                          {item.category}
                        </span>
                      </div>
                    </div>

                    {/* Middle Row: Title & Details */}
                    <div
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border-hairline)',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {item.title}
                      </div>

                      {item.details}

                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-hairline)', paddingTop: '6px', marginTop: '2px' }}>
                        <strong>Risk Profiling:</strong> {item.riskReason}
                      </div>
                    </div>

                    {/* Optional Custom Remark Drawer */}
                    {isRemarkOpen && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--surface-3)', padding: '10px 14px', borderRadius: '8px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
                          Founder Note (Optional Remark to Requester & Audit Log):
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Approved per Q3 plan, keep up the velocity!"
                          value={customRemark}
                          onChange={(e) => setCustomRemark(e.target.value)}
                          style={{
                            padding: '6px 10px',
                            background: 'var(--surface-1)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '6px',
                            color: 'var(--text-primary)',
                            fontSize: '12px',
                          }}
                        />
                        {/* Preset Quick Remarks */}
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {[
                            'Approved per Q3 roadmap.',
                            'Approved. Great work team!',
                            'Approved with budget cap.',
                            'Declined: Please reschedule post-sprint.',
                          ].map((pre) => (
                            <button
                              key={pre}
                              type="button"
                              onClick={() => setCustomRemark(pre)}
                              style={{
                                background: 'var(--surface-2)',
                                border: '1px solid var(--border-hairline)',
                                borderRadius: '4px',
                                padding: '2px 8px',
                                fontSize: '10px',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                              }}
                            >
                              + "{pre}"
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bottom Row: Actions Strip */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', paddingTop: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setActiveRemarkId(isRemarkOpen ? null : item.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <FileCheck size={13} />
                          <span>{isRemarkOpen ? 'Hide Note Box' : '+ Add Decision Note'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDiscussInChat(item.requesterName, item.title)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--accent-primary, #f59e0b)',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <MessageSquare size={13} />
                          <span>Discuss in TeamPulse</span>
                        </button>
                      </div>

                      {/* Primary Decision Buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleRejectItem(item)}
                          disabled={isProcessing}
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '8px',
                            padding: '6px 14px',
                            color: '#f87171',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          <X size={14} />
                          <span>Decline</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleApproveItem(item)}
                          disabled={isProcessing}
                          style={{
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(5, 150, 105, 0.35) 100%)',
                            border: '1px solid rgba(16, 185, 129, 0.5)',
                            borderRadius: '8px',
                            padding: '6px 18px',
                            color: '#34d399',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 1px 6px rgba(16, 185, 129, 0.2)',
                          }}
                        >
                          <Check size={14} strokeWidth={3} />
                          <span>Approve</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TAB 2: COMPANY VITALS & RUNWAY HEALTH                                  */}
      {/* ========================================================================= */}
      {activeMainTab === 'pulse' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg, 12px)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Executive Runway, Payroll & Capacity Forecast
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
              Cross-domain analysis linking biometric shift attendance, statutory salary liabilities, and agile story point burn.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '8px' }}>
              <div style={{ background: 'var(--surface-2)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-hairline)' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Payroll Reserve Status
                </span>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                  18.4 Months Runway
                </div>
                <div style={{ fontSize: '12px', color: 'var(--accent-emerald, #10b981)', marginTop: '4px' }}>
                  Healthy cash buffer covering 48 FTEs + Q4 projected hiring.
                </div>
              </div>

              <div style={{ background: 'var(--surface-2)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-hairline)' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Attendance-to-Worklog Sync
                </span>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                  94.2% Reconciled
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Biometric attendance shifts match ticket sprint hours with &lt; 0.6h average variance.
                </div>
              </div>

              <div style={{ background: 'var(--surface-2)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-hairline)' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Sprint Capacity Allocation
                </span>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                  82% Core Features
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  12% Tech Debt &bull; 6% Production Support & Monitoring.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. TAB 3: DECISION AUDIT LEDGER                                           */}
      {/* ========================================================================= */}
      {activeMainTab === 'audit' && (
        <DecisionAuditLedger records={auditLedger} />
      )}

      {/* ========================================================================= */}
      {/* 7. FOUNDER DELEGATION MODAL                                               */}
      {/* ========================================================================= */}
      <FounderDelegationModal
        isOpen={isDelegationOpen}
        onClose={() => setIsDelegationOpen(false)}
        currentPolicy={delegationPolicy}
        onSave={(newPolicy) => {
          setDelegationPolicy(newPolicy);
          dispatch(
            addToast({
              type: 'success',
              message: newPolicy.isDelegated
                ? `Delegation granted to ${newPolicy.delegateName}.`
                : 'Direct Founder authority re-engaged.',
            })
          );
        }}
      />
    </div>
  );
};

export default ApprovalsDesk;
