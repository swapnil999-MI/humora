import React, { useState, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { updateCompanyProfile, fetchCompanyProfile } from '../../store/hrmsSlice';
import { addToast } from '../../store/uiSlice';
import {
  Building2,
  FileCheck,
  MapPin,
  Sparkles,
  Save,
  CheckCircle2,
  PenTool,
  Eye,
  UploadCloud,
  Trash2,
  Mail,
  Send,
  Lock,
  ShieldCheck,
  AlertCircle,
  Server,
  KeyRound,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { CompanyProfile, TenantSMTPConfig } from '../../types';
import { api } from '../../api/client';

export const CompanySettingsDesk: React.FC = () => {
  const dispatch = useAppDispatch();
  const companyProfile = useAppSelector((state) => state.hrms.companyProfile);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFileDetails, setUploadedFileDetails] = useState<{ name: string; size: string } | null>(null);

  const [smtpForm, setSmtpForm] = useState<TenantSMTPConfig>({
    host: 'smtp.gmail.com',
    port: 587,
    username: '',
    password: '',
    from_email: '',
    from_name: '',
    encryption: 'starttls',
  });
  const [hasExistingSmtpPassword, setHasExistingSmtpPassword] = useState(false);
  const [isSmtpVerified, setIsSmtpVerified] = useState(false);
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [showTestModal, setShowTestModal] = useState(false);
  const [smtpSavedSuccess, setSmtpSavedSuccess] = useState(false);
  const [testSmtpError, setTestSmtpError] = useState<string | null>(null);

  const [form, setForm] = useState<CompanyProfile>({
    id: 'cmp_default',
    name: '',
    legal_name: '',
    brand_tagline: '',
    logo_url: '',
    cin: '',
    gstin: '',
    pan: '',
    tan: '',
    pf_code: '',
    esi_code: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    contact_email: '',
    contact_phone: '',
    website: '',
    signatory_name: '',
    signatory_title: '',
    pay_cycle_start_day: 1,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    // Always fetch fresh company profile for the current tenant from the backend server
    dispatch(fetchCompanyProfile() as any);

    // Load active SMTP configuration
    api.get<TenantSMTPConfig>('/hrms/company/smtp')
      .then((cfg) => {
        if (cfg) {
          setSmtpForm((prev) => ({
            ...prev,
            host: cfg.host || 'smtp.gmail.com',
            port: cfg.port || 587,
            username: cfg.username || '',
            from_email: cfg.from_email || '',
            from_name: cfg.from_name || '',
            encryption: cfg.encryption || 'starttls',
          }));
          setHasExistingSmtpPassword(!!cfg.has_password);
          setIsSmtpVerified(!!cfg.is_verified);
        }
      })
      .catch(() => {});
  }, [dispatch]);

  // Synchronize form whenever companyProfile updates from server
  useEffect(() => {
    if (companyProfile) {
      setForm({
        id: companyProfile.id || 'cmp_default',
        name: companyProfile.name || '',
        legal_name: companyProfile.legal_name || companyProfile.name || '',
        brand_tagline: companyProfile.brand_tagline || '',
        logo_url: companyProfile.logo_url || '',
        cin: companyProfile.cin || '',
        gstin: companyProfile.gstin || '',
        pan: companyProfile.pan || '',
        tan: companyProfile.tan || '',
        pf_code: companyProfile.pf_code || '',
        esi_code: companyProfile.esi_code || '',
        address_line1: companyProfile.address_line1 || '',
        address_line2: companyProfile.address_line2 || '',
        city: companyProfile.city || '',
        state: companyProfile.state || '',
        pincode: companyProfile.pincode || '',
        country: companyProfile.country || 'India',
        contact_email: companyProfile.contact_email || '',
        contact_phone: companyProfile.contact_phone || '',
        website: companyProfile.website || '',
        signatory_name: companyProfile.signatory_name || '',
        signatory_title: companyProfile.signatory_title || '',
        pay_cycle_start_day: companyProfile.pay_cycle_start_day || 1,
      });
    }
  }, [companyProfile]);

  const handleChange = (field: keyof CompanyProfile, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSavedSuccess(false);
  };

  const optimizeLogoFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.type === 'image/svg+xml') {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 512;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.92));
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      dispatch(addToast({ type: 'error', message: 'Please select an image file (PNG, JPG, SVG, WebP)' }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      dispatch(addToast({ type: 'error', message: 'Logo file size exceeds 5MB limit' }));
      return;
    }

    try {
      const dataUrl = await optimizeLogoFile(file);
      const sizeInKb = (file.size / 1024).toFixed(1) + ' KB';
      const updatedForm = { ...form, logo_url: dataUrl };
      setForm(updatedForm);
      setUploadedFileDetails({ name: file.name, size: sizeInKb });
      
      // Auto-save immediately to localStorage & Redux store so refresh preserves it
      await dispatch(updateCompanyProfile(updatedForm) as any);
      
      dispatch(
        addToast({
          type: 'success',
          message: `Uploaded "${file.name}". Logo saved and active across all payslips!`,
        })
      );
    } catch (err: any) {
      dispatch(addToast({ type: 'error', message: 'Failed to process logo file' }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await dispatch(updateCompanyProfile(form) as any);
      setSavedSuccess(true);
      dispatch(
        addToast({
          type: 'success',
          message: 'Company profile and payslip branding successfully updated!',
        })
      );
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err: any) {
      dispatch(
        addToast({
          type: 'error',
          message: err?.message || 'Failed to save company profile',
        })
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSmtp(true);
    try {
      const res = await api.put<TenantSMTPConfig>('/hrms/company/smtp', smtpForm);
      if (res?.has_password) {
        setHasExistingSmtpPassword(true);
      }
      setIsSmtpVerified(!!res?.is_verified);
      setSmtpSavedSuccess(true);
      dispatch(
        addToast({
          type: 'success',
          message: 'Corporate SMTP Gateway configuration saved securely (AES encrypted)!',
        })
      );
      setTimeout(() => setSmtpSavedSuccess(false), 4000);
    } catch (err: any) {
      dispatch(
        addToast({
          type: 'error',
          message: err?.message || 'Failed to save SMTP configuration',
        })
      );
    } finally {
      setIsSavingSmtp(false);
    }
  };

  const handleTestSmtp = async () => {
    setIsTestingSmtp(true);
    setTestSmtpError(null);
    try {
      await api.post('/hrms/company/smtp/test', {
        recipient_email: testEmailRecipient.trim() || undefined,
        host: smtpForm.host?.trim(),
        port: smtpForm.port,
        username: smtpForm.username?.trim(),
        password: smtpForm.password || undefined,
        from_email: smtpForm.from_email?.trim() || undefined,
        from_name: smtpForm.from_name?.trim() || undefined,
        encryption: smtpForm.encryption,
      });
      setIsSmtpVerified(true);
      setTestSmtpError(null);
      dispatch(
        addToast({
          type: 'success',
          message: 'Test email successfully dispatched! Check the recipient inbox.',
        })
      );
      setShowTestModal(false);
    } catch (err: any) {
      const errMsg = err?.message || 'SMTP Connection test failed';
      setTestSmtpError(errMsg);
      dispatch(
        addToast({
          type: 'error',
          message: errMsg,
        })
      );
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    background: 'var(--surface-0)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '8px',
    color: '#ffffff',
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

  const cardStyle: React.CSSProperties = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-hairline)',
    borderRadius: '14px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  };

  const cardHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    paddingBottom: '14px',
    borderBottom: '1px solid var(--border-hairline)',
  };

  return (
    <div className="company-settings-desk" style={{ color: 'var(--text-primary)' }}>
      {/* Header Banner */}
      <div className="company-settings-banner">
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              color: '#a5b4fc',
              fontSize: '11px',
              fontWeight: 600,
              marginBottom: '10px',
            }}
          >
            <Building2 size={13} />
            <span>Management Console • Legal Entity & Branding</span>
          </div>
          <h1
            style={{
              fontSize: '26px',
              fontWeight: 700,
              margin: '0 0 6px',
              letterSpacing: '-0.02em',
              color: '#ffffff',
            }}
          >
            Company Onboarding & Payslip Identity
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
            Configure your registered entity, statutory tax IDs, official logo, and authorized signatories. All employee payslips dynamically inherit this official branding.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="btn btn-primary"
          style={{
            padding: '10px 22px',
            fontSize: '13px',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
            cursor: 'pointer',
          }}
        >
          {savedSuccess ? <CheckCircle2 size={16} /> : <Save size={16} />}
          <span>{savedSuccess ? 'Changes Saved!' : 'Save & Publish Profile'}</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="company-settings-layout">
        {/* Left Column: Form Cards */}
        <div className="company-settings-cards-col">
          
          {/* Card 1: Branding & Logo */}
          <div className="company-settings-card">
            <div style={cardHeaderStyle}>
              <Sparkles size={18} color="#818cf8" />
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#ffffff' }}>
                Company Identity & Branding
              </h2>
            </div>

            <div className="company-settings-grid-2">
              <div>
                <label style={labelStyle}>Brand Display Name *</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={form.name || ''}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g. Humora Technologies"
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Legal Registered Entity Name *</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={form.legal_name || ''}
                  onChange={(e) => handleChange('legal_name', e.target.value)}
                  placeholder="e.g. Humora Technologies Private Limited"
                  required
                />
              </div>

              <div className="company-settings-col-span-2">
                <label style={labelStyle}>Corporate Tagline / Mission</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={form.brand_tagline || ''}
                  onChange={(e) => handleChange('brand_tagline', e.target.value)}
                  placeholder="e.g. Enterprise Workforce Engineering & Human Capital Operating System"
                />
              </div>

              {/* Official Logo & File Upload */}
              <div className="company-settings-col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={labelStyle}>Company Official Logo (Direct File Upload) *</label>

                {/* Upload & Drag-Drop Card */}
                <div
                  className="company-settings-logo-row"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  style={{
                    background: isDragging ? 'rgba(99, 102, 241, 0.12)' : 'var(--surface-0)',
                    border: isDragging ? '2px dashed #818cf8' : '1px dashed var(--border-subtle)',
                    borderRadius: '12px',
                    padding: '18px 20px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <div
                      style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--surface-1)',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      {form.logo_url ? (
                        <img
                          src={form.logo_url}
                          alt="Company Logo"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <Building2 size={28} color="var(--text-muted)" />
                      )}
                    </div>

                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                        {uploadedFileDetails ? uploadedFileDetails.name : 'Upload Official Company Logo'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                        {uploadedFileDetails
                          ? `Uploaded file (${uploadedFileDetails.size}) ready to sync with payslips`
                          : 'Supports PNG, JPG, WebP, SVG (Max 5MB). Prints on all payslips.'}
                      </div>
                    </div>
                  </div>

                  {/* Hidden File Input & Upload Trigger Buttons */}
                  <div className="company-settings-logo-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn btn-primary"
                      style={{
                        padding: '8px 16px',
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        borderRadius: '6px',
                      }}
                    >
                      <UploadCloud size={15} />
                      <span>Upload Logo File</span>
                    </button>

                    {form.logo_url && (
                      <button
                        type="button"
                        onClick={async () => {
                          const updatedForm = { ...form, logo_url: '' };
                          setForm(updatedForm);
                          setUploadedFileDetails(null);
                          await dispatch(updateCompanyProfile(updatedForm) as any);
                          dispatch(addToast({ type: 'info', message: 'Company logo removed and saved.' }));
                        }}
                        className="btn btn-ghost"
                        style={{
                          padding: '8px 12px',
                          fontSize: '12px',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '6px',
                          color: '#f87171',
                        }}
                        title="Remove Logo"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Statutory Identifiers */}
          <div className="company-settings-card">
            <div style={cardHeaderStyle}>
              <FileCheck size={18} color="#34d399" />
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#ffffff' }}>
                Statutory Identifiers & Tax Numbers (India Compliance)
              </h2>
            </div>

            <div className="company-settings-grid-2">
              <div>
                <label style={labelStyle}>Corporate Identity Number (CIN) *</label>
                <input
                  type="text"
                  style={{ ...inputStyle, textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}
                  value={form.cin || ''}
                  onChange={(e) => handleChange('cin', e.target.value)}
                  placeholder="e.g. U72200KA2024PTC189201"
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Goods and Services Tax ID (GSTIN) *</label>
                <input
                  type="text"
                  style={{ ...inputStyle, textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}
                  value={form.gstin || ''}
                  onChange={(e) => handleChange('gstin', e.target.value)}
                  placeholder="e.g. 29AAACH7409R1ZZ"
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Company PAN *</label>
                <input
                  type="text"
                  style={{ ...inputStyle, textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}
                  value={form.pan || ''}
                  onChange={(e) => handleChange('pan', e.target.value)}
                  placeholder="e.g. AAACH7409R"
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Tax Deduction Account Number (TAN) *</label>
                <input
                  type="text"
                  style={{ ...inputStyle, textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}
                  value={form.tan || ''}
                  onChange={(e) => handleChange('tan', e.target.value)}
                  placeholder="e.g. BLRH08920E"
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Provident Fund (PF) Registration Code</label>
                <input
                  type="text"
                  style={{ ...inputStyle, textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}
                  value={form.pf_code || ''}
                  onChange={(e) => handleChange('pf_code', e.target.value)}
                  placeholder="e.g. BGBAN0019283000"
                />
              </div>

              <div>
                <label style={labelStyle}>ESI Registration Code</label>
                <input
                  type="text"
                  style={{ ...inputStyle, textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}
                  value={form.esi_code || ''}
                  onChange={(e) => handleChange('esi_code', e.target.value)}
                  placeholder="e.g. 31000849200000999"
                />
              </div>
            </div>
          </div>

          {/* Card 3: Registered Office Address */}
          <div className="company-settings-card">
            <div style={cardHeaderStyle}>
              <MapPin size={18} color="#22d3ee" />
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#ffffff' }}>
                Registered Office Address & Contact Desk
              </h2>
            </div>

            <div className="company-settings-grid-2">
              <div className="company-settings-col-span-2">
                <label style={labelStyle}>Address Line 1 *</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={form.address_line1 || ''}
                  onChange={(e) => handleChange('address_line1', e.target.value)}
                  placeholder="e.g. Tower 4, Level 9, Cyber Park, Electronic City Phase 1"
                  required
                />
              </div>

              <div className="company-settings-col-span-2">
                <label style={labelStyle}>Address Line 2 (Optional)</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={form.address_line2 || ''}
                  onChange={(e) => handleChange('address_line2', e.target.value)}
                  placeholder="e.g. Hosur Main Road"
                />
              </div>

              <div>
                <label style={labelStyle}>City *</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={form.city || ''}
                  onChange={(e) => handleChange('city', e.target.value)}
                  placeholder="e.g. Bengaluru"
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>State *</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={form.state || ''}
                  onChange={(e) => handleChange('state', e.target.value)}
                  placeholder="e.g. Karnataka"
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Postal Code *</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={form.pincode || ''}
                  onChange={(e) => handleChange('pincode', e.target.value)}
                  placeholder="e.g. 560100"
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Country *</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={form.country || ''}
                  onChange={(e) => handleChange('country', e.target.value)}
                  placeholder="e.g. India"
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Official Payroll Email *</label>
                <input
                  type="email"
                  style={inputStyle}
                  value={form.contact_email || ''}
                  onChange={(e) => handleChange('contact_email', e.target.value)}
                  placeholder="payroll@humora.io"
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Contact Phone</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={form.contact_phone || ''}
                  onChange={(e) => handleChange('contact_phone', e.target.value)}
                  placeholder="+91 80 4912 8800"
                />
              </div>

              <div className="company-settings-col-span-2">
                <label style={labelStyle}>Company Website</label>
                <input
                  type="url"
                  style={inputStyle}
                  value={form.website || ''}
                  onChange={(e) => handleChange('website', e.target.value)}
                  placeholder="https://humora.io"
                />
              </div>
            </div>
          </div>

          {/* Card 4: Authorized Signatory */}
          <div className="company-settings-card">
            <div style={cardHeaderStyle}>
              <PenTool size={18} color="#fbbf24" />
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#ffffff' }}>
                Authorized Signatory & Payroll Officer
              </h2>
            </div>

            <div className="company-settings-grid-2">
              <div>
                <label style={labelStyle}>Signatory Full Name *</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={form.signatory_name || ''}
                  onChange={(e) => handleChange('signatory_name', e.target.value)}
                  placeholder="e.g. Marcus Vance"
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Official Designation *</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={form.signatory_title || ''}
                  onChange={(e) => handleChange('signatory_title', e.target.value)}
                  placeholder="e.g. Director of People Operations"
                  required
                />
              </div>
            </div>
          </div>

          {/* Card 5: Corporate SMTP Gateway & Email Automation */}
          <div className="company-settings-card">
            <div style={{ ...cardHeaderStyle, justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Server size={18} color="#10b981" />
                <div>
                  <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#ffffff' }}>
                    Corporate SMTP Gateway & Outgoing Mail Service
                  </h2>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
                    Enterprise mail server for automated onboarding invites, monthly payslips, and password resets
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '3px 10px',
                    borderRadius: '12px',
                    background: hasExistingSmtpPassword ? 'rgba(16, 185, 129, 0.12)' : 'rgba(234, 179, 8, 0.12)',
                    color: hasExistingSmtpPassword ? '#34d399' : '#facc15',
                    border: `1px solid ${hasExistingSmtpPassword ? 'rgba(16, 185, 129, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <ShieldCheck size={12} />
                  {hasExistingSmtpPassword ? (isSmtpVerified ? 'Gateway Active & Verified' : 'Gateway Configured') : 'Not Configured'}
                </span>
              </div>
            </div>

            {/* Email Automation Feature Summary Banner */}
            <div
              style={{
                background: 'rgba(99, 102, 241, 0.06)',
                border: '1px solid rgba(99, 102, 241, 0.18)',
                borderRadius: '10px',
                padding: '14px 16px',
                fontSize: '12px',
                lineHeight: 1.6,
                color: '#cbd5e1',
              }}
            >
              <div style={{ fontWeight: 600, color: '#a5b4fc', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={14} />
                <span>Automated Email Delivery Pipelines Enabled by this Gateway:</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', color: '#94a3b8' }}>
                <li><strong style={{ color: '#e2e8f0' }}>Employee Onboarding Invitations:</strong> Welcome email with secure 1-click token to complete dossier.</li>
                <li><strong style={{ color: '#e2e8f0' }}>Monthly Salary Slips:</strong> Instant notification with net pay summary when payroll runs are finalized.</li>
                <li><strong style={{ color: '#e2e8f0' }}>Employee Self-Service Security:</strong> 6-digit OTP delivery for instant password resets.</li>
              </ul>
            </div>

            {/* Quick Provider Presets */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Quick Presets:</span>
              <button
                type="button"
                onClick={() => setSmtpForm((p) => ({ ...p, host: 'smtp.gmail.com', port: 587, encryption: 'starttls' }))}
                style={{
                  background: smtpForm.host === 'smtp.gmail.com' ? 'rgba(99, 102, 241, 0.2)' : 'var(--surface-0)',
                  border: `1px solid ${smtpForm.host === 'smtp.gmail.com' ? 'rgba(99, 102, 241, 0.4)' : 'var(--border-subtle)'}`,
                  color: smtpForm.host === 'smtp.gmail.com' ? '#a5b4fc' : 'var(--text-secondary)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Gmail / Google Workspace
              </button>
              <button
                type="button"
                onClick={() => setSmtpForm((p) => ({ ...p, host: 'smtp.office365.com', port: 587, encryption: 'starttls' }))}
                style={{
                  background: smtpForm.host === 'smtp.office365.com' ? 'rgba(99, 102, 241, 0.2)' : 'var(--surface-0)',
                  border: `1px solid ${smtpForm.host === 'smtp.office365.com' ? 'rgba(99, 102, 241, 0.4)' : 'var(--border-subtle)'}`,
                  color: smtpForm.host === 'smtp.office365.com' ? '#a5b4fc' : 'var(--text-secondary)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Microsoft 365 / Outlook
              </button>
              <button
                type="button"
                onClick={() => setSmtpForm((p) => ({ ...p, host: 'email-smtp.us-east-1.amazonaws.com', port: 587, encryption: 'starttls' }))}
                style={{
                  background: smtpForm.host?.includes('amazonaws.com') ? 'rgba(99, 102, 241, 0.2)' : 'var(--surface-0)',
                  border: `1px solid ${smtpForm.host?.includes('amazonaws.com') ? 'rgba(99, 102, 241, 0.4)' : 'var(--border-subtle)'}`,
                  color: smtpForm.host?.includes('amazonaws.com') ? '#a5b4fc' : 'var(--text-secondary)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Amazon SES
              </button>
            </div>

            <div className="company-settings-grid-3">
              <div>
                <label style={labelStyle}>SMTP Server Host *</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={smtpForm.host || ''}
                  onChange={(e) => setSmtpForm((p) => ({ ...p, host: e.target.value }))}
                  placeholder="smtp.gmail.com or mail.yourcompany.com"
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Port *</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={smtpForm.port || 587}
                  onChange={(e) => setSmtpForm((p) => ({ ...p, port: parseInt(e.target.value) || 587 }))}
                  placeholder="587"
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Encryption *</label>
                <select
                  style={{ ...inputStyle, background: 'var(--surface-0)', cursor: 'pointer' }}
                  value={smtpForm.encryption || 'starttls'}
                  onChange={(e) => setSmtpForm((p) => ({ ...p, encryption: e.target.value as any }))}
                >
                  <option value="starttls">STARTTLS (Port 587)</option>
                  <option value="ssl">SSL / TLS (Port 465)</option>
                  <option value="none">None (Plain)</option>
                </select>
              </div>
            </div>

            <div className="company-settings-grid-2">
              <div>
                <label style={labelStyle}>SMTP Username / Account Email *</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={smtpForm.username || ''}
                  onChange={(e) => setSmtpForm((p) => ({ ...p, username: e.target.value }))}
                  placeholder="notifications@yourcompany.com"
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>
                  Password / App Password {hasExistingSmtpPassword ? '(Leave blank to retain)' : '*'}
                </label>
                <input
                  type="password"
                  style={inputStyle}
                  value={smtpForm.password || ''}
                  onChange={(e) => setSmtpForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder={hasExistingSmtpPassword ? '•••••••• (Encrypted in DB)' : 'App-specific password'}
                />
              </div>

              <div>
                <label style={labelStyle}>From Email (Sender Address) *</label>
                <input
                  type="email"
                  style={inputStyle}
                  value={smtpForm.from_email || ''}
                  onChange={(e) => setSmtpForm((p) => ({ ...p, from_email: e.target.value }))}
                  placeholder="hr@yourcompany.com"
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>From Name (Display Name) *</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={smtpForm.from_name || ''}
                  onChange={(e) => setSmtpForm((p) => ({ ...p, from_name: e.target.value }))}
                  placeholder="Acme HR & People Operations"
                  required
                />
              </div>
            </div>

            {/* Google / Gmail App Password Guidance Banner */}
            <div
              style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: '10px',
                padding: '12px 16px',
                fontSize: '12px',
                lineHeight: 1.5,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#93c5fd', fontWeight: 600 }}>
                  <KeyRound size={15} />
                  <span>Using Gmail or Google Workspace? (Requires 16-character App Password)</span>
                </div>
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#60a5fa',
                    fontSize: '11px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    background: 'rgba(59, 130, 246, 0.15)',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                  }}
                >
                  <span>Open Google App Passwords</span>
                  <ExternalLink size={12} />
                </a>
              </div>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '11.5px' }}>
                Google blocks personal account passwords for SMTP with error <code style={{ color: '#fca5a5' }}>535 BadCredentials</code>. Turn ON <strong style={{ color: '#e2e8f0' }}>2-Step Verification</strong> on your Google Account, generate a 16-character <strong style={{ color: '#e2e8f0' }}>App Password</strong> at <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: '#60a5fa', textDecoration: 'underline' }}>myaccount.google.com/apppasswords</a>, and paste it here. Spaces like <code>abcd efgh ijkl mnop</code> are automatically stripped.
              </p>
            </div>

            {/* Action Buttons for SMTP */}
            <div className="company-settings-smtp-test-row" style={{ marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setTestSmtpError(null);
                  setShowTestModal(true);
                }}
                disabled={isTestingSmtp}
                className="btn btn-secondary"
                style={{
                  padding: '8px 18px',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  background: 'transparent',
                  color: '#e2e8f0',
                }}
              >
                <Send size={14} color="#60a5fa" />
                <span>Test SMTP Connection</span>
              </button>

              <button
                type="button"
                onClick={handleSaveSmtp}
                disabled={isSavingSmtp}
                className="btn btn-primary"
                style={{
                  padding: '8px 18px',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  background: 'var(--brand-primary, #6366f1)',
                  color: '#ffffff',
                  borderRadius: '8px',
                  border: 'none',
                }}
              >
                {smtpSavedSuccess ? <CheckCircle2 size={14} /> : <Save size={14} />}
                <span>{smtpSavedSuccess ? 'SMTP Saved!' : 'Save SMTP Settings'}</span>
              </button>
            </div>
          </div>

        </div>

        {/* Test Email Modal */}
        {showTestModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
            }}
          >
            <div
              style={{
                background: 'var(--surface-1, #131722)',
                border: '1px solid var(--border-hairline, #1e293b)',
                borderRadius: '14px',
                padding: '24px',
                maxWidth: '480px',
                width: '90%',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#818cf8',
                  }}
                >
                  <Send size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>
                    Send Live Test Email
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Verify handshake with your SMTP mail server
                  </p>
                </div>
              </div>

              {testSmtpError && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    fontSize: '12px',
                    color: '#fca5a5',
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#f87171', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={15} />
                    <span>SMTP Test Failed</span>
                  </div>
                  <div style={{ wordBreak: 'break-word', marginBottom: '8px', fontSize: '11.5px', color: '#e2e8f0' }}>
                    {testSmtpError}
                  </div>
                  {(testSmtpError.includes('535') || testSmtpError.includes('BadCredentials') || testSmtpError.includes('Google')) && (
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                      <p style={{ margin: '0 0 6px', fontWeight: 600, color: '#fef08a' }}>
                        💡 How to resolve Google 535 BadCredentials:
                      </p>
                      <ol style={{ margin: 0, paddingLeft: '16px', color: '#f1f5f9', fontSize: '11px', lineHeight: 1.6 }}>
                        <li>Do NOT use your personal Google account password.</li>
                        <li>Turn ON <strong>2-Step Verification</strong> on your Google Account.</li>
                        <li>
                          Visit{' '}
                          <a
                            href="https://myaccount.google.com/apppasswords"
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: '#93c5fd', textDecoration: 'underline', fontWeight: 600 }}
                          >
                            myaccount.google.com/apppasswords
                          </a>
                        </li>
                        <li>Generate a 16-character App Password (name it "Humora").</li>
                        <li>Close this modal, paste the 16 characters into the Password field, and click <strong>Save SMTP Settings</strong>.</li>
                      </ol>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label style={labelStyle}>Recipient Email Address</label>
                <input
                  type="email"
                  style={inputStyle}
                  value={testEmailRecipient}
                  onChange={(e) => setTestEmailRecipient(e.target.value)}
                  placeholder="admin@yourcompany.com"
                  autoFocus
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Leave blank to send to your logged-in administrator account.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowTestModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    background: 'transparent',
                    color: '#94a3b8',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleTestSmtp}
                  disabled={isTestingSmtp}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#6366f1',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {isTestingSmtp ? 'Transmitting...' : 'Send Test Email'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Right Column: Live Payslip Header Preview */}
        <div className="company-settings-preview-col">
          
          <div
            style={{
              background: 'var(--surface-1)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '14px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-hairline)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={16} color="#818cf8" />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                  Live Payslip Preview
                </span>
              </div>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#34d399',
                  background: 'rgba(16, 185, 129, 0.12)',
                  padding: '2px 8px',
                  borderRadius: '10px',
                }}
              >
                Synchronized
              </span>
            </div>

            {/* Rendered miniature paper canvas */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '10px',
                padding: '16px',
                color: '#0f172a',
                fontSize: '11px',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '6px',
                      background: 'var(--accent-primary)',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {form.logo_url ? (
                      <img src={form.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span>{(form.name || 'H').charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a' }}>
                      {form.legal_name || form.name || 'Company Name'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>
                      {form.city || 'City'}, {form.state || 'State'} - {form.pincode || 'PIN'}
                    </div>
                  </div>
                </div>

                <span style={{ background: '#0f172a', color: '#ffffff', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', padding: '2px 6px', borderRadius: '3px' }}>
                  Official
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '6px 12px',
                  background: '#f8fafc',
                  padding: '10px',
                  borderRadius: '6px',
                  fontSize: '10px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '9px' }}>CIN</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{form.cin || 'U72200KA2024PTC189201'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '9px' }}>GSTIN</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{form.gstin || '29AAACH7409R1ZZ'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '9px' }}>PAN / TAN</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{form.pan || 'AAACH7409R'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '9px' }}>Signatory</span>
                  <span style={{ color: '#4338ca', fontWeight: 600 }}>{form.signatory_name || 'HR Signatory'}</span>
                </div>
              </div>

              <div style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>
                This exact authenticated header prints on every employee payslip.
              </div>
            </div>

            <div
              style={{
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '11px',
                color: '#a5b4fc',
                lineHeight: 1.4,
              }}
            >
              <strong>Compliance Notice:</strong> Under Indian IT Section 192, official payslips must feature the corporate registered entity name, address, and authorized signatory.
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="btn btn-primary"
              style={{ width: '100%', padding: '10px', fontSize: '12px', fontWeight: 600 }}
            >
              {isSaving ? 'Publishing...' : 'Save & Update All Payslips'}
            </button>
          </div>

        </div>
      </form>
    </div>
  );
};
