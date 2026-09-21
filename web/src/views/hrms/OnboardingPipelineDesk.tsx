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
} from 'lucide-react';
import { OnboardingCandidate } from '../../types';

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
  const [selectedCandidate, setSelectedCandidate] = useState<OnboardingCandidate | null>(null);

  // Form state for inviting new candidate
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [candidatePhone, setCandidatePhone] = useState('');
  const [joiningDate, setJoiningDate] = useState('2026-10-01');
  const [hourlyRate, setHourlyRate] = useState<number>(75);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  useEffect(() => {
    dispatch(fetchOnboardingPipeline());
  }, [dispatch]);

  const handleInviteSubmit = async () => {
    if (!firstName || !lastName || !personalEmail) return;
    setIsSubmittingInvite(true);
    try {
      await dispatch(
        inviteCandidate({
          first_name: firstName,
          last_name: lastName,
          personal_email: personalEmail,
          phone: candidatePhone || undefined,
          expected_joining_date: joiningDate,
          hourly_cost_rate: hourlyRate,
          employment_type: 'full_time',
        })
      ).unwrap();

      dispatch(
        addToast({
          type: 'success',
          message: `Onboarding invitation sent to ${firstName} ${lastName}!`,
        })
      );
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

  const handleConvert = async (candidateId: string) => {
    setIsConverting(true);
    try {
      await dispatch(convertCandidate(candidateId)).unwrap();
      dispatch(
        addToast({
          type: 'success',
          message: 'Candidate approved! Employee code and user account provisioned.',
        })
      );
      setSelectedCandidate(null);
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
    const url = `${window.location.origin}/?onboarding_token=${token}`;
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
              Zoho People Engine
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Candidate Self-Service & Automated Provisioning
            </span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Employee Onboarding Pipeline
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Track new hire onboarding stages, inspect submitted dossiers, and convert candidates to active staff with one click.
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
            style={{ paddingLeft: '32px', fontSize: '12px', width: '100%' }}
            placeholder="Search candidate name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Candidates Matrix Table */}
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
                ONBOARDING STATUS
              </th>
              <th style={{ textAlign: 'right', padding: '12px 18px', fontSize: '11px', color: 'var(--text-muted)' }}>
                ACTIONS
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredCandidates.map((cand) => (
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
                        Hourly Rate: ${cand.hourly_cost_rate.toFixed(2)}/hr
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
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {cand.employment_type.replace('_', ' ')}
                  </div>
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
                        Wizard
                      </button>
                    )}

                    {cand.status === 'submitted' ? (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: '11px', padding: '3px 10px', gap: '4px' }}
                        disabled={isConverting}
                        onClick={() => handleConvert(cand.id)}
                      >
                        <Check size={12} />
                        Convert to Staff
                      </button>
                    ) : cand.status === 'approved' ? (
                      <span style={{ fontSize: '11px', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                        Active Employee
                      </span>
                    ) : (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '11px', padding: '3px 8px' }}
                        onClick={() => setSelectedCandidate(cand)}
                      >
                        Inspect
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite Candidate Modal */}
      {isInviteModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              width: '460px',
              background: 'var(--surface-1)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
            }}
          >
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
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Invite New Hire (Pre-Onboarding)
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

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    First Name *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ width: '100%', marginTop: '4px' }}
                    placeholder="e.g. John"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Last Name *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ width: '100%', marginTop: '4px' }}
                    placeholder="e.g. Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Candidate Personal Email *
                </label>
                <input
                  type="email"
                  className="input-field"
                  style={{ width: '100%', marginTop: '4px' }}
                  placeholder="candidate@personal-email.com"
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Joining Date
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
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Hourly Rate ($/hr)
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    style={{ width: '100%', marginTop: '4px' }}
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>

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
                Send Invitation Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
