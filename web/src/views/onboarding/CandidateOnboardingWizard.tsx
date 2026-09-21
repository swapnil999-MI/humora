import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/store';
import {
  fetchCandidateOnboarding,
  saveCandidateDossier,
} from '../../store/hrmsSlice';
import { addToast } from '../../store/uiSlice';
import {
  User,
  Heart,
  CreditCard,
  GraduationCap,
  FileCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Building,
} from 'lucide-react';

export const CandidateOnboardingWizard: React.FC<{
  token: string;
  onExit?: () => void;
}> = ({ token, onExit }) => {
  const dispatch = useAppDispatch();
  const { activeCandidateView } = useAppSelector((state) => state.hrms);

  const [step, setStep] = useState<number>(1);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  // Step 1: Personal
  const [dob, setDob] = useState('1998-05-14');
  const [gender, setGender] = useState('Female');
  const [bloodGroup, setBloodGroup] = useState('B+');
  const [maritalStatus, setMaritalStatus] = useState('Single');
  const [currentAddress, setCurrentAddress] = useState('100 Main Street, Suite 400, Seattle, WA');
  const [permanentAddress, setPermanentAddress] = useState('100 Main Street, Suite 400, Seattle, WA');

  // Step 2: Emergency
  const [emergencyName, setEmergencyName] = useState('Robert Smith');
  const [emergencyRelation, setEmergencyRelation] = useState('Parent');
  const [emergencyPhone, setEmergencyPhone] = useState('+1 (555) 887-2233');

  // Step 3: Bank
  const [bankName, setBankName] = useState('Silicon Valley Bank');
  const [accountNumber, setAccountNumber] = useState('•••• •••• •••• 5612');
  const [routingNumber, setRoutingNumber] = useState('121000358');
  const [taxId, setTaxId] = useState('•••-••-9941');

  // Step 4: Education & Experience
  const [degree, setDegree] = useState('B.S. Computer Science');
  const [institution, setInstitution] = useState('University of Washington');
  const [eduYear, setEduYear] = useState('2020');
  const [prevCompany, setPrevCompany] = useState('Amazon AWS');
  const [prevRole, setPrevRole] = useState('Software Development Engineer');
  const [prevYears, setPrevYears] = useState('2020 - 2024');

  // Step 5: Policy
  const [policyAgreed, setPolicyAgreed] = useState<boolean>(true);

  useEffect(() => {
    if (token) {
      dispatch(fetchCandidateOnboarding(token));
    }
  }, [dispatch, token]);

  const cand = activeCandidateView?.candidate;

  const handleFinalSubmit = async () => {
    if (!policyAgreed) {
      dispatch(
        addToast({
          type: 'error',
          message: 'Please review and acknowledge company policies',
        })
      );
      return;
    }

    const payload = {
      personal_details: {
        dob,
        gender,
        blood_group: bloodGroup,
        marital_status: maritalStatus,
        current_address: currentAddress,
        permanent_address: permanentAddress,
      },
      emergency_contacts: [
        {
          name: emergencyName,
          relationship: emergencyRelation,
          phone: emergencyPhone,
        },
      ],
      bank_details: {
        bank_name: bankName,
        account_number_masked: accountNumber,
        routing_number: routingNumber,
        tax_id_masked: taxId,
        direct_deposit: true,
      },
      education_history: [
        {
          degree,
          institution,
          year: eduYear,
          grade: '3.8 GPA',
        },
      ],
      experience_history: [
        {
          company: prevCompany,
          role: prevRole,
          period: prevYears,
          summary: 'Cloud backend development and distributed services',
        },
      ],
      policy_acknowledged: true,
      is_final_submit: true,
    };

    try {
      await dispatch(
        saveCandidateDossier({
          token,
          dossier: payload,
        })
      ).unwrap();

      dispatch(
        addToast({
          type: 'success',
          message: 'Onboarding dossier submitted! HR will review and activate your profile.',
        })
      );
      setIsSubmitted(true);
    } catch (err: any) {
      dispatch(
        addToast({
          type: 'error',
          message: err || 'Failed to submit onboarding dossier',
        })
      );
    }
  };

  if (isSubmitted) {
    return (
      <div
        style={{
          maxWidth: '640px',
          margin: '60px auto',
          padding: '40px',
          background: 'var(--surface-1)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          textAlign: 'center',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'var(--accent-emerald-subtle)',
            color: 'var(--accent-emerald)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <CheckCircle2 size={36} />
        </div>
        <h2 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 10px 0' }}>
          Onboarding Dossier Submitted!
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Thank you, <strong>{cand?.first_name}</strong>! Your onboarding details, banking coordinates, and emergency contacts have been encrypted and sent to HR for verification. You will receive an activation email with your employee ID and system credentials prior to your joining date.
        </p>

        {onExit && (
          <button
            className="btn btn-secondary"
            style={{ marginTop: '24px' }}
            onClick={onExit}
          >
            Back to Application
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: '820px',
        margin: '30px auto',
        padding: '0 20px 40px',
      }}
    >
      {/* Top Banner */}
      <div
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '24px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              Candidate Portal
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Step {step} of 5
            </span>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: '6px 0 0 0' }}>
            Welcome to Humora, {cand ? `${cand.first_name} ${cand.last_name}` : 'New Hire'}!
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Please complete your pre-onboarding profile to prepare your official workforce records.
          </p>
        </div>

        {onExit && (
          <button className="btn btn-ghost btn-sm" onClick={onExit}>
            Exit Demo
          </button>
        )}
      </div>

      {/* 5-Step Progress Indicators */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '8px',
          marginBottom: '24px',
        }}
      >
        {[
          { num: 1, label: 'Personal', icon: <User size={13} /> },
          { num: 2, label: 'Emergency', icon: <Heart size={13} /> },
          { num: 3, label: 'Bank & Tax', icon: <CreditCard size={13} /> },
          { num: 4, label: 'Career', icon: <GraduationCap size={13} /> },
          { num: 5, label: 'Review', icon: <FileCheck size={13} /> },
        ].map((s) => (
          <div
            key={s.num}
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              background: step === s.num ? 'var(--surface-2)' : 'var(--surface-1)',
              border: `1px solid ${step === s.num ? 'var(--accent-primary)' : 'var(--border-hairline)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
            onClick={() => setStep(s.num)}
          >
            <span
              style={{
                color: step === s.num ? 'var(--accent-primary)' : 'var(--text-muted)',
              }}
            >
              {s.icon}
            </span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: step === s.num ? 600 : 400,
                color: step === s.num ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Step Contents */}
      <div
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '28px',
        }}
      >
        {/* Step 1: Personal */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Personal & Address Details
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Date of Birth
                </label>
                <input
                  type="date"
                  className="input-field"
                  style={{ width: '100%', marginTop: '4px' }}
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Gender
                </label>
                <select
                  className="select-field"
                  style={{ width: '100%', marginTop: '4px' }}
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Non-Binary">Non-Binary</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Blood Group
                </label>
                <select
                  className="select-field"
                  style={{ width: '100%', marginTop: '4px' }}
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                >
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Marital Status
                </label>
                <select
                  className="select-field"
                  style={{ width: '100%', marginTop: '4px' }}
                  value={maritalStatus}
                  onChange={(e) => setMaritalStatus(e.target.value)}
                >
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Current Residential Address
              </label>
              <textarea
                className="textarea-field"
                style={{ width: '100%', marginTop: '4px', height: '60px' }}
                value={currentAddress}
                onChange={(e) => setCurrentAddress(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Permanent Address
              </label>
              <textarea
                className="textarea-field"
                style={{ width: '100%', marginTop: '4px', height: '60px' }}
                value={permanentAddress}
                onChange={(e) => setPermanentAddress(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Step 2: Emergency */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Emergency Contact Information
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              Please provide contact information for family members or emergency contacts.
            </p>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Contact Name
              </label>
              <input
                type="text"
                className="input-field"
                style={{ width: '100%', marginTop: '4px' }}
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Relationship
                </label>
                <select
                  className="select-field"
                  style={{ width: '100%', marginTop: '4px' }}
                  value={emergencyRelation}
                  onChange={(e) => setEmergencyRelation(e.target.value)}
                >
                  <option value="Spouse">Spouse</option>
                  <option value="Parent">Parent</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Child">Child</option>
                  <option value="Friend">Friend</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Phone Number
                </label>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '100%', marginTop: '4px' }}
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Bank */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Banking & Direct Deposit Setup
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Bank Name
                </label>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '100%', marginTop: '4px' }}
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Account Number
                </label>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '100%', marginTop: '4px' }}
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Routing / IFSC Code
                </label>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '100%', marginTop: '4px' }}
                  value={routingNumber}
                  onChange={(e) => setRoutingNumber(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Government Tax ID (SSN / PAN)
                </label>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '100%', marginTop: '4px' }}
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Education & Experience */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Education & Prior Experience
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Highest Degree
                </label>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '100%', marginTop: '4px' }}
                  value={degree}
                  onChange={(e) => setDegree(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Year of Graduation
                </label>
                <input
                  type="text"
                  className="input-field"
                  style={{ width: '100%', marginTop: '4px' }}
                  value={eduYear}
                  onChange={(e) => setEduYear(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                University / Institution
              </label>
              <input
                type="text"
                className="input-field"
                style={{ width: '100%', marginTop: '4px' }}
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
              />
            </div>

            <div style={{ borderTop: '1px solid var(--border-hairline)', paddingTop: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Previous Employer
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ width: '100%', marginTop: '4px' }}
                    value={prevCompany}
                    onChange={(e) => setPrevCompany(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Job Role
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ width: '100%', marginTop: '4px' }}
                    value={prevRole}
                    onChange={(e) => setPrevRole(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Tenure
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ width: '100%', marginTop: '4px' }}
                    value={prevYears}
                    onChange={(e) => setPrevYears(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Review & Digital Policy */}
        {step === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Review & Electronic Sign-off
            </h2>

            <div
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border-hairline)',
                borderRadius: 'var(--radius-sm)',
                padding: '16px',
                fontSize: '13px',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Dossier Summary for {cand?.first_name} {cand?.last_name}
              </div>
              <div>• Current Address: {currentAddress}</div>
              <div>• Emergency Contact: {emergencyName} ({emergencyRelation}) - {emergencyPhone}</div>
              <div>• Bank Direct Deposit: {bankName} (Acc: {accountNumber})</div>
              <div>• Academic Degree: {degree} ({institution}, {eduYear})</div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px 16px',
                background: 'var(--surface-0)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-hairline)',
              }}
            >
              <input
                type="checkbox"
                id="policyCheck"
                checked={policyAgreed}
                onChange={(e) => setPolicyAgreed(e.target.checked)}
                style={{ marginTop: '3px' }}
              />
              <label htmlFor="policyCheck" style={{ fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                I certify that all details provided in this onboarding dossier are accurate. I acknowledge receipt of Humora's Information Security Policy, Code of Conduct, and confidentiality terms.
              </label>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '28px',
            paddingTop: '20px',
            borderTop: '1px solid var(--border-hairline)',
          }}
        >
          {step > 1 ? (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft size={13} />
              Previous Step
            </button>
          ) : (
            <div />
          )}

          {step < 5 ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setStep(step + 1)}
            >
              Next Step
              <ArrowRight size={13} />
            </button>
          ) : (
            <button
              className="btn btn-primary"
              style={{ padding: '8px 24px', gap: '6px' }}
              onClick={handleFinalSubmit}
            >
              <Sparkles size={14} />
              Submit Onboarding Dossier
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
