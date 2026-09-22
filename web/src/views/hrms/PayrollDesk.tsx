import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/store';
import {
  fetchPayslips,
  fetchCompensationStructure,
  fetchITDeclaration,
  saveITDeclaration,
  fetchReimbursements,
  submitReimbursementClaim,
  fetchCompanyProfile,
} from '../../store/hrmsSlice';
import { addToast } from '../../store/uiSlice';
import {
  CreditCard,
  FileText,
  Download,
  Eye,
  Calculator,
  ShieldCheck,
  TrendingUp,
  Percent,
  Receipt,
  Plus,
  CheckCircle2,
  DollarSign,
  Sparkles,
  X,
} from 'lucide-react';
import { Payslip, ITDeclaration, ReimbursementClaim } from '../../types';
import { formatINR } from '../../utils/numberToWords';
import { PayslipDocumentModal } from './PayslipDocumentModal';
import { PayrollRunModal } from './PayrollRunModal';
import { PeopleOSLogo } from '../../components/PeopleOSLogo';

export const PayrollDesk: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    payslips,
    compensationStructure,
    itDeclaration,
    reimbursementClaims,
  } = useAppSelector((state) => state.hrms);

  const [activeTab, setActiveTab] = useState<'payslips' | 'ctc' | 'it_declaration' | 'reimbursements'>('payslips');
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
  const [isRunPayrollModalOpen, setIsRunPayrollModalOpen] = useState(false);

  // IT Declaration Form State
  const [declarationForm, setDeclarationForm] = useState<ITDeclaration | null>(null);
  const [isSavingTax, setIsSavingTax] = useState(false);

  // New Reimbursement Modal State
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [claimCategory, setClaimCategory] = useState<ReimbursementClaim['category']>('broadband');
  const [claimAmount, setClaimAmount] = useState('');
  const [claimMerchant, setClaimMerchant] = useState('');
  const [claimBillNumber, setClaimBillNumber] = useState('');
  const [claimBillDate, setClaimBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [claimDescription, setClaimDescription] = useState('');
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);

  useEffect(() => {
    dispatch(fetchPayslips() as any);
    dispatch(fetchCompensationStructure() as any);
    dispatch(fetchITDeclaration() as any);
    dispatch(fetchReimbursements() as any);
    dispatch(fetchCompanyProfile() as any);
  }, [dispatch]);

  useEffect(() => {
    if (itDeclaration) {
      setDeclarationForm(itDeclaration);
    }
  }, [itDeclaration]);

  const handleOpenPayslip = (payslip: Payslip) => {
    setSelectedPayslip(payslip);
    setIsPayslipModalOpen(true);
  };

  const handleSaveTaxDeclaration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!declarationForm) return;
    setIsSavingTax(true);
    try {
      await dispatch(saveITDeclaration(declarationForm) as any);
      dispatch(
        addToast({
          type: 'success',
          message: 'Income Tax declaration updated and TDS recalculated successfully!',
        })
      );
    } catch (err: any) {
      dispatch(
        addToast({
          type: 'error',
          message: err?.message || 'Failed to save tax declaration',
        })
      );
    } finally {
      setIsSavingTax(false);
    }
  };

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimAmount || Number(claimAmount) <= 0) {
      dispatch(addToast({ type: 'error', message: 'Please enter a valid claim amount' }));
      return;
    }

    setIsSubmittingClaim(true);
    try {
      const categoryNames: Record<string, string> = {
        broadband: 'High-Speed Broadband Internet',
        learning: 'Professional Skill Development',
        travel: 'Local Travel & Client Transit',
        wellness: 'Ergonomic & Wellness Support',
        office_supplies: 'Home Workstation Supplies',
      };

      await dispatch(
        submitReimbursementClaim({
          category: claimCategory,
          category_name: categoryNames[claimCategory] || 'Business Expense',
          amount: parseFloat(claimAmount),
          merchant_name: claimMerchant || 'Vendor Receipt',
          bill_number: claimBillNumber || `INV-${Math.floor(1000 + Math.random() * 9000)}`,
          bill_date: claimBillDate,
          description: claimDescription,
        }) as any
      );

      dispatch(
        addToast({
          type: 'success',
          message: 'Reimbursement claim submitted for approval!',
        })
      );

      setIsClaimModalOpen(false);
      setClaimAmount('');
      setClaimMerchant('');
      setClaimDescription('');
    } catch (err: any) {
      dispatch(
        addToast({
          type: 'error',
          message: err?.message || 'Failed to submit reimbursement claim',
        })
      );
    } finally {
      setIsSubmittingClaim(false);
    }
  };

  const latestPayslip = payslips?.[0];

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    background: 'var(--surface-0)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '13px',
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
  };

  return (
    <div
      style={{
        padding: '24px 32px',
        maxWidth: '1400px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        color: 'var(--text-primary)',
      }}
    >
      {/* 1. Header Banner */}
      <div
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border-hairline)',
          borderRadius: '16px',
          padding: '28px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '4px 10px',
              borderRadius: '20px',
              background: 'var(--accent-primary-subtle)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              color: 'var(--accent-primary)',
              fontSize: '11px',
              fontWeight: 700,
              marginBottom: '10px',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            <PeopleOSLogo size={14} />
            <span>PeopleOS &bull; Payroll & Compensation Hub</span>
          </div>
          <h1
            style={{
              fontSize: '26px',
              fontWeight: 700,
              margin: '0 0 6px',
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
            }}
          >
            My Payroll & Compensation Hub
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              color: 'var(--text-muted)',
              maxWidth: '650px',
              lineHeight: 1.5,
            }}
          >
            Access your monthly official salary slips, CTC structure, biometric attendance deductions, income tax declarations, and FBP claims.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setIsRunPayrollModalOpen(true)}
            className="btn btn-secondary"
            style={{
              padding: '10px 20px',
              fontSize: '13px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Sparkles size={15} color="var(--accent-primary)" />
            <span>Run Monthly Payroll</span>
          </button>

          {latestPayslip && (
            <button
              onClick={() => handleOpenPayslip(latestPayslip)}
              className="btn btn-primary"
              style={{
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <FileText size={15} />
              <span>View Latest Payslip ({latestPayslip.pay_period})</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Metric KPI Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        {/* KPI 1: Net Take-Home */}
        <div
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-hairline)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
              Net Take-Home Pay
            </span>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DollarSign size={16} />
            </div>
          </div>
          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>
              {formatINR(latestPayslip ? latestPayslip.net_pay : 128300)}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                color: 'var(--accent-primary)',
                marginTop: '4px',
                fontWeight: 500,
              }}
            >
              <CheckCircle2 size={13} />
              <span>Direct deposit to {latestPayslip?.bank_name || 'HDFC Bank'}</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Annual CTC */}
        <div
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-hairline)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
              Annual CTC Package
            </span>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TrendingUp size={16} />
            </div>
          </div>
          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>
              {formatINR(compensationStructure?.annual_ctc || 1800000)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Monthly Gross: <strong style={{ color: 'var(--text-primary)' }}>{formatINR(compensationStructure?.monthly_gross || 150000)}</strong>
            </div>
          </div>
        </div>

        {/* KPI 3: Tax Regime */}
        <div
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-hairline)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
              Tax Regime Selected
            </span>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Percent size={16} />
            </div>
          </div>
          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
              {declarationForm?.regime || 'new'} Regime
            </div>
            <div style={{ fontSize: '11px', color: 'var(--accent-primary)', marginTop: '4px', fontWeight: 500 }}>
              Monthly TDS: <strong style={{ fontFamily: 'var(--font-mono)' }}>{formatINR(declarationForm?.monthly_tds || 12500)}</strong>
            </div>
          </div>
        </div>

        {/* KPI 4: Approved Claims */}
        <div
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-hairline)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
              Approved FBP Claims
            </span>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Receipt size={16} />
            </div>
          </div>
          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>
              {formatINR(
                reimbursementClaims
                  ?.filter((c) => c.status === 'approved' || c.status === 'reimbursed')
                  .reduce((sum, c) => sum + c.amount, 0) || 17398
              )}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--accent-primary)', marginTop: '4px', fontWeight: 500 }}>
              Flexible Benefit Plan (FBP)
            </div>
          </div>
        </div>
      </div>

      {/* 3. Tab Bar Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '2px',
          overflowX: 'auto',
        }}
      >
        <button
          onClick={() => setActiveTab('payslips')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'payslips' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            color: activeTab === 'payslips' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: '13px',
            fontWeight: 600,
            padding: '10px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap',
          }}
        >
          <FileText size={15} />
          <span>Payslips & Pay Stubs</span>
        </button>

        <button
          onClick={() => setActiveTab('ctc')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'ctc' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            color: activeTab === 'ctc' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: '13px',
            fontWeight: 600,
            padding: '10px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap',
          }}
        >
          <Calculator size={15} />
          <span>Salary Structure & CTC</span>
        </button>

        <button
          onClick={() => setActiveTab('it_declaration')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'it_declaration' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            color: activeTab === 'it_declaration' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: '13px',
            fontWeight: 600,
            padding: '10px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap',
          }}
        >
          <ShieldCheck size={15} />
          <span>IT Declaration & Regime Planner</span>
        </button>

        <button
          onClick={() => setActiveTab('reimbursements')}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'reimbursements' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            color: activeTab === 'reimbursements' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: '13px',
            fontWeight: 600,
            padding: '10px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap',
          }}
        >
          <Receipt size={15} />
          <span>Reimbursements (FBP)</span>
        </button>
      </div>

      {/* 4. TAB 1 CONTENT: Payslips & Pay Stubs */}
      {activeTab === 'payslips' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 4px', color: 'var(--text-primary)' }}>
              Monthly Payslip History
            </h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
              Official monthly payslips generated with biometric attendance reconciliation and corporate seal.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {payslips?.map((ps) => (
              <div
                key={ps.id}
                style={{
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: '12px',
                  padding: '20px 24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      background: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      color: 'var(--accent-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FileText size={22} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {ps.pay_period}
                      </h3>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: 'rgba(245, 158, 11, 0.12)',
                          color: 'var(--accent-primary)',
                          border: '1px solid rgba(245, 158, 11, 0.25)',
                        }}
                      >
                        {ps.status}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        marginTop: '6px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span>Payment Date: <strong style={{ color: 'var(--text-secondary)' }}>{ps.payment_date}</strong></span>
                      <span>•</span>
                      <span>Total Days: <strong style={{ color: 'var(--text-secondary)' }}>{ps.total_days}</strong></span>
                      <span>•</span>
                      <span>Payable: <strong style={{ color: 'var(--accent-primary)' }}>{ps.payable_days} Days</strong></span>
                      {ps.lop_days > 0 ? (
                        <>
                          <span>•</span>
                          <span style={{ color: 'var(--accent-rose)', fontWeight: 600 }}>
                            {ps.lop_days} Day LOP ({formatINR(ps.lop_deduction)} deducted)
                          </span>
                        </>
                      ) : (
                        <>
                          <span>•</span>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>0 LOP Days</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '24px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Net Pay</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                      {formatINR(ps.net_pay)}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                      Gross: {formatINR(ps.gross_earnings)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleOpenPayslip(ps)}
                      className="btn btn-ghost"
                      style={{
                        padding: '8px 14px',
                        fontSize: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                      }}
                    >
                      <Eye size={14} color="var(--accent-primary)" />
                      <span>View</span>
                    </button>
                    <button
                      onClick={() => handleOpenPayslip(ps)}
                      className="btn btn-primary"
                      style={{
                        padding: '8px 14px',
                        fontSize: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        borderRadius: '6px',
                      }}
                    >
                      <Download size={14} />
                      <span>Download PDF</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Calculation Engine Explainer */}
          <div
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border-hairline)',
              borderRadius: '14px',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: 600, fontSize: '14px' }}>
              <Calculator size={16} color="var(--accent-primary)" />
              <span>How PeopleOS Calculates Your Salary</span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '16px',
                fontSize: '12px',
              }}
            >
              <div
                style={{
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: '8px',
                  padding: '14px',
                }}
              >
                <div style={{ color: 'var(--accent-primary)', fontWeight: 600, marginBottom: '4px' }}>1. Gross Fixed Earnings</div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Basic Salary (50%) + HRA (20%) + Conveyance + Medical + Special Allowance.
                </div>
              </div>

              <div
                style={{
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: '8px',
                  padding: '14px',
                }}
              >
                <div style={{ color: 'var(--accent-rose)', fontWeight: 600, marginBottom: '4px' }}>2. Biometric LOP Deduction</div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Automatic calculation from check-ins:
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-primary)', marginTop: '3px' }}>
                    (Gross ÷ Month Calendar Days) × Absent Days
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: '8px',
                  padding: '14px',
                }}
              >
                <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '4px' }}>3. Statutory Deductions & In-Hand</div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  EPF 12% + Professional Tax (₹200) + TDS based on selected IT regime. Net pay transferred to bank.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 2 CONTENT: Salary Structure & CTC */}
      {activeTab === 'ctc' && (
        <div
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-hairline)',
            borderRadius: '14px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 4px', color: 'var(--text-primary)' }}>
                Cost to Company (CTC) Structure
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                Annual compensation schedule effective from {compensationStructure?.effective_date || '2026-04-01'}.
              </p>
            </div>

            <div
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                background: 'var(--accent-primary-subtle)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                color: 'var(--accent-primary)',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              Total CTC: {formatINR(compensationStructure?.annual_ctc || 1800000)} / year
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Component</th>
                  <th style={{ padding: '12px 16px' }}>Calculation Basis</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Monthly (₹)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Annual (₹)</th>
                </tr>
              </thead>
              <tbody>
                {/* Part A Header */}
                <tr style={{ background: 'rgba(245, 158, 11, 0.06)', borderBottom: '1px solid var(--border-hairline)' }}>
                  <td colSpan={4} style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--accent-primary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Part A: Fixed Monthly Earnings
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 500 }}>Basic Salary</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>50% of Monthly Gross</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatINR(compensationStructure?.basic || 75000)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatINR((compensationStructure?.basic || 75000) * 12)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 500 }}>House Rent Allowance (HRA)</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>20% of Monthly Gross</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatINR(compensationStructure?.hra || 30000)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatINR((compensationStructure?.hra || 30000) * 12)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 500 }}>Conveyance Allowance</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Standard Travel Exemption</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatINR(compensationStructure?.conveyance || 3200)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatINR((compensationStructure?.conveyance || 3200) * 12)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 500 }}>Medical Allowance</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Medical Expense Allowance</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatINR(compensationStructure?.medical_allowance || 2500)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatINR((compensationStructure?.medical_allowance || 2500) * 12)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 500 }}>Special Allowance</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Flexible Gross Balancing</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatINR(compensationStructure?.special_allowance || 39300)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatINR((compensationStructure?.special_allowance || 39300) * 12)}</td>
                </tr>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--border-subtle)', fontWeight: 700 }}>
                  <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>Total Gross Earnings (A)</td>
                  <td style={{ padding: '12px 16px' }}></td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{formatINR(compensationStructure?.monthly_gross || 150000)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{formatINR((compensationStructure?.monthly_gross || 150000) * 12)}</td>
                </tr>

                {/* Part B Header */}
                <tr style={{ background: 'rgba(245, 158, 11, 0.06)', borderBottom: '1px solid var(--border-hairline)' }}>
                  <td colSpan={4} style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--accent-primary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Part B: Retiral & Statutory Contributions
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 500 }}>Employer Provident Fund (PF)</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>12% of Basic</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatINR(compensationStructure?.employer_pf || 9000)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatINR((compensationStructure?.employer_pf || 9000) * 12)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 500 }}>Employee Provident Fund (PF)</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>12% of Basic</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatINR(compensationStructure?.provident_fund || 9000)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatINR((compensationStructure?.provident_fund || 9000) * 12)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 500 }}>Gratuity</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>4.81% of Basic</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatINR(compensationStructure?.gratuity || 3607)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatINR((compensationStructure?.gratuity || 3607) * 12)}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 500 }}>Professional Tax (PT)</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Statutory State Levy</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatINR(compensationStructure?.professional_tax || 200)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatINR((compensationStructure?.professional_tax || 200) * 12)}</td>
                </tr>

                {/* Net Take-Home Highlight */}
                <tr style={{ background: 'rgba(245, 158, 11, 0.1)', borderTop: '2px solid rgba(245, 158, 11, 0.35)' }}>
                  <td style={{ padding: '16px', color: 'var(--text-primary)', fontWeight: 700, fontSize: '13px' }}>
                    Estimated Monthly Take-Home (Pre-TDS)
                  </td>
                  <td style={{ padding: '16px' }}></td>
                  <td style={{ padding: '16px', textAlign: 'right', color: 'var(--accent-primary)', fontWeight: 700, fontSize: '15px', fontFamily: 'var(--font-mono)' }}>
                    {formatINR(128300)}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right', color: 'var(--accent-primary)', fontWeight: 700, fontSize: '15px', fontFamily: 'var(--font-mono)' }}>
                    {formatINR(128300 * 12)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. TAB 3 CONTENT: IT Declaration & Regime Planner */}
      {activeTab === 'it_declaration' && declarationForm && (
        <form onSubmit={handleSaveTaxDeclaration} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Regime Switcher Card */}
          <div
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border-hairline)',
              borderRadius: '14px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 4px', color: 'var(--text-primary)' }}>
                  Tax Regime Planner (FY {declarationForm.financial_year})
                </h2>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                  Choose your Income Tax regime. Humora recalculates monthly TDS according to your election.
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  background: 'var(--surface-0)',
                  padding: '4px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setDeclarationForm({ ...declarationForm, regime: 'new' })}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: declarationForm.regime === 'new' ? 'var(--accent-primary)' : 'transparent',
                    color: declarationForm.regime === 'new' ? 'var(--text-primary)' : 'var(--text-muted)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  New Regime (115BAC)
                </button>
                <button
                  type="button"
                  onClick={() => setDeclarationForm({ ...declarationForm, regime: 'old' })}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: declarationForm.regime === 'old' ? 'var(--accent-primary)' : 'transparent',
                    color: declarationForm.regime === 'old' ? 'var(--text-primary)' : 'var(--text-muted)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Old Regime (With Exemptions)
                </button>
              </div>
            </div>

            {/* Tax Savings Comparison Card */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(180, 83, 9, 0.06) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '10px',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Sparkles size={20} color="var(--accent-primary)" />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                    Tax Optimizer Recommendation
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Based on your CTC of ₹18,00,000, New Regime yields an annual saving of{' '}
                    <strong style={{ color: 'var(--accent-primary)' }}>{formatINR(declarationForm.regime_comparison?.annual_savings || 12400)}</strong> compared to Old Regime.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '24px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Forecasted Monthly TDS</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {formatINR(declarationForm.monthly_tds)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Annual Tax Liability</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                    {formatINR(declarationForm.projected_annual_tax)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chapter VI-A Deductions */}
          <div
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border-hairline)',
              borderRadius: '14px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              opacity: declarationForm.regime === 'new' ? 0.75 : 1,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} color="var(--accent-primary)" />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Chapter VI-A Tax Deductions & Exemptions
                </h3>
              </div>
              {declarationForm.regime === 'new' && (
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    background: 'var(--surface-0)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-hairline)',
                  }}
                >
                  New Regime applies concessional slabs; Chapter VI-A deductions are bypassed.
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Section 80C (PPF, EPF, ELSS) — Max ₹1,50,000</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={declarationForm.sec_80c_total}
                  onChange={(e) =>
                    setDeclarationForm({
                      ...declarationForm,
                      sec_80c_total: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div>
                <label style={labelStyle}>Section 80D (Self & Family Health Cover) — Max ₹25,000</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={declarationForm.sec_80d_health_insurance}
                  onChange={(e) =>
                    setDeclarationForm({
                      ...declarationForm,
                      sec_80d_health_insurance: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div>
                <label style={labelStyle}>Section 80D (Parents Health Insurance) — Max ₹50,000</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={declarationForm.sec_80d_parents}
                  onChange={(e) =>
                    setDeclarationForm({
                      ...declarationForm,
                      sec_80d_parents: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div>
                <label style={labelStyle}>National Pension System (NPS 80CCD(1B)) — Max ₹50,000</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={declarationForm.nps_contribution}
                  onChange={(e) =>
                    setDeclarationForm({
                      ...declarationForm,
                      nps_contribution: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div>
                <label style={labelStyle}>Annual Rent Paid for HRA Exemption (₹)</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={declarationForm.hra_annual_rent_paid}
                  onChange={(e) =>
                    setDeclarationForm({
                      ...declarationForm,
                      hra_annual_rent_paid: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div>
                <label style={labelStyle}>Landlord PAN (Required if rent exceeds ₹1,00,000)</label>
                <input
                  type="text"
                  style={{ ...inputStyle, textTransform: 'uppercase' }}
                  placeholder="e.g. AAAPL9821K"
                  value={declarationForm.hra_landlord_pan || ''}
                  onChange={(e) =>
                    setDeclarationForm({
                      ...declarationForm,
                      hra_landlord_pan: e.target.value.toUpperCase(),
                    })
                  }
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '12px' }}>
              <button
                type="submit"
                disabled={isSavingTax}
                className="btn btn-primary"
                style={{ padding: '10px 22px', fontSize: '13px', fontWeight: 600 }}
              >
                {isSavingTax ? 'Recalculating...' : 'Save & Submit Tax Declaration'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* 7. TAB 4 CONTENT: Reimbursements (FBP) */}
      {activeTab === 'reimbursements' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 4px', color: 'var(--text-primary)' }}>
                Reimbursements & Flexible Benefit Plan (FBP)
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                Submit tax-free business claims for internet, certifications, travel, and ergonomic equipment.
              </p>
            </div>

            <button
              onClick={() => setIsClaimModalOpen(true)}
              className="btn btn-primary"
              style={{ padding: '9px 18px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={15} />
              <span>Submit New Claim</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {reimbursementClaims?.map((claim) => (
              <div
                key={claim.id}
                style={{
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: '12px',
                  padding: '18px 24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background: 'var(--accent-primary-subtle)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      color: 'var(--accent-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Receipt size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {claim.category_name}
                      </h4>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background:
                            claim.status === 'reimbursed'
                              ? 'rgba(245, 158, 11, 0.15)'
                              : claim.status === 'approved'
                              ? 'rgba(245, 158, 11, 0.08)'
                              : 'rgba(245, 158, 11, 0.05)',
                          color:
                            claim.status === 'reimbursed'
                              ? 'var(--accent-primary)'
                              : claim.status === 'approved'
                              ? 'var(--text-secondary)'
                              : 'var(--text-muted)',
                          border: `1px solid ${
                            claim.status === 'reimbursed'
                              ? 'rgba(245, 158, 11, 0.3)'
                              : claim.status === 'approved'
                              ? 'var(--border-subtle)'
                              : 'var(--border-hairline)'
                          }`,
                        }}
                      >
                        {claim.status}
                      </span>
                    </div>

                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '600px', lineHeight: 1.4 }}>
                      {claim.description}
                    </p>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        marginTop: '6px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span>Merchant: <strong style={{ color: 'var(--text-secondary)' }}>{claim.merchant_name}</strong></span>
                      <span>•</span>
                      <span>Bill #: <strong style={{ color: 'var(--text-secondary)' }}>{claim.bill_number}</strong></span>
                      <span>•</span>
                      <span>Date: <strong style={{ color: 'var(--text-secondary)' }}>{claim.bill_date}</strong></span>
                      {claim.reviewer_name && (
                        <>
                          <span>•</span>
                          <span>Reviewer: <strong style={{ color: 'var(--accent-primary)' }}>{claim.reviewer_name}</strong></span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>Claim Amount</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                    {formatINR(claim.amount)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Reimbursement Claim Modal */}
      {isClaimModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '520px',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-popover)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 24px',
                borderBottom: '1px solid var(--border-hairline)',
                background: 'var(--surface-1)',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Submit Reimbursement Claim
              </h3>
              <button
                onClick={() => setIsClaimModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitClaim} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Category *</label>
                <select
                  value={claimCategory}
                  onChange={(e) => setClaimCategory(e.target.value as any)}
                  style={inputStyle}
                >
                  <option value="broadband">High-Speed Broadband Internet</option>
                  <option value="learning">Professional Skill & Certification</option>
                  <option value="travel">Local Travel & Client Transit</option>
                  <option value="wellness">Ergonomic & Wellness Support</option>
                  <option value="office_supplies">Home Workstation Supplies</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Amount (₹) *</label>
                  <input
                    type="number"
                    value={claimAmount}
                    onChange={(e) => setClaimAmount(e.target.value)}
                    placeholder="e.g. 2399"
                    required
                    min="1"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Bill Date *</label>
                  <input
                    type="date"
                    value={claimBillDate}
                    onChange={(e) => setClaimBillDate(e.target.value)}
                    required
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Merchant / Provider *</label>
                  <input
                    type="text"
                    value={claimMerchant}
                    onChange={(e) => setClaimMerchant(e.target.value)}
                    placeholder="e.g. ACT Fibernet"
                    required
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Bill / Invoice Number</label>
                  <input
                    type="text"
                    value={claimBillNumber}
                    onChange={(e) => setClaimBillNumber(e.target.value)}
                    placeholder="e.g. INV-9921"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Description & Justification *</label>
                <textarea
                  value={claimDescription}
                  onChange={(e) => setClaimDescription(e.target.value)}
                  placeholder="e.g. Monthly Gigabit fiber broadband for cloud operations..."
                  rows={3}
                  required
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-hairline)' }}>
                <button
                  type="button"
                  onClick={() => setIsClaimModalOpen(false)}
                  className="btn btn-ghost"
                  style={{ padding: '8px 16px', fontSize: '12px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingClaim}
                  className="btn btn-primary"
                  style={{ padding: '8px 18px', fontSize: '12px', fontWeight: 600 }}
                >
                  {isSubmittingClaim ? 'Submitting...' : 'Submit Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Payslip Modal */}
      <PayslipDocumentModal
        payslip={selectedPayslip}
        isOpen={isPayslipModalOpen}
        onClose={() => setIsPayslipModalOpen(false)}
      />

      {/* Monthly Payroll Engine Modal */}
      <PayrollRunModal
        isOpen={isRunPayrollModalOpen}
        onClose={() => setIsRunPayrollModalOpen(false)}
      />
    </div>
  );
};
