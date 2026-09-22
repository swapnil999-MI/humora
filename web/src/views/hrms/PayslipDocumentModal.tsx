import React from 'react';
import { X, Printer, Download, ShieldCheck, FileText } from 'lucide-react';
import { Payslip } from '../../types';
import { formatINR } from '../../utils/numberToWords';
import { useAppSelector } from '../../store/store';

interface PayslipDocumentModalProps {
  payslip: Payslip | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PayslipDocumentModal: React.FC<PayslipDocumentModalProps> = ({
  payslip,
  isOpen,
  onClose,
}) => {
  const activeCompany = useAppSelector((state) => state.hrms.companyProfile);
  if (!isOpen || !payslip) return null;

  const comp = activeCompany || payslip.company_snapshot;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        overflowY: 'auto',
      }}
    >
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-payslip-canvas, #printable-payslip-canvas * {
            visibility: visible !important;
          }
          #printable-payslip-canvas {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Main Container */}
      <div
        style={{
          width: '100%',
          maxWidth: '920px',
          background: 'var(--surface-1)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-popover)',
          margin: 'auto',
        }}
      >
        {/* Top Control Bar (Hidden on Print) */}
        <div
          className="no-print"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 24px',
            background: 'var(--surface-2)',
            borderBottom: '1px solid var(--border-hairline)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={18} color="var(--accent-primary)" />
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Official Payslip — {payslip.pay_period}
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                padding: '2px 8px',
                borderRadius: '10px',
                background: 'var(--accent-primary-subtle)',
                color: 'var(--accent-primary)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
              }}
            >
              {payslip.status}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handlePrint}
              className="btn btn-ghost"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                fontSize: '12px',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
              }}
            >
              <Printer size={14} color="var(--accent-primary)" />
              <span>Print</span>
            </button>
            <button
              onClick={handlePrint}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 16px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '6px',
              }}
            >
              <Download size={14} />
              <span>Download PDF</span>
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Paper Canvas */}
        <div
          id="printable-payslip-canvas"
          style={{
            background: '#ffffff',
            color: '#0f172a',
            padding: '36px 44px',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '12px',
            lineHeight: 1.45,
          }}
        >
          {/* Header section with Company Branding */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: '2px solid #0f172a',
              paddingBottom: '20px',
              gap: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              {comp.logo_url ? (
                <img
                  src={comp.logo_url}
                  alt={comp.name || comp.legal_name}
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '10px',
                    objectFit: 'cover',
                    border: '1px solid #e2e8f0',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '10px',
                    background: 'var(--accent-primary)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '24px',
                  }}
                >
                  {(comp.name || comp.legal_name || 'C').charAt(0)}
                </div>
              )}
              <div>
                <h1 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px', color: '#0f172a' }}>
                  {comp.legal_name || comp.name}
                </h1>
                <p style={{ margin: 0, fontSize: '11px', color: '#475569', maxWidth: '420px' }}>
                  {comp.address_line1}, {comp.address_line2 ? `${comp.address_line2}, ` : ''}
                  {comp.city}, {comp.state} - {comp.pincode}, {comp.country}
                </p>
                <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  <span>Email: {comp.contact_email}</span>
                  <span>Website: {comp.website}</span>
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  display: 'inline-block',
                  background: '#0f172a',
                  color: '#ffffff',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  fontWeight: 700,
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '8px',
                }}
              >
                Payslip — {payslip.pay_period.toUpperCase()}
              </div>
              <div style={{ fontSize: '11px', color: '#475569', lineHeight: 1.4 }}>
                <div><strong>CIN:</strong> {comp.cin || 'N/A'}</div>
                <div><strong>GSTIN:</strong> {comp.gstin || 'N/A'}</div>
                <div><strong>PAN:</strong> {comp.pan || 'N/A'} | <strong>TAN:</strong> {comp.tan || 'N/A'}</div>
              </div>
            </div>
          </div>

          {/* Employee & Bank Info Matrix */}
          <div
            style={{
              margin: '20px 0',
              padding: '16px 20px',
              background: '#f8fafc',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '12px 16px',
                fontSize: '11px',
              }}
            >
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '10px' }}>Employee Name</span>
                <strong style={{ color: '#0f172a', fontSize: '12px' }}>{payslip.employee_name}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '10px' }}>Employee Code</span>
                <strong style={{ color: '#0f172a', fontSize: '12px' }}>{payslip.employee_code}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '10px' }}>Designation</span>
                <span style={{ color: '#1e293b', fontWeight: 500 }}>{payslip.designation_title}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '10px' }}>Department</span>
                <span style={{ color: '#1e293b', fontWeight: 500 }}>{payslip.department_name}</span>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '10px' }}>Date of Joining</span>
                <span style={{ color: '#1e293b' }}>{payslip.date_of_joining}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '10px' }}>Bank Name & Account</span>
                <span style={{ color: '#1e293b', fontWeight: 500 }}>{payslip.bank_name} ({payslip.bank_account_masked})</span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '10px' }}>Bank IFSC</span>
                <span style={{ color: '#1e293b' }}>{payslip.bank_ifsc}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '10px' }}>Payment Date</span>
                <span style={{ color: '#1e293b' }}>{payslip.payment_date}</span>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '10px' }}>PAN</span>
                <span style={{ color: '#1e293b', fontWeight: 500 }}>{payslip.pan}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '10px' }}>Universal Account No (UAN)</span>
                <span style={{ color: '#1e293b', fontWeight: 500 }}>{payslip.uan}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '10px' }}>Total / Payable Days</span>
                <span style={{ color: '#1e293b' }}>
                  {payslip.total_days} Days / <strong style={{ color: '#047857' }}>{payslip.payable_days} Days</strong>
                </span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '10px' }}>Loss of Pay (LOP) Days</span>
                <span style={{ color: payslip.lop_days > 0 ? '#dc2626' : '#1e293b', fontWeight: 600 }}>
                  {payslip.lop_days} Day(s)
                </span>
              </div>
            </div>
          </div>

          {/* Itemized Dual-Column Table */}
          <div
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              overflow: 'hidden',
              marginBottom: '20px',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                background: '#f1f5f9',
                borderBottom: '1px solid #cbd5e1',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#334155',
              }}
            >
              <div style={{ padding: '10px 16px', borderRight: '1px solid #cbd5e1' }}>Earnings</div>
              <div style={{ padding: '10px 16px' }}>Deductions</div>
            </div>

            {/* Rows */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: '12px' }}>
              {/* Earnings column */}
              <div style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#475569' }}>Basic Salary</span>
                  <span style={{ fontWeight: 500, color: '#0f172a' }}>{formatINR(payslip.basic)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#475569' }}>House Rent Allowance (HRA)</span>
                  <span style={{ fontWeight: 500, color: '#0f172a' }}>{formatINR(payslip.hra)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#475569' }}>Conveyance Allowance</span>
                  <span style={{ fontWeight: 500, color: '#0f172a' }}>{formatINR(payslip.conveyance)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#475569' }}>Medical Allowance</span>
                  <span style={{ fontWeight: 500, color: '#0f172a' }}>{formatINR(payslip.medical_allowance)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#475569' }}>Special Allowance</span>
                  <span style={{ fontWeight: 500, color: '#0f172a' }}>{formatINR(payslip.special_allowance)}</span>
                </div>
                {payslip.bonus > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#047857', fontWeight: 600 }}>
                    <span>Performance Incentive</span>
                    <span>{formatINR(payslip.bonus)}</span>
                  </div>
                )}
              </div>

              {/* Deductions column */}
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#475569' }}>Provident Fund (Employee 12%)</span>
                  <span style={{ fontWeight: 500, color: '#0f172a' }}>{formatINR(payslip.provident_fund)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#475569' }}>Professional Tax (PT)</span>
                  <span style={{ fontWeight: 500, color: '#0f172a' }}>{formatINR(payslip.professional_tax)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#475569' }}>Income Tax (TDS)</span>
                  <span style={{ fontWeight: 500, color: '#0f172a' }}>{formatINR(payslip.tds)}</span>
                </div>
                {payslip.lop_deduction > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', fontWeight: 600 }}>
                    <span>Loss of Pay (LOP) Attendance Deduction</span>
                    <span>{formatINR(payslip.lop_deduction)}</span>
                  </div>
                )}
                {payslip.other_deductions > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#475569' }}>Other Deductions</span>
                    <span style={{ fontWeight: 500, color: '#0f172a' }}>{formatINR(payslip.other_deductions)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Totals Bar */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                background: '#f8fafc',
                borderTop: '1px solid #cbd5e1',
                fontSize: '12px',
                fontWeight: 700,
                color: '#0f172a',
              }}
            >
              <div style={{ padding: '10px 16px', borderRight: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
                <span>Gross Earnings (A)</span>
                <span style={{ color: '#047857' }}>{formatINR(payslip.gross_earnings)}</span>
              </div>
              <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Deductions (B)</span>
                <span style={{ color: '#dc2626' }}>{formatINR(payslip.total_deductions)}</span>
              </div>
            </div>
          </div>

          {/* Net Pay Highlight Banner */}
          <div
            style={{
              background: '#eef2ff',
              border: '1px solid #c7d2fe',
              borderRadius: '10px',
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#3730a3', letterSpacing: '0.05em' }}>
                Net Take-Home Pay (A - B)
              </div>
              <div style={{ fontSize: '12px', color: '#4338ca', marginTop: '2px', fontWeight: 500 }}>
                Amount in Words: <em>{payslip.net_pay_in_words}</em>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#1e1b4b', letterSpacing: '-0.02em' }}>
                {formatINR(payslip.net_pay)}
              </div>
              <div style={{ fontSize: '10px', color: '#047857', fontWeight: 600 }}>
                • Transferred directly to {payslip.bank_name}
              </div>
            </div>
          </div>

          {/* Footer & Digital Authentication */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              borderTop: '1px solid #e2e8f0',
              paddingTop: '20px',
              fontSize: '11px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#047857', fontWeight: 600 }}>
                <ShieldCheck size={16} />
                <span>Digitally Authenticated by Humora Corporate Payroll System</span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#94a3b8' }}>
                This document is electronically generated and adheres to Section 192 of the Income Tax Act, 1961.
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontStyle: 'italic', fontSize: '16px', color: '#1e293b', borderBottom: '1px solid #94a3b8', paddingBottom: '4px', marginBottom: '4px' }}>
                {comp.signatory_name}
              </div>
              <div style={{ fontWeight: 700, color: '#0f172a' }}>{comp.signatory_name}</div>
              <div style={{ color: '#64748b' }}>{comp.signatory_title}</div>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>{comp.name || comp.legal_name}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
