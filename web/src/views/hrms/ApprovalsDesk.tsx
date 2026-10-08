import React, { useEffect, useMemo, useState } from 'react';
import {
  useAppDispatch,
  useAppSelector,
} from '../../store/store';
import {
  fetchCompanyLeaves,
  updateLeaveStatus,
  fetchTeamRegularizations,
  reviewRegularization,
} from '../../store/hrmsSlice';
import {
  addToast,
  navigateToPage,
} from '../../store/uiSlice';
import {
  ShieldCheck,
  Check,
  X,
  AlertTriangle,
  Calendar,
  Clock,
  UserCheck,
  History,
  CheckCircle2,
  DollarSign,
  Users,
  MessageSquare,
  Sparkles,
  FileCheck,
  AlertCircle,
} from 'lucide-react';
import {
  FounderPulseBar,
} from './components/FounderPulseBar';
import {
  api,
} from '../../api/client';
import type { OnboardingCandidate, ReimbursementClaim } from '../../types';
import {
  DecisionAuditLedger,
  AuditRecord,
} from './components/DecisionAuditLedger';

export type MainTab = 'inbox' | 'audit';
export type ApprovalCategory = 'all' | 'leaves' | 'regularizations' | 'expenses' | 'offers';
export type RiskLevel = 'low' | 'medium' | 'high';

interface BaseApprovalItem {
  id: string;
  category: 'leaves' | 'regularizations' | 'expenses' | 'offers';
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


  // Expense claims awaiting review, and candidates who submitted their onboarding dossier.
  const [teamClaims, setTeamClaims] = useState<(ReimbursementClaim & { employee_name?: string })[]>([]);
  const [submittedCandidates, setSubmittedCandidates] = useState<OnboardingCandidate[]>([]);

  // Decisions taken in this console during this session (the server keeps each request's final status).
  const [auditLedger, setAuditLedger] = useState<AuditRecord[]>([]);

  const loadClaims = async () => {
    try {
      setTeamClaims((await api.get<(ReimbursementClaim & { employee_name?: string })[]>('/hrms/payroll/reimbursements/team?status=pending')) || []);
    } catch {
      setTeamClaims([]);
    }
  };
  const loadCandidates = async () => {
    try {
      const all = (await api.get<OnboardingCandidate[]>('/hrms/onboarding/pipeline')) || [];
      setSubmittedCandidates(all.filter((c) => c.status === 'submitted'));
    } catch {
      setSubmittedCandidates([]);
    }
  };

  useEffect(() => {
    dispatch(fetchCompanyLeaves());
    dispatch(fetchTeamRegularizations());
    void loadClaims();
    void loadCandidates();
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
        requesterRole: '',
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
              <strong>Reason:</strong> <em>{l.reason ? `"${l.reason}"` : 'No reason given'}</em>
            </div>
            {hasConflict && (
              <div style={{ color: '#fbbf24', fontWeight: 600 }}>
                ⚠️ Overlap: someone else is also off during this period.
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
      // Nothing about a correction is verified automatically, so it always needs a human check.
      const riskLevel: RiskLevel = 'medium';
      const riskReason = 'Check the requested time against the shift roster before approving';
      const punchType = r.requested_punch_in ? 'Check-In' : r.requested_punch_out ? 'Check-Out' : 'Shift';

      return {
        id: r.id,
        category: 'regularizations',
        requesterName: r.employee_name || 'Team Member',
        requesterRole: '',
        title: `Attendance Regularization • ${punchType} Missed`,
        submittedAt: r.request_date || r.created_at || 'Recent',
        riskLevel,
        riskReason,
        details: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
            <div>
              <strong>Requested Punch:</strong> {r.requested_punch_in || r.requested_punch_out || 'Not specified'}
            </div>
            <div>
              <strong>Employee Reason:</strong> <em>{r.reason ? `"${r.reason}"` : 'No reason given'}</em>
            </div>
          </div>
        ),
      };
    });
  }, [pendingRegularizations]);

  const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

  // Expense claims: risk from the amount (single claims above ₹50,000 need a closer look).
  const unifiedExpenses: BaseApprovalItem[] = useMemo(() => {
    return teamClaims.map((c) => {
      const riskLevel: RiskLevel = c.amount > 50000 ? 'high' : c.amount > 10000 ? 'medium' : 'low';
      return {
        id: c.id,
        category: 'expenses',
        requesterName: c.employee_name || 'Employee',
        requesterRole: '',
        title: `${c.category_name || c.category} • ${inr(c.amount)}`,
        submittedAt: new Date(c.created_at).toLocaleDateString(),
        riskLevel,
        riskReason: riskLevel === 'high' ? 'Large single claim (over ₹50,000)' : riskLevel === 'medium' ? 'Claim over ₹10,000' : 'Small claim',
        details: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
            <div><strong>Merchant:</strong> {c.merchant_name}{c.bill_number ? ` • Bill ${c.bill_number}` : ''}</div>
            <div><strong>Bill date:</strong> {new Date(c.bill_date).toLocaleDateString()}</div>
            {c.description && <div><strong>Description:</strong> <em>{c.description}</em></div>}
            {c.receipt_url && (
              <div><a href={c.receipt_url} target="_blank" rel="noreferrer">View receipt</a></div>
            )}
          </div>
        ),
      };
    });
  }, [teamClaims]);

  // Candidates who submitted their onboarding dossier: hiring decisions are always reviewed in full.
  const unifiedOffers: BaseApprovalItem[] = useMemo(() => {
    return submittedCandidates.map((c) => ({
      id: c.id,
      category: 'offers',
      requesterName: `${c.first_name} ${c.last_name}`.trim(),
      requesterRole: c.designation_title || '',
      title: `Onboarding dossier submitted${c.designation_title ? ` • ${c.designation_title}` : ''}`,
      submittedAt: new Date(c.submitted_at || c.created_at).toLocaleDateString(),
      riskLevel: 'high' as RiskLevel,
      riskReason: 'Hiring decision: review the full dossier in Onboarding',
      details: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
          <div><strong>Joining:</strong> {new Date(c.expected_joining_date).toLocaleDateString()} • {c.employment_type}</div>
          {c.department_name && <div><strong>Department:</strong> {c.department_name}</div>}
          {c.annual_ctc ? <div><strong>Annual CTC:</strong> {inr(c.annual_ctc)}</div> : null}
        </div>
      ),
    }));
  }, [submittedCandidates]);

  // Combine all active pending items
  const allPendingItems = useMemo(() => {
    return [...unifiedLeaves, ...unifiedRegularizations, ...unifiedExpenses, ...unifiedOffers];
  }, [unifiedLeaves, unifiedRegularizations, unifiedExpenses, unifiedOffers]);

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
    const remarkText = remarks || customRemark || '';

    try {
      if (item.category === 'leaves') {
        await dispatch(updateLeaveStatus({ requestId: item.id, status: 'approved' })).unwrap();
      } else if (item.category === 'regularizations') {
        await dispatch(reviewRegularization({ id: item.id, status: 'approved' })).unwrap();
      } else if (item.category === 'expenses') {
        await api.put(`/hrms/payroll/reimbursements/${item.id}/review`, { status: 'approved' });
        setTeamClaims((prev) => prev.filter((c) => c.id !== item.id));
      } else {
        // Hiring decisions need the department, designation and manager chosen in Onboarding.
        dispatch(navigateToPage('onboarding'));
        return;
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
        decidedBy: 'You',
        decidedAt: new Date().toLocaleString(),
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
      dispatch(addToast({ type: 'error', message: err?.message || String(err || 'Approval failed') }));
    } finally {
      setProcessingId(null);
      setActiveRemarkId(null);
      setCustomRemark('');
    }
  };

  const handleRejectItem = async (item: BaseApprovalItem, remarks: string = '') => {
    setProcessingId(item.id);
    const remarkText = remarks || customRemark || '';

    try {
      if (item.category === 'leaves') {
        await dispatch(updateLeaveStatus({ requestId: item.id, status: 'rejected' })).unwrap();
      } else if (item.category === 'regularizations') {
        await dispatch(reviewRegularization({ id: item.id, status: 'rejected' })).unwrap();
      } else if (item.category === 'expenses') {
        await api.put(`/hrms/payroll/reimbursements/${item.id}/review`, { status: 'rejected' });
        setTeamClaims((prev) => prev.filter((c) => c.id !== item.id));
      } else {
        // Hiring decisions need the department, designation and manager chosen in Onboarding.
        dispatch(navigateToPage('onboarding'));
        return;
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
        decidedBy: 'You',
        decidedAt: new Date().toLocaleString(),
        remarks: remarkText,
      };
      setAuditLedger((prev) => [newAudit, ...prev]);

      dispatch(
        addToast({
          type: 'info',
          message: `Declined ${item.title}.`,
        })
      );
    } catch (err: any) {
      dispatch(addToast({ type: 'error', message: err?.message || String(err || 'Rejection failed') }));
    } finally {
      setProcessingId(null);
      setActiveRemarkId(null);
      setCustomRemark('');
    }
  };

  // Approve every low-risk leave and expense claim in one go (corrections and hires always need a look).
  const handleApproveAllLowRisk = async () => {
    const lowRiskItems = allPendingItems.filter((i) => i.riskLevel === 'low' && (i.category === 'leaves' || i.category === 'expenses'));
    if (lowRiskItems.length === 0) {
      dispatch(addToast({ type: 'info', message: 'No low-risk items pending sign-off.' }));
      return;
    }

    setProcessingId('bulk');
    let approved = 0;
    for (const item of lowRiskItems) {
      try {
        if (item.category === 'leaves') {
          await dispatch(updateLeaveStatus({ requestId: item.id, status: 'approved' })).unwrap();
        } else {
          await api.put(`/hrms/payroll/reimbursements/${item.id}/review`, { status: 'approved' });
          setTeamClaims((prev) => prev.filter((c) => c.id !== item.id));
        }
        approved++;
        setAuditLedger((prev) => [
          {
            id: `aud-${Date.now()}-${item.id}`,
            category: item.category,
            title: item.title,
            requesterName: item.requesterName,
            requesterRole: item.requesterRole,
            details: item.riskReason,
            outcome: 'approved',
            decidedBy: 'You (bulk approval)',
            decidedAt: new Date().toLocaleString(),
            remarks: '',
          },
          ...prev,
        ]);
      } catch {
        // counted below
      }
    }

    setProcessingId(null);
    const failed = lowRiskItems.length - approved;
    dispatch(
      addToast({
        type: failed ? 'error' : 'success',
        message: failed ? `Approved ${approved}; ${failed} could not be approved and are still pending.` : `Approved ${approved} low-risk items.`,
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
                Every pending sign-off across leave, attendance corrections, expense claims and new hires, in one place.
              </p>
            </div>
          </div>

          {/* Quick Authority & Governance Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>

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
                { id: 'regularizations', label: 'Attendance Corrections', count: unifiedRegularizations.length, icon: Clock },
                { id: 'expenses', label: 'Expense Claims', count: unifiedExpenses.length, icon: DollarSign },
                { id: 'offers', label: 'New Hires', count: unifiedOffers.length, icon: Users },
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
                        {item.category !== 'offers' && (
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
                        )}

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
                          <span>{item.category === 'offers' ? 'Review in Onboarding' : 'Approve'}</span>
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
      {/* 6. TAB 3: DECISION AUDIT LEDGER                                           */}
      {/* ========================================================================= */}
      {activeMainTab === 'audit' && (
        <DecisionAuditLedger records={auditLedger} />
      )}

    </div>
  );
};

export default ApprovalsDesk;
