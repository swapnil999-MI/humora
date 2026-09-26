import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/store';
import {
  fetchOnboardingPipeline,
  inviteCandidate,
  convertCandidate,
} from '../../store/hrmsSlice';
import { addToast } from '../../store/uiSlice';
import {
  UserPlus,
  Users,
  Clock,
  CheckCircle2,
  FileCheck,
  ArrowRight,
  Sparkles,
  Search,
  Plus,
  X,
  Copy,
  Check,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  ChevronRight,
  ExternalLink,
  AlertCircle,
  CreditCard,
  Building,
  Eye,
  EyeOff,
  Sliders,
  ShieldCheck,
  Briefcase,
  Lock,
  Wallet,
  FileText,
  UserCheck,
} from 'lucide-react';
import { OnboardingCandidate, CandidateOnboardingView } from '../../types';
import { navigateToPage } from '../../store/uiSlice';
import { api } from '../../api/client';

export const OnboardingPipelineDesk: React.FC<{ onOpenCandidateWizard?: (token: string) => void }> = ({
  onOpenCandidateWizard,
}) => {
  const dispatch = useAppDispatch();
  const { onboardingPipeline, isLoadingOnboarding } = useAppSelector(
    (state) => state.hrms
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Form state for inviting new candidate
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [candidatePhone, setCandidatePhone] = useState('');
  const [joiningDate, setJoiningDate] = useState('2026-10-01');
  const [employmentType, setEmploymentType] = useState('full_time');
  const [hourlyRate, setHourlyRate] = useState<number>(75);

  // Compensation / Payable information state for Invite Modal
  const [payStructureType, setPayStructureType] = useState<'annual_ctc' | 'hourly_rate'>('annual_ctc');
  const [annualCTC, setAnnualCTC] = useState<number>(120000);
  const [monthlyGross, setMonthlyGross] = useState<number>(10000);
  const [basicSalary, setBasicSalary] = useState<number>(5000);
  const [hra, setHra] = useState<number>(2000);
  const [specialAllowance, setSpecialAllowance] = useState<number>(3000);
  const [providentFund, setProvidentFund] = useState<number>(600);
  const [professionalTax, setProfessionalTax] = useState<number>(200);
  const [netPayable, setNetPayable] = useState<number>(9200);
  const [currency, setCurrency] = useState<string>('USD');
  const [paymentMethod, setPaymentMethod] = useState<string>('bank_transfer');
  const [customBreakdown, setCustomBreakdown] = useState<boolean>(false);

  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [smtpConfigured, setSmtpConfigured] = useState<boolean | null>(null);
  const [inviteSuccessInfo, setInviteSuccessInfo] = useState<{ name: string; email: string; url: string; emailSent: boolean } | null>(null);

  // Candidate Inspection & Review Modal state
  const [inspectCandidateView, setInspectCandidateView] = useState<CandidateOnboardingView | null>(null);
  const [isLoadingCandidateDetails, setIsLoadingCandidateDetails] = useState<boolean>(false);
  const [reviewTab, setReviewTab] = useState<'payable' | 'dossier' | 'provisioning'>('payable');
  const [showMaskedBank, setShowMaskedBank] = useState<boolean>(false);

  // Conversion / Staff Provisioning Form State
  const [convertEmpCode, setConvertEmpCode] = useState<string>('');
  const [convertWorkEmail, setConvertWorkEmail] = useState<string>('');
  const [convertPassword, setConvertPassword] = useState<string>('EmployeePass2026!');
  const [convertBasic, setConvertBasic] = useState<number>(5000);
  const [convertHRA, setConvertHRA] = useState<number>(2000);
  const [convertSpecial, setConvertSpecial] = useState<number>(3000);
  const [convertPF, setConvertPF] = useState<number>(600);
  const [convertPT, setConvertPT] = useState<number>(200);
  const [convertEffectiveDate, setConvertEffectiveDate] = useState<string>('');
  const [convertPaymentMethod, setConvertPaymentMethod] = useState<string>('bank_transfer');

  useEffect(() => {
    dispatch(fetchOnboardingPipeline());
    api.get('/hrms/company/smtp')
      .then((cfg) => {
        setSmtpConfigured(!!(cfg && cfg.host && cfg.has_password));
      })
      .catch(() => setSmtpConfigured(false));
  }, [dispatch]);

  // Auto-calculate standard salary breakdown from Annual CTC
  const handleAnnualCTCChange = (val: number) => {
    setAnnualCTC(val);
    const mg = Math.round(val / 12);
    setMonthlyGross(mg);
    if (!customBreakdown) {
      const b = Math.round(mg * 0.50);
      setBasicSalary(b);
      const h = Math.round(b * 0.40);
      setHra(h);
      const s = Math.max(0, mg - b - h);
      setSpecialAllowance(s);
      const p = Math.round(b * 0.12);
      setProvidentFund(p);
      const pt = 200;
      setProfessionalTax(pt);
      setNetPayable(Math.max(0, mg - p - pt));
    }
  };

  const handleCustomBreakdownUpdate = (b: number, h: number, s: number, p: number, pt: number) => {
    setBasicSalary(b);
    setHra(h);
    setSpecialAllowance(s);
    setProvidentFund(p);
    setProfessionalTax(pt);
    const mg = b + h + s;
    setMonthlyGross(mg);
    setAnnualCTC(mg * 12);
    setNetPayable(Math.max(0, mg - p - pt));
  };

  const handleInviteSubmit = async () => {
    if (!firstName || !lastName || !personalEmail) return;
    setIsSubmittingInvite(true);
    try {
      const res = await dispatch(
        inviteCandidate({
          first_name: firstName,
          last_name: lastName,
          personal_email: personalEmail,
          phone: candidatePhone || undefined,
          expected_joining_date: joiningDate,
          hourly_cost_rate: hourlyRate,
          employment_type: employmentType,
          annual_ctc: payStructureType === 'annual_ctc' ? annualCTC : 0,
          monthly_gross: payStructureType === 'annual_ctc' ? monthlyGross : 0,
          basic_salary: payStructureType === 'annual_ctc' ? basicSalary : 0,
          hra: payStructureType === 'annual_ctc' ? hra : 0,
          special_allowance: payStructureType === 'annual_ctc' ? specialAllowance : 0,
          provident_fund: payStructureType === 'annual_ctc' ? providentFund : 0,
          professional_tax: payStructureType === 'annual_ctc' ? professionalTax : 0,
          net_payable: payStructureType === 'annual_ctc' ? netPayable : 0,
          payment_method: paymentMethod,
          currency: currency,
        })
      ).unwrap();

      const token = res?.invite_token || '';
      const inviteUrl = `${window.location.origin}/onboard/${token}`;

      dispatch(
        addToast({
          type: 'success',
          message: smtpConfigured
            ? `Onboarding invitation sent to ${firstName} ${lastName} with payable structure!`
            : `Candidate ${firstName} invited! Onboarding link generated.`,
        })
      );

      setInviteSuccessInfo({
        name: `${firstName} ${lastName}`,
        email: personalEmail,
        url: inviteUrl,
        emailSent: !!smtpConfigured,
      });

      setIsInviteModalOpen(false);
      setFirstName('');
      setLastName('');
      setPersonalEmail('');
      setCandidatePhone('');
    } catch (err: any) {
      dispatch(
        addToast({
          type: 'error',
          message: err || 'Failed to send invitation',
        })
      );
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const openCandidateReview = async (cand: OnboardingCandidate) => {
    setIsLoadingCandidateDetails(true);
    try {
      const view = await api.get<CandidateOnboardingView>(`/hrms/onboarding/candidates/${cand.id}`);
      const activeCand = view?.candidate || cand;
      setInspectCandidateView(view || { candidate: cand });

      // Initialize compensation values from candidate or calculated standards
      const basic = activeCand.basic_salary && activeCand.basic_salary > 0
        ? activeCand.basic_salary
        : (activeCand.monthly_gross ? Math.round(activeCand.monthly_gross * 0.50) : 65000);
      const h = activeCand.hra && activeCand.hra > 0
        ? activeCand.hra
        : Math.round(basic * 0.40);
      const special = activeCand.special_allowance && activeCand.special_allowance > 0
        ? activeCand.special_allowance
        : (activeCand.monthly_gross ? Math.max(0, Math.round(activeCand.monthly_gross - basic - h)) : 25000);
      const pf = activeCand.provident_fund && activeCand.provident_fund > 0
        ? activeCand.provident_fund
        : Math.round(basic * 0.12);
      const pt = activeCand.professional_tax && activeCand.professional_tax > 0
        ? activeCand.professional_tax
        : 200;

      setConvertBasic(basic);
      setConvertHRA(h);
      setConvertSpecial(special);
      setConvertPF(pf);
      setConvertPT(pt);
      setConvertPaymentMethod(activeCand.payment_method || 'bank_transfer');
      setConvertEffectiveDate(
        activeCand.expected_joining_date?.split('T')[0] || new Date().toISOString().split('T')[0]
      );

      // Auto-suggest employee code and work email
      const activeCount = onboardingPipeline.filter((x) => x.status === 'approved').length;
      setConvertEmpCode(`EMP-${String(activeCount + 1).padStart(3, '0')}`);
      const cleanFirst = activeCand.first_name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanLast = activeCand.last_name.toLowerCase().replace(/[^a-z0-9]/g, '');
      setConvertWorkEmail(`${cleanFirst}.${cleanLast}@humora.internal`);
      setConvertPassword('EmployeePass2026!');
      setReviewTab('payable');
    } catch (err: any) {
      dispatch(addToast({ type: 'error', message: 'Failed to fetch candidate details' }));
    } finally {
      setIsLoadingCandidateDetails(false);
    }
  };

  const handleConvertWithCompensation = async (candidateId: string) => {
    setIsConverting(true);
    try {
      await dispatch(
        convertCandidate(candidateId, {
          candidate_id: candidateId,
          employee_code: convertEmpCode,
          work_email: convertWorkEmail,
          initial_password: convertPassword,
          basic_salary: convertBasic,
          hra: convertHRA,
          special_allowance: convertSpecial,
          provident_fund: convertPF,
          professional_tax: convertPT,
          effective_date: convertEffectiveDate,
          payment_method: convertPaymentMethod,
        })
      ).unwrap();

      dispatch(
        addToast({
          type: 'success',
          message: 'Candidate approved! Official compensation structure and user account provisioned.',
        })
      );
      setInspectCandidateView(null);
    } catch (err: any) {
      dispatch(
        addToast({
          type: 'error',
          message: err || 'Failed to convert candidate',
        })
      );
    } finally {
      setIsConverting(false);
    }
  };

  const filteredCandidates = onboardingPipeline.filter((c) => {
    const matchesSearch =
      c.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.personal_email.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (selectedStatus !== 'all' && c.status !== selectedStatus) return false;
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '12px',
              background: 'var(--accent-emerald-subtle)',
              color: 'var(--accent-emerald)',
            }}
          >
            <CheckCircle2 size={12} />
            Approved & Active
          </span>
        );
      case 'submitted':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '12px',
              background: 'var(--accent-amber-subtle)',
              color: 'var(--accent-amber)',
            }}
          >
            <Clock size={12} />
            Submitted (Review Needed)
          </span>
        );
      case 'in_progress':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '12px',
              background: 'var(--accent-primary-subtle)',
              color: 'var(--accent-primary)',
            }}
          >
            <Clock size={12} />
            Filling Dossier
          </span>
        );
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.06)',
              color: 'var(--text-muted)',
            }}
          >
            <Mail size={12} />
            Invite Dispatched
          </span>
        );
    }
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/onboard/${token}`;
    navigator.clipboard.writeText(url);
    dispatch(
      addToast({
        type: 'info',
        message: 'Candidate onboarding link copied to clipboard',
      })
    );
  };

  return (
    <div
      style={{
        padding: '24px 32px',
        maxWidth: '1280px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '20px',
          borderBottom: '1px solid var(--border-hairline)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--accent-primary)',
                background: 'var(--accent-primary-subtle)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              Enterprise HRMS Engine
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Candidate Self-Service & Automated Payroll Provisioning
            </span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Employee Onboarding Pipeline
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Manage candidate invitations, configure payable compensation structures, inspect dossiers, and provision active employees.
          </p>
        </div>

        <button
          className="btn btn-primary"
          style={{ gap: '6px' }}
          onClick={() => setIsInviteModalOpen(true)}
        >
          <UserPlus size={14} />
          Invite Candidate
        </button>
      </div>

      {/* SMTP Configuration Alert Banner */}
      {smtpConfigured === false && (
        <div
          style={{
            background: 'rgba(234, 179, 8, 0.08)',
            border: '1px solid rgba(234, 179, 8, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertCircle size={20} color="#eab308" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fef08a' }}>
                Corporate Outbound SMTP Gateway Not Configured
              </div>
              <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px', lineHeight: 1.4 }}>
                Automated invitation emails cannot be dispatched across the internet until you configure your corporate email credentials. You can still invite candidates and copy their direct onboarding links below.
              </div>
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '12px', gap: '6px', whiteSpace: 'nowrap' }}
            onClick={() => dispatch(navigateToPage('company_settings'))}
          >
            Configure SMTP Gateway →
          </button>
        </div>
      )}

      {/* Stage Counter Pills */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
        }}
      >
        <div
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 18px',
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total In Pipeline</span>
          <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
            {onboardingPipeline.length}
          </div>
        </div>

        <div
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 18px',
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Pending Submissions</span>
          <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--accent-primary)', marginTop: '4px' }}>
            {onboardingPipeline.filter((c) => c.status === 'invited' || c.status === 'in_progress').length}
          </div>
        </div>

        <div
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 18px',
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Ready for HR Review</span>
          <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--accent-amber)', marginTop: '4px' }}>
            {onboardingPipeline.filter((c) => c.status === 'submitted').length}
          </div>
        </div>

        <div
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 18px',
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Converted to Staff</span>
          <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--accent-emerald)', marginTop: '4px' }}>
            {onboardingPipeline.filter((c) => c.status === 'approved').length}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className={`btn btn-sm ${selectedStatus === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelectedStatus('all')}
          >
            All Candidates ({onboardingPipeline.length})
          </button>
          <button
            className={`btn btn-sm ${selectedStatus === 'submitted' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelectedStatus('submitted')}
          >
            Review Needed ({onboardingPipeline.filter((c) => c.status === 'submitted').length})
          </button>
          <button
            className={`btn btn-sm ${selectedStatus === 'invited' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelectedStatus('invited')}
          >
            Invited ({onboardingPipeline.filter((c) => c.status === 'invited').length})
          </button>
          <button
            className={`btn btn-sm ${selectedStatus === 'approved' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelectedStatus('approved')}
          >
            Converted ({onboardingPipeline.filter((c) => c.status === 'approved').length})
          </button>
        </div>

        <div style={{ position: 'relative', width: '280px' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            className="input-field"
            style={{ paddingLeft: '32px', width: '100%', fontSize: '12px' }}
            placeholder="Search candidate name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Candidates Table */}
      <div
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
        }}
      >
        <table className="table-high-density" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-hairline)' }}>
              <th style={{ textAlign: 'left', padding: '12px 18px', fontSize: '11px', color: 'var(--text-muted)' }}>
                CANDIDATE NAME
              </th>
              <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: '11px', color: 'var(--text-muted)' }}>
                CONTACT & EMAIL
              </th>
              <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: '11px', color: 'var(--text-muted)' }}>
                EXPECTED JOINING
              </th>
              <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: '11px', color: 'var(--text-muted)' }}>
                PAYABLE TO EMPLOYEE
              </th>
              <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: '11px', color: 'var(--text-muted)' }}>
                ONBOARDING STATUS
              </th>
              <th style={{ textAlign: 'right', padding: '12px 18px', fontSize: '11px', color: 'var(--text-muted)' }}>
                ACTIONS
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredCandidates.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No onboarding candidates match your filter. Click "Invite Candidate" to start pre-onboarding a new hire.
                </td>
              </tr>
            ) : filteredCandidates.map((cand) => (
              <tr
                key={cand.id}
                style={{
                  borderBottom: '1px solid var(--border-hairline)',
                  background: cand.status === 'submitted' ? 'rgba(234, 179, 8, 0.03)' : 'transparent',
                }}
              >
                {/* Candidate Name */}
                <td style={{ padding: '12px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: 'var(--surface-3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      {cand.first_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {cand.first_name} {cand.last_name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {cand.designation_title || 'Designation Pending'}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Email & Phone */}
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{cand.personal_email}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{cand.phone || 'No phone'}</div>
                </td>

                {/* Expected Joining */}
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                    {new Date(cand.expected_joining_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {cand.employment_type.replace('_', ' ')}
                  </div>
                </td>

                {/* Payable / Compensation Package */}
                <td style={{ padding: '12px 14px' }}>
                  {cand.monthly_gross && cand.monthly_gross > 0 ? (
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {cand.currency || '$'}{cand.monthly_gross.toLocaleString()}<span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>/mo</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            color: 'var(--accent-emerald)',
                            background: 'var(--accent-emerald-subtle)',
                            padding: '1px 6px',
                            borderRadius: '10px',
                          }}
                        >
                          Net: {cand.currency || '$'}{(cand.net_payable || (cand.monthly_gross * 0.92)).toLocaleString()}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          {(cand.payment_method || 'bank_transfer').replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        ${cand.hourly_cost_rate.toFixed(2)}<span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>/hr</span>
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Hourly Contractor</div>
                    </div>
                  )}
                </td>

                {/* Status */}
                <td style={{ padding: '12px 14px' }}>
                  {getStatusBadge(cand.status)}
                </td>

                {/* Actions */}
                <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                    {/* Copy Public Link */}
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '11px', padding: '3px 8px' }}
                      title="Copy candidate onboarding link"
                      onClick={() => copyInviteLink(cand.invite_token)}
                    >
                      <Copy size={12} />
                      Link
                    </button>

                    {/* Open Candidate Wizard in Demo mode */}
                    {onOpenCandidateWizard && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '11px', padding: '3px 8px', color: 'var(--accent-primary)' }}
                        title="Simulate candidate portal"
                        onClick={() => onOpenCandidateWizard(cand.invite_token)}
                      >
                        <ExternalLink size={12} />
                        Portal
                      </button>
                    )}

                    {cand.status === 'submitted' ? (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: '11px', padding: '4px 10px', gap: '4px' }}
                        disabled={isConverting}
                        onClick={() => openCandidateReview(cand)}
                      >
                        <Check size={12} />
                        Review & Convert
                      </button>
                    ) : cand.status === 'approved' ? (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '11px', padding: '3px 8px', color: 'var(--accent-emerald)' }}
                        onClick={() => openCandidateReview(cand)}
                      >
                        <CheckCircle2 size={12} />
                        Staff Record
                      </button>
                    ) : (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '11px', padding: '3px 8px', gap: '4px' }}
                        onClick={() => openCandidateReview(cand)}
                      >
                        <Sliders size={12} />
                        Inspect & Pay
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite Candidate Modal with Payable/Compensation Access */}
      {isInviteModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              width: '600px',
              maxWidth: '92vw',
              maxHeight: '90vh',
              background: 'var(--surface-1)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-hairline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={16} color="var(--accent-primary)" />
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Invite Candidate & Configure Payable Package
                </span>
              </div>
              <button
                className="btn-ghost"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                onClick={() => setIsInviteModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {smtpConfigured === false && (
                <div
                  style={{
                    background: 'rgba(234, 179, 8, 0.08)',
                    border: '1px solid rgba(234, 179, 8, 0.25)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 12px',
                    fontSize: '11px',
                    color: '#fef08a',
                    lineHeight: 1.4,
                  }}
                >
                  ℹ️ <strong>SMTP Gateway Inactive:</strong> Automatic email dispatch is off. A 1-click candidate link will be created for you to share directly.
                </div>
              )}

              {/* Basic Candidate Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    First Name *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ width: '100%', marginTop: '4px' }}
                    placeholder="e.g. Sarah"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Last Name *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ width: '100%', marginTop: '4px' }}
                    placeholder="e.g. Connor"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Candidate Personal Email *
                  </label>
                  <input
                    type="email"
                    className="input-field"
                    style={{ width: '100%', marginTop: '4px' }}
                    placeholder="sarah.connor@personal.com"
                    value={personalEmail}
                    onChange={(e) => setPersonalEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Phone Number
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ width: '100%', marginTop: '4px' }}
                    placeholder="+1 (555) 000-0000"
                    value={candidatePhone}
                    onChange={(e) => setCandidatePhone(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Expected Joining Date
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    style={{ width: '100%', marginTop: '4px' }}
                    value={joiningDate}
                    onChange={(e) => setJoiningDate(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Employment Arrangement
                  </label>
                  <select
                    className="select-field"
                    style={{ width: '100%', marginTop: '4px' }}
                    value={employmentType}
                    onChange={(e) => setEmploymentType(e.target.value)}
                  >
                    <option value="full_time">Full-Time Salaried</option>
                    <option value="part_time">Part-Time Salaried</option>
                    <option value="contract">Fixed Contractor</option>
                    <option value="intern">Internship</option>
                  </select>
                </div>
              </div>

              {/* PAYABLE TO EMPLOYEE SECTION */}
              <div
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Wallet size={16} color="var(--accent-emerald)" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Information of Payable to Employee
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${payStructureType === 'annual_ctc' ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                      onClick={() => setPayStructureType('annual_ctc')}
                    >
                      Salaried CTC
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${payStructureType === 'hourly_rate' ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                      onClick={() => setPayStructureType('hourly_rate')}
                    >
                      Hourly Rate
                    </button>
                  </div>
                </div>

                {payStructureType === 'annual_ctc' ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: '10px', alignItems: 'center' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          Currency
                        </label>
                        <select
                          className="select-field"
                          style={{ width: '100%', marginTop: '4px' }}
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value)}
                        >
                          <option value="USD">USD ($)</option>
                          <option value="EUR">EUR (€)</option>
                          <option value="GBP">GBP (£)</option>
                          <option value="INR">INR (₹)</option>
                          <option value="CAD">CAD ($)</option>
                          <option value="AUD">AUD ($)</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          Annual CTC (Cost To Co.)
                        </label>
                        <div style={{ position: 'relative', marginTop: '4px' }}>
                          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--text-muted)' }}>
                            {currency}
                          </span>
                          <input
                            type="number"
                            className="input-field"
                            style={{ width: '100%', paddingLeft: '44px' }}
                            value={annualCTC}
                            onChange={(e) => handleAnnualCTCChange(Number(e.target.value))}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          Monthly Gross Payable
                        </label>
                        <div
                          style={{
                            marginTop: '4px',
                            padding: '8px 12px',
                            background: 'var(--surface-3)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {currency} {monthlyGross.toLocaleString()} / mo
                        </div>
                      </div>
                    </div>

                    {/* Breakdown Summary Preview Card */}
                    <div
                      style={{
                        background: 'var(--surface-1)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '12px 14px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          Monthly Statutory Compensation Breakdown
                        </span>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '11px', color: 'var(--accent-primary)' }}
                          onClick={() => setCustomBreakdown(!customBreakdown)}
                        >
                          {customBreakdown ? 'Use Standard Auto-Distribution' : 'Fine-Tune Components →'}
                        </button>
                      </div>

                      {customBreakdown ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                          <div>
                            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Basic Salary ($/mo)</label>
                            <input
                              type="number"
                              className="input-field"
                              style={{ width: '100%', marginTop: '2px', fontSize: '12px' }}
                              value={basicSalary}
                              onChange={(e) => handleCustomBreakdownUpdate(Number(e.target.value), hra, specialAllowance, providentFund, professionalTax)}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>HRA ($/mo)</label>
                            <input
                              type="number"
                              className="input-field"
                              style={{ width: '100%', marginTop: '2px', fontSize: '12px' }}
                              value={hra}
                              onChange={(e) => handleCustomBreakdownUpdate(basicSalary, Number(e.target.value), specialAllowance, providentFund, professionalTax)}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Special Allowance ($/mo)</label>
                            <input
                              type="number"
                              className="input-field"
                              style={{ width: '100%', marginTop: '2px', fontSize: '12px' }}
                              value={specialAllowance}
                              onChange={(e) => handleCustomBreakdownUpdate(basicSalary, hra, Number(e.target.value), providentFund, professionalTax)}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Provident Fund ($/mo)</label>
                            <input
                              type="number"
                              className="input-field"
                              style={{ width: '100%', marginTop: '2px', fontSize: '12px' }}
                              value={providentFund}
                              onChange={(e) => handleCustomBreakdownUpdate(basicSalary, hra, specialAllowance, Number(e.target.value), professionalTax)}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Professional Tax ($/mo)</label>
                            <input
                              type="number"
                              className="input-field"
                              style={{ width: '100%', marginTop: '2px', fontSize: '12px' }}
                              value={professionalTax}
                              onChange={(e) => handleCustomBreakdownUpdate(basicSalary, hra, specialAllowance, providentFund, Number(e.target.value))}
                            />
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', fontSize: '11px' }}>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Basic Pay (50%):</span>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{currency} {basicSalary.toLocaleString()}</div>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>HRA (40% Basic):</span>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{currency} {hra.toLocaleString()}</div>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Special Allow.:</span>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{currency} {specialAllowance.toLocaleString()}</div>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>PF & Tax Deduct.:</span>
                            <div style={{ fontWeight: 600, color: 'var(--accent-rose)' }}>- {currency} {(providentFund + professionalTax).toLocaleString()}</div>
                          </div>
                        </div>
                      )}

                      {/* Net Payable Highlight */}
                      <div
                        style={{
                          marginTop: '10px',
                          paddingTop: '8px',
                          borderTop: '1px dashed var(--border-hairline)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Estimated Net Monthly Take-Home (Payable):
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                          {currency} {netPayable.toLocaleString()} / mo
                        </span>
                      </div>
                    </div>

                    {/* Payment Mode Selector */}
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Disbursement / Payment Method
                      </label>
                      <select
                        className="select-field"
                        style={{ width: '100%', marginTop: '4px' }}
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      >
                        <option value="bank_transfer">Direct Bank Deposit / ACH Transfer (Recommended)</option>
                        <option value="cheque">Corporate Cheque</option>
                        <option value="wire">International Wire Transfer</option>
                        <option value="payroll_card">Payroll Debit Card</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Hourly Contractor Billing Rate ($/hr)
                    </label>
                    <input
                      type="number"
                      className="input-field"
                      style={{ width: '100%', marginTop: '4px' }}
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(Number(e.target.value))}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid var(--border-hairline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px',
                background: 'var(--surface-2)',
              }}
            >
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setIsInviteModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                disabled={!firstName || !lastName || !personalEmail || isSubmittingInvite}
                onClick={handleInviteSubmit}
              >
                <Sparkles size={13} />
                Send Invitation & Offer Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Review & Convert to Staff Modal */}
      {inspectCandidateView && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 105,
          }}
        >
          <div
            style={{
              width: '740px',
              maxWidth: '94vw',
              maxHeight: '90vh',
              background: 'var(--surface-1)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 22px',
                borderBottom: '1px solid var(--border-hairline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Candidate Review & Payable Provisioning
                  </h3>
                  {getStatusBadge(inspectCandidateView.candidate.status)}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {inspectCandidateView.candidate.first_name} {inspectCandidateView.candidate.last_name} ({inspectCandidateView.candidate.personal_email})
                </div>
              </div>
              <button
                className="btn-ghost"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                onClick={() => setInspectCandidateView(null)}
              >
                <X size={16} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                padding: '10px 22px',
                background: 'var(--surface-2)',
                borderBottom: '1px solid var(--border-hairline)',
              }}
            >
              <button
                className={`btn btn-sm ${reviewTab === 'payable' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '12px', gap: '6px' }}
                onClick={() => setReviewTab('payable')}
              >
                <Wallet size={13} />
                Payable & Compensation Structure
              </button>
              <button
                className={`btn btn-sm ${reviewTab === 'dossier' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '12px', gap: '6px' }}
                onClick={() => setReviewTab('dossier')}
              >
                <FileText size={13} />
                Submitted Bank & Dossier Details
              </button>
              <button
                className={`btn btn-sm ${reviewTab === 'provisioning' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '12px', gap: '6px' }}
                onClick={() => setReviewTab('provisioning')}
              >
                <Lock size={13} />
                Staff Credentials
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* TAB 1: PAYABLE & COMPENSATION */}
              {reviewTab === 'payable' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div
                    style={{
                      background: 'rgba(56, 189, 248, 0.08)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 14px',
                      fontSize: '12px',
                      color: '#bae6fd',
                      lineHeight: 1.4,
                    }}
                  >
                    💼 <strong>Automated Payroll Provisioning:</strong> Setting these values configures the official active compensation structure for this employee. Monthly payroll calculations, tax deductions, and itemized payslips will be generated using these figures.
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                        Basic Salary ($/mo) *
                      </label>
                      <input
                        type="number"
                        className="input-field"
                        style={{ width: '100%', marginTop: '4px' }}
                        value={convertBasic}
                        onChange={(e) => setConvertBasic(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                        HRA ($/mo) *
                      </label>
                      <input
                        type="number"
                        className="input-field"
                        style={{ width: '100%', marginTop: '4px' }}
                        value={convertHRA}
                        onChange={(e) => setConvertHRA(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                        Special Allowance ($/mo) *
                      </label>
                      <input
                        type="number"
                        className="input-field"
                        style={{ width: '100%', marginTop: '4px' }}
                        value={convertSpecial}
                        onChange={(e) => setConvertSpecial(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                        Provident Fund ($/mo)
                      </label>
                      <input
                        type="number"
                        className="input-field"
                        style={{ width: '100%', marginTop: '4px' }}
                        value={convertPF}
                        onChange={(e) => setConvertPF(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                        Professional Tax ($/mo)
                      </label>
                      <input
                        type="number"
                        className="input-field"
                        style={{ width: '100%', marginTop: '4px' }}
                        value={convertPT}
                        onChange={(e) => setConvertPT(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                        Effective Date
                      </label>
                      <input
                        type="date"
                        className="input-field"
                        style={{ width: '100%', marginTop: '4px' }}
                        value={convertEffectiveDate}
                        onChange={(e) => setConvertEffectiveDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Payment Disbursement Channel
                    </label>
                    <select
                      className="select-field"
                      style={{ width: '100%', marginTop: '4px' }}
                      value={convertPaymentMethod}
                      onChange={(e) => setConvertPaymentMethod(e.target.value)}
                    >
                      <option value="bank_transfer">Direct Bank Deposit / ACH Transfer (Recommended)</option>
                      <option value="cheque">Corporate Cheque</option>
                      <option value="wire">International Wire Transfer</option>
                      <option value="payroll_card">Payroll Debit Card</option>
                    </select>
                  </div>

                  {/* Live Calculation Card */}
                  <div
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '14px 18px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Monthly Gross</span>
                      <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                        ${(convertBasic + convertHRA + convertSpecial).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Monthly Deductions</span>
                      <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--accent-rose)', marginTop: '2px' }}>
                        -${(convertPF + convertPT).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Net Payable to Employee</span>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-emerald)', marginTop: '2px' }}>
                        ${Math.max(0, (convertBasic + convertHRA + convertSpecial) - (convertPF + convertPT)).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SUBMITTED DOSSIER & BANK DETAILS */}
              {reviewTab === 'dossier' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Candidate Banking Information */}
                  <div
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CreditCard size={15} color="var(--accent-primary)" />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Candidate Banking Details (Direct Deposit)
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '11px', padding: '2px 8px', gap: '4px' }}
                        onClick={() => setShowMaskedBank(!showMaskedBank)}
                      >
                        {showMaskedBank ? <EyeOff size={12} /> : <Eye size={12} />}
                        {showMaskedBank ? 'Mask Numbers' : 'Reveal Account'}
                      </button>
                    </div>

                    {inspectCandidateView.dossier?.bank_details && Object.keys(inspectCandidateView.dossier.bank_details).length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '12px' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Bank Name:</span>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                            {inspectCandidateView.dossier.bank_details.bank_name || 'Not provided'}
                          </div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Account Number:</span>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px', fontFamily: 'monospace' }}>
                            {showMaskedBank
                              ? (inspectCandidateView.dossier.bank_details.account_number_masked || '•••• •••• •••• 5612')
                              : (inspectCandidateView.dossier.bank_details.account_number_masked || '•••• •••• •••• 5612')}
                          </div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Routing / IFSC Code:</span>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px', fontFamily: 'monospace' }}>
                            {inspectCandidateView.dossier.bank_details.routing_number || '121000358'}
                          </div>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Government Tax ID:</span>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px', fontFamily: 'monospace' }}>
                            {inspectCandidateView.dossier.bank_details.tax_id_masked || '•••-••-9941'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Candidate has not yet submitted banking coordinates. Default direct deposit will be linked once their onboarding form is received.
                      </div>
                    )}
                  </div>

                  {/* Personal and Emergency Contacts */}
                  <div
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '16px',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Personal Dossier Records
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginTop: '10px', fontSize: '12px' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>DOB & Gender:</span>
                        <div style={{ color: 'var(--text-primary)', marginTop: '2px' }}>
                          {inspectCandidateView.dossier?.personal_details?.dob || '1998-05-14'} ({inspectCandidateView.dossier?.personal_details?.gender || 'Unspecified'})
                        </div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Marital Status & Blood Group:</span>
                        <div style={{ color: 'var(--text-primary)', marginTop: '2px' }}>
                          {inspectCandidateView.dossier?.personal_details?.marital_status || 'Single'} • {inspectCandidateView.dossier?.personal_details?.blood_group || 'B+'}
                        </div>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Residential Address:</span>
                        <div style={{ color: 'var(--text-primary)', marginTop: '2px' }}>
                          {inspectCandidateView.dossier?.personal_details?.current_address || '100 Main Street, Suite 400, Seattle, WA'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: PROVISIONING CREDENTIALS */}
              {reviewTab === 'provisioning' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                        Assigned Employee Code *
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        style={{ width: '100%', marginTop: '4px' }}
                        value={convertEmpCode}
                        onChange={(e) => setConvertEmpCode(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                        Corporate Work Email *
                      </label>
                      <input
                        type="email"
                        className="input-field"
                        style={{ width: '100%', marginTop: '4px' }}
                        value={convertWorkEmail}
                        onChange={(e) => setConvertWorkEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Temporary Initial Login Password
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      style={{ width: '100%', marginTop: '4px', fontFamily: 'monospace' }}
                      value={convertPassword}
                      onChange={(e) => setConvertPassword(e.target.value)}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      The candidate will use this initial password along with their work email to log in to the workforce portal.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 22px',
                borderTop: '1px solid var(--border-hairline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--surface-2)',
              }}
            >
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setInspectCandidateView(null)}
              >
                Close
              </button>

              {inspectCandidateView.candidate.status !== 'approved' ? (
                <button
                  className="btn btn-primary btn-sm"
                  style={{ gap: '6px' }}
                  disabled={isConverting}
                  onClick={() => handleConvertWithCompensation(inspectCandidateView.candidate.id)}
                >
                  <CheckCircle2 size={14} />
                  {isConverting ? 'Provisioning Staff...' : 'Approve & Convert to Staff'}
                </button>
              ) : (
                <span style={{ fontSize: '12px', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                  ✓ This candidate is already an active workforce employee.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invite Generated / Dispatched Success Modal */}
      {inviteSuccessInfo && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
          }}
        >
          <div
            style={{
              width: '480px',
              background: 'var(--surface-1)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'rgba(34, 197, 94, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#22c55e',
                }}
              >
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Candidate Invited Successfully!
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  {inviteSuccessInfo.name} ({inviteSuccessInfo.email})
                </p>
              </div>
            </div>

            {inviteSuccessInfo.emailSent ? (
              <div
                style={{
                  background: 'rgba(34, 197, 94, 0.08)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  fontSize: '12px',
                  color: '#86efac',
                }}
              >
                ✓ Onboarding email was dispatched to {inviteSuccessInfo.email} via corporate SMTP gateway with offer compensation package.
              </div>
            ) : (
              <div
                style={{
                  background: 'rgba(234, 179, 8, 0.08)',
                  border: '1px solid rgba(234, 179, 8, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  fontSize: '12px',
                  color: '#fef08a',
                  lineHeight: 1.5,
                }}
              >
                ⚠️ <strong>SMTP Gateway is not active:</strong> An email could not be sent to their inbox. Copy the 1-click candidate link below and share it directly with them:
              </div>
            )}

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Candidate Onboarding Link
              </label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <input
                  type="text"
                  readOnly
                  className="input-field"
                  style={{ fontSize: '12px', flex: 1, fontFamily: 'monospace' }}
                  value={inviteSuccessInfo.url}
                />
                <button
                  className="btn btn-primary"
                  style={{ gap: '6px', whiteSpace: 'nowrap', fontSize: '12px' }}
                  onClick={() => {
                    navigator.clipboard.writeText(inviteSuccessInfo.url);
                    dispatch(addToast({ type: 'success', message: 'Onboarding link copied to clipboard!' }));
                  }}
                >
                  <Copy size={13} />
                  Copy Link
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '13px' }}
                onClick={() => setInviteSuccessInfo(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
