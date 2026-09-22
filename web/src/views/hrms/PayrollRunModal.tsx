import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  DollarSign,
  Users,
  ShieldCheck,
  TrendingDown,
  Sparkles,
  ArrowRight,
  Check,
} from 'lucide-react';
import { formatINR } from '../../utils/numberToWords';
import { useAppDispatch } from '../../store/store';
import { previewPayrollRun, executePayrollRun, fetchPayslips } from '../../store/hrmsStore';
import { addToast } from '../../store/uiSlice';

interface PayrollRunModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PayrollPreviewItem {
  employee_id: string;
  employee_name: string;
  employee_code: string;
  department_name: string;
  designation_title: string;
  total_days: number;
  working_days: number;
  present_days: number;
  approved_leave_days: number;
  lop_days: number;
  payable_days: number;
  monthly_base_gross: number;
  prorated_basic: number;
  prorated_hra: number;
  special_allowance: number;
  gross_earnings: number;
  pf_deduction: number;
  pt_deduction: number;
  tds_deduction: number;
  lop_deduction: number;
  total_deductions: number;
  net_pay: number;
  has_biometric_record: boolean;
}

interface PreviewData {
  month: number;
  year: number;
  pay_period: string;
  total_employees: number;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  employees: PayrollPreviewItem[];
}

export const PayrollRunModal: React.FC<PayrollRunModalProps> = ({ isOpen, onClose }) => {
  const dispatch = useAppDispatch();
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());

  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any | null>(null);

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  const loadPreview = async (m: number, y: number) => {
    setIsLoadingPreview(true);
    setPreviewError(null);
    setExecutionResult(null);
    try {
      const res = await dispatch(previewPayrollRun(m, y)() as any);
      setPreviewData(res);
    } catch (err: any) {
      setPreviewError(err?.message || 'Failed to generate payroll preview');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPreview(selectedMonth, selectedYear);
    }
  }, [isOpen, selectedMonth, selectedYear]);

  const handleExecute = async () => {
    setIsExecuting(true);
    try {
      const res = await dispatch(executePayrollRun(selectedMonth, selectedYear)() as any);
      setExecutionResult(res);
      dispatch(fetchPayslips()() as any);
      dispatch(
        addToast({
          type: 'success',
          message: `Payroll finalized! ${res.payslips_created} payslips generated for ${res.pay_period}.`,
        })
      );
    } catch (err: any) {
      dispatch(
        addToast({
          type: 'error',
          message: err?.message || 'Failed to execute payroll run',
        })
      );
    } finally {
      setIsExecuting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1050,
        background: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1080px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#0e121e',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: '16px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 30px rgba(99, 102, 241, 0.15)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 28px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'linear-gradient(180deg, #161b2e 0%, #0e121e 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'var(--accent-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px var(--accent-ring)',
              }}
            >
              <Sparkles size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Run Automated Monthly Payroll
                </h2>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'var(--accent-primary-subtle)',
                    color: 'var(--accent-primary)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                  }}
                >
                  Statutory Engine Active
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                Attendance-driven LOP calculation, PF (12%), PT (₹200), IT Regime TDS, & Payslip Publishing
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
              borderRadius: '8px',
              display: 'flex',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Controls Bar: Select Month & Year */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--surface-1)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '14px 20px',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Calendar size={18} color="var(--accent-primary)" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Payroll Period:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                disabled={isExecuting}
                style={{
                  background: 'var(--surface-0)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  padding: '6px 12px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                disabled={isExecuting}
                style={{
                  background: 'var(--surface-0)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  padding: '6px 12px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => loadPreview(selectedMonth, selectedYear)}
                disabled={isLoadingPreview || isExecuting}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-hairline)',
                  color: '#cbd5e1',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Clock size={14} />
                <span>Refresh Calculations</span>
              </button>
            </div>
          </div>

          {/* Success Banner if Executed */}
          {executionResult && (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.08) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'rgba(245, 158, 11, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-primary)',
                }}
              >
                <CheckCircle2 size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Payroll Run Successfully Executed & Locked!
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {executionResult.message} Official payslips have been generated with net amounts written in words and made visible to all employees.
                </div>
              </div>
            </div>
          )}

          {/* Loading or Error State */}
          {isLoadingPreview && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>
                <Sparkles size={28} color="var(--accent-primary)" />
              </div>
              <p style={{ marginTop: '12px', fontSize: '13px' }}>
                Analyzing biometric attendance, approved leaves, and tax regimes...
              </p>
            </div>
          )}

          {previewError && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '10px',
                padding: '14px 18px',
                color: '#f87171',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <AlertCircle size={18} />
              <span>{previewError}</span>
            </div>
          )}

          {/* Preview Overview Cards */}
          {!isLoadingPreview && previewData && (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '14px',
                }}
              >
                <div
                  style={{
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border-hairline)',
                    borderRadius: '10px',
                    padding: '14px 18px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Employees Included
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {previewData.total_employees}
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border-hairline)',
                    borderRadius: '10px',
                    padding: '14px 18px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Prorated Gross
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {formatINR(previewData.total_gross)}
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border-hairline)',
                    borderRadius: '10px',
                    padding: '14px 18px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Statutory Deductions
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-rose)', marginTop: '4px' }}>
                    {formatINR(previewData.total_deductions)}
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    borderRadius: '10px',
                    padding: '14px 18px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Net Disbursable Pay
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-primary)', marginTop: '4px' }}>
                    {formatINR(previewData.total_net)}
                  </div>
                </div>
              </div>

              {/* Employee Attendance Breakdown Table */}
              <div
                style={{
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '14px 20px',
                    background: 'var(--surface-2)',
                    borderBottom: '1px solid var(--border-hairline)',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>Itemized Employee Attendance & Statutory Calculation</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>
                    Working Days: {previewData.employees?.[0]?.working_days || 22} Days
                  </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-hairline)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '12px 16px' }}>Employee</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Face Punches</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Approved Leave</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>LOP Days</th>
                        <th style={{ padding: '12px 14px', textAlign: 'center' }}>Payable Days</th>
                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Base Gross</th>
                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Prorated Gross</th>
                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Deductions</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right' }}>Net Take-Home</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.employees?.map((emp) => (
                        <tr
                          key={emp.employee_id}
                          style={{
                            borderBottom: '1px solid var(--border-hairline)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600 }}>{emp.employee_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {emp.employee_code} • {emp.designation_title}
                            </div>
                          </td>

                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                background: 'rgba(59, 130, 246, 0.15)',
                                color: '#60a5fa',
                                fontWeight: 600,
                              }}
                            >
                              <ShieldCheck size={12} />
                              {emp.present_days} Days
                            </span>
                          </td>

                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <span style={{ color: '#cbd5e1' }}>{emp.approved_leave_days} Days</span>
                          </td>

                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <span
                              style={{
                                color: emp.lop_days > 0 ? 'var(--accent-rose)' : 'var(--text-secondary)',
                                fontWeight: 700,
                              }}
                            >
                              {emp.lop_days} Day(s)
                            </span>
                          </td>

                          <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {emp.payable_days} / {emp.total_days}
                          </td>

                          <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-muted)' }}>
                            {formatINR(emp.monthly_base_gross)}
                          </td>

                          <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {formatINR(emp.gross_earnings)}
                          </td>

                          <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--accent-rose)' }}>
                            - {formatINR(emp.total_deductions)}
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              PF:{formatINR(emp.pf_deduction)} PT:{formatINR(emp.pt_deduction)} TDS:{formatINR(emp.tds_deduction)}
                            </div>
                          </td>

                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--accent-primary)', fontSize: '13px' }}>
                            {formatINR(emp.net_pay)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div
          style={{
            padding: '16px 28px',
            borderTop: '1px solid var(--border-hairline)',
            background: 'var(--surface-1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <ShieldCheck size={16} color="var(--accent-primary)" />
            <span>Biometric attendance & leave policies synced automatically.</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                color: '#cbd5e1',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              onClick={handleExecute}
              disabled={isExecuting || isLoadingPreview || !previewData || previewData.total_employees === 0}
              className="btn btn-primary"
              style={{
                padding: '9px 24px',
                fontSize: '13px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--accent-gradient)',
                boxShadow: '0 4px 14px var(--accent-ring)',
              }}
            >
              {isExecuting ? (
                <>
                  <div style={{ width: '14px', height: '14px', border: '2px solid #ffffff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <span>Processing Payroll Batch...</span>
                </>
              ) : (
                <>
                  <Play size={15} fill="#ffffff" />
                  <span>Finalize & Run Payroll ({months.find((m) => m.value === selectedMonth)?.label} {selectedYear})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
