import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { login, register } from '../../store/authSlice';
import { setWorkspace, navigateToPage } from '../../store/uiSlice';
import { useHrmsStore } from '../../store/hrmsStore';
import { Sparkles, ShieldCheck, ArrowRight, Lock, Mail, KeyRound, CheckCircle2, X, Building2, User, Globe, AlertCircle, Server } from 'lucide-react';
import { api } from '../../api/client';

export const LoginView: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector((state) => state.auth);

  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');

  // Sign In State
  const [email, setEmail] = useState('admin@humora.internal');
  const [password, setPassword] = useState('Password@123');

  // Admin Registration State
  const [orgName, setOrgName] = useState('');
  const [slug, setSlug] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  // Optional SMTP Gateway Setup during Registration
  const [enableSmtpNow, setEnableSmtpNow] = useState(false);
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('');
  const [smtpEncryption, setSmtpEncryption] = useState('starttls');

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'verify'>('request');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(login({ email, password }));
  };

  const handleOrgNameChange = (val: string) => {
    setOrgName(val);
    const autoSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setSlug(autoSlug);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || !slug.trim() || !adminEmail.trim() || !adminPassword.trim() || !adminFirstName.trim()) {
      setRegisterError('Please fill in all mandatory fields.');
      return;
    }
    if (adminPassword.length < 8) {
      setRegisterError('Admin password must be at least 8 characters.');
      return;
    }

    setIsRegistering(true);
    setRegisterError(null);
    try {
      localStorage.removeItem('humora_company_profile');
      useHrmsStore.getState().resetHrmsStore();
      const actionResult = await (dispatch(register({
        organization_name: orgName.trim(),
        slug: slug.trim(),
        admin_email: adminEmail.trim(),
        admin_password: adminPassword,
        first_name: adminFirstName.trim(),
        last_name: adminLastName.trim(),
      }) as any) as any);

      if (actionResult && typeof actionResult.unwrap === 'function') {
        await actionResult.unwrap();
      }

      // If administrator configured their outbound SMTP credentials during signup
      if (enableSmtpNow && smtpHost.trim() && smtpUsername.trim() && smtpPassword) {
        try {
          await api.put('/hrms/company/smtp', {
            host: smtpHost.trim(),
            port: Number(smtpPort) || 587,
            username: smtpUsername.trim(),
            password: smtpPassword,
            from_email: smtpUsername.trim(),
            from_name: smtpFromName.trim() || orgName.trim(),
            encryption: smtpEncryption || 'starttls',
          });
        } catch (smtpErr) {
          console.warn('Failed to save initial SMTP config during signup, can be setup later:', smtpErr);
        }
      }

      dispatch(setWorkspace('management'));
      dispatch(navigateToPage('company_settings'));
      window.location.hash = '#/company_settings';
    } catch (err: any) {
      setRegisterError(err?.message || (typeof err === 'string' ? err : 'Registration failed'));
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDemoAdmin = () => {
    setEmail('admin@humora.internal');
    setPassword('Password@123');
  };

  const handleDemoEmployee = () => {
    setEmail('marcus@gmail.com');
    setPassword('123');
  };

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotError('Please enter your registered email address.');
      return;
    }
    setIsForgotLoading(true);
    setForgotError(null);
    setForgotMessage(null);
    try {
      await api.post('/auth/forgot-password', { email: forgotEmail.trim() });
      setForgotMessage('Verification OTP sent! Check your inbox (valid for 10 minutes).');
      setForgotStep('verify');
    } catch (err: any) {
      setForgotError(err?.message || 'Failed to dispatch password reset OTP.');
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotOtp.trim() || forgotOtp.trim().length !== 6) {
      setForgotError('Please enter the valid 6-digit OTP code.');
      return;
    }
    if (!newPassword || newPassword.length < 3) {
      setForgotError('New password must be at least 3 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotError('Passwords do not match.');
      return;
    }

    setIsForgotLoading(true);
    setForgotError(null);
    try {
      await api.post('/auth/reset-password', {
        email: forgotEmail.trim(),
        otp_code: forgotOtp.trim(),
        new_password: newPassword,
      });
      setForgotMessage('Password successfully updated! Please log in with your new password.');
      setPassword(newPassword);
      setEmail(forgotEmail.trim());
      setTimeout(() => {
        setShowForgotModal(false);
        setForgotStep('request');
        setForgotOtp('');
        setNewPassword('');
        setConfirmPassword('');
      }, 2000);
    } catch (err: any) {
      setForgotError(err?.message || 'Invalid or expired OTP code.');
    } finally {
      setIsForgotLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.12), transparent), var(--surface-0)',
        padding: '24px',
        position: 'relative',
      }}
    >
      <div
        style={{
          maxWidth: '420px',
          width: '100%',
          padding: '36px 32px',
          background: 'var(--surface-1)',
          border: '1px solid var(--border-hairline)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-popover)',
          position: 'relative',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.25), var(--shadow-sm)',
              marginBottom: '16px',
            }}
          >
            <Sparkles size={22} color="#ffffff" />
          </div>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              marginBottom: '6px',
            }}
          >
            {authMode === 'signin' ? 'Sign in to Humora' : 'Register Organization'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.4 }}>
            {authMode === 'signin'
              ? 'Enterprise HRMS & Agile Work Intelligence'
              : 'Management Admin Tenant Onboarding & Mandatory Setup'}
          </p>
        </div>

        {/* Tab Toggle: Sign In vs Register Organization */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: 'var(--surface-2)',
            padding: '4px',
            borderRadius: '10px',
            marginBottom: '20px',
            border: '1px solid var(--border-hairline)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setAuthMode('signin');
              setRegisterError(null);
            }}
            style={{
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '7px',
              border: 'none',
              cursor: 'pointer',
              background: authMode === 'signin' ? 'var(--surface-1)' : 'transparent',
              color: authMode === 'signin' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: authMode === 'signin' ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('register');
              setRegisterError(null);
            }}
            style={{
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '7px',
              border: 'none',
              cursor: 'pointer',
              background: authMode === 'register' ? 'var(--surface-1)' : 'transparent',
              color: authMode === 'register' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: authMode === 'register' ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            Register Organization
          </button>
        </div>

        {authMode === 'signin' ? (
          <>
            {/* Demo Quick Select Pill */}
            <div
              style={{
                marginBottom: '20px',
                padding: '8px 12px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border-hairline)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--accent-emerald)',
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Quick Fill Demo:
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#818cf8',
                    padding: '2px 8px',
                    cursor: 'pointer',
                    background: 'rgba(99, 102, 241, 0.1)',
                    borderRadius: '4px',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                  }}
                  onClick={handleDemoAdmin}
                >
                  Admin
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#34d399',
                    padding: '2px 8px',
                    cursor: 'pointer',
                    background: 'rgba(16, 185, 129, 0.1)',
                    borderRadius: '4px',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                  }}
                  onClick={handleDemoEmployee}
                >
                  Employee
                </button>
              </div>
            </div>

            {error && (
              <div
                style={{
                  background: 'var(--accent-rose-subtle)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  color: 'var(--accent-rose)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                  marginBottom: '20px',
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail size={12} />
                  <span>Work Email</span>
                </label>
                <input
                  type="email"
                  className="input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@company.com"
                  autoComplete="username"
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Lock size={12} />
                    <span>Password</span>
                  </label>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{
                      fontSize: '11px',
                      color: 'var(--accent-primary)',
                      padding: 0,
                      cursor: 'pointer',
                      background: 'none',
                      border: 'none',
                    }}
                    onClick={() => {
                      setForgotEmail(email);
                      setShowForgotModal(true);
                      setForgotStep('request');
                      setForgotMessage(null);
                      setForgotError(null);
                    }}
                  >
                    Forgot Password?
                  </button>
                </div>
                <input
                  type="password"
                  className="input-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '4px', height: '38px', gap: '8px' }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span>Verifying Argon2id credentials...</span>
                ) : (
                  <>
                    <span>Sign In to Workspace</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>

              <div style={{ textAlign: 'center', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setAuthMode('register')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Need to onboard a new company? <strong>Register as Admin →</strong>
                </button>
              </div>
            </form>
          </>
        ) : (
          /* Admin / Organization Registration Mode */
          <>
            <div
              style={{
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: '8px',
                padding: '12px 14px',
                marginBottom: '18px',
                fontSize: '12px',
                color: '#cbd5e1',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 600, color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <Building2 size={14} />
                <span>Organization Management Setup</span>
              </div>
              Creates your corporate tenant and grants you the <strong>Superadmin</strong> role. Employees will be invited later from your dashboard.
            </div>

            {registerError && (
              <div
                style={{
                  background: 'rgba(244, 63, 94, 0.12)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  color: '#fb7185',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={16} />
                <span>{registerError}</span>
              </div>
            )}

            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Building2 size={12} />
                  <span>Company / Organization Name *</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={orgName}
                  onChange={(e) => handleOrgNameChange(e.target.value)}
                  required
                  placeholder="Acme Innovations Ltd."
                />
              </div>

              <div>
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Globe size={12} />
                  <span>Workspace URL Slug *</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  required
                  placeholder="acme-innovations"
                />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px', display: 'block' }}>
                  Workspace identifier: {slug || 'company-name'}.humora.internal
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="input-label">Admin First Name *</label>
                  <input
                    type="text"
                    className="input-field"
                    value={adminFirstName}
                    onChange={(e) => setAdminFirstName(e.target.value)}
                    required
                    placeholder="Sarah"
                  />
                </div>
                <div>
                  <label className="input-label">Admin Last Name</label>
                  <input
                    type="text"
                    className="input-field"
                    value={adminLastName}
                    onChange={(e) => setAdminLastName(e.target.value)}
                    placeholder="Connor"
                  />
                </div>
              </div>

              <div>
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail size={12} />
                  <span>Official Admin Work Email *</span>
                </label>
                <input
                  type="email"
                  className="input-field"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                  placeholder="admin@yourcompany.com"
                />
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px', display: 'block' }}>
                  Strict platform conflict check enforced. Must not already exist.
                </span>
              </div>

              <div>
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Lock size={12} />
                  <span>Admin Master Password *</span>
                </label>
                <input
                  type="password"
                  className="input-field"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Minimum 8 characters"
                />
              </div>

              {/* Optional SMTP Gateway Setup Accordion */}
              <div
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  background: enableSmtpNow ? 'rgba(99, 102, 241, 0.05)' : 'var(--surface-2)',
                  padding: '12px 14px',
                  marginTop: '4px',
                  transition: 'all 0.2s ease',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                  onClick={() => setEnableSmtpNow(!enableSmtpNow)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Server size={14} style={{ color: 'var(--accent-primary)' }} />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Corporate Outbound Email (SMTP)
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 500 }}>
                    {enableSmtpNow ? 'Collapse ▲' : '+ Setup Email Now (Optional) ▼'}
                  </span>
                </div>

                <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Connect your SMTP gateway to send automated employee onboarding invites, monthly payslips, and OTPs. You can also configure this later in Company Settings.
                </p>

                {enableSmtpNow && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-hairline)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                      <div>
                        <label className="input-label" style={{ fontSize: '11px' }}>SMTP Host</label>
                        <input
                          type="text"
                          className="input-field"
                          style={{ fontSize: '12px' }}
                          value={smtpHost}
                          onChange={(e) => setSmtpHost(e.target.value)}
                          placeholder="smtp.gmail.com"
                        />
                      </div>
                      <div>
                        <label className="input-label" style={{ fontSize: '11px' }}>Port</label>
                        <input
                          type="number"
                          className="input-field"
                          style={{ fontSize: '12px' }}
                          value={smtpPort}
                          onChange={(e) => setSmtpPort(Number(e.target.value))}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="input-label" style={{ fontSize: '11px' }}>SMTP Username / Work Email</label>
                      <input
                        type="text"
                        className="input-field"
                        style={{ fontSize: '12px' }}
                        value={smtpUsername}
                        onChange={(e) => setSmtpUsername(e.target.value)}
                        placeholder="hr@yourcompany.com"
                      />
                    </div>

                    <div>
                      <label className="input-label" style={{ fontSize: '11px' }}>SMTP Password / App Password</label>
                      <input
                        type="password"
                        className="input-field"
                        style={{ fontSize: '12px' }}
                        value={smtpPassword}
                        onChange={(e) => setSmtpPassword(e.target.value)}
                        placeholder="App password or secret key"
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label className="input-label" style={{ fontSize: '11px' }}>Sender Display Name</label>
                        <input
                          type="text"
                          className="input-field"
                          style={{ fontSize: '12px' }}
                          value={smtpFromName}
                          onChange={(e) => setSmtpFromName(e.target.value)}
                          placeholder="e.g. Acme HR"
                        />
                      </div>
                      <div>
                        <label className="input-label" style={{ fontSize: '11px' }}>Encryption</label>
                        <select
                          className="input-field"
                          style={{ fontSize: '12px' }}
                          value={smtpEncryption}
                          onChange={(e) => setSmtpEncryption(e.target.value)}
                        >
                          <option value="starttls">STARTTLS (587)</option>
                          <option value="tls">SSL/TLS (465)</option>
                          <option value="none">None (25)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '6px', height: '40px', gap: '8px' }}
                disabled={isRegistering}
              >
                {isRegistering ? (
                  <span>Registering Organization...</span>
                ) : (
                  <>
                    <span>Create Organization & Proceed →</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>

              <div style={{ textAlign: 'center', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setAuthMode('signin')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Already have an organization? <strong>Sign in here →</strong>
                </button>
              </div>
            </form>
          </>
        )}

        <div
          style={{
            marginTop: '28px',
            paddingTop: '20px',
            borderTop: '1px solid var(--border-hairline)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: 'var(--text-muted)',
            }}
          >
            <ShieldCheck size={14} color="var(--accent-emerald)" />
            <span>Multi-Tenant Zero-Trust Architecture</span>
          </div>
        </div>
      </div>

      {/* Forgot Password OTP Modal */}
      {showForgotModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            style={{
              background: 'var(--surface-1, #131722)',
              border: '1px solid var(--border-hairline, #1e293b)',
              borderRadius: '16px',
              padding: '28px',
              maxWidth: '420px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
              position: 'relative',
            }}
          >
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#818cf8',
                }}
              >
                <KeyRound size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#ffffff' }}>
                  {forgotStep === 'request' ? 'Password Recovery' : 'Verify Security Code'}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {forgotStep === 'request'
                    ? 'Enter your work email to receive a 6-digit OTP'
                    : `Enter the code dispatched to ${forgotEmail}`}
                </p>
              </div>
            </div>

            {forgotError && (
              <div
                style={{
                  background: 'rgba(244, 63, 94, 0.12)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  color: '#fb7185',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              >
                {forgotError}
              </div>
            )}

            {forgotMessage && (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#34d399',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle2 size={16} />
                <span>{forgotMessage}</span>
              </div>
            )}

            {forgotStep === 'request' ? (
              <form onSubmit={handleRequestOTP} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Mail size={12} />
                    <span>Registered Work / Account Email</span>
                  </label>
                  <input
                    type="email"
                    className="input-field"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    placeholder="marcus@gmail.com"
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', height: '38px', gap: '6px' }}
                  disabled={isForgotLoading}
                >
                  {isForgotLoading ? 'Sending OTP code...' : 'Dispatch Verification Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label className="input-label">6-Digit Verification OTP</label>
                  <input
                    type="text"
                    className="input-field"
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    maxLength={6}
                    placeholder="123456"
                    style={{
                      textAlign: 'center',
                      fontSize: '20px',
                      letterSpacing: '0.3em',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                    }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Code expires in 10 minutes</span>
                    <button
                      type="button"
                      onClick={handleRequestOTP}
                      disabled={isForgotLoading}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--accent-primary)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Resend OTP
                    </button>
                  </div>
                </div>

                <div>
                  <label className="input-label">New Password</label>
                  <input
                    type="password"
                    className="input-field"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label className="input-label">Confirm New Password</label>
                  <input
                    type="password"
                    className="input-field"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setForgotStep('request')}
                    style={{
                      flex: 1,
                      height: '38px',
                      background: 'transparent',
                      border: '1px solid var(--border-hairline)',
                      color: 'var(--text-secondary)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ flex: 2, height: '38px' }}
                    disabled={isForgotLoading}
                  >
                    {isForgotLoading ? 'Resetting...' : 'Set New Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

