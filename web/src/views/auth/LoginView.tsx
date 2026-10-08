import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { login, register } from '../../store/authSlice';
import { setWorkspace, navigateToPage } from '../../store/uiSlice';
import { useHrmsStore } from '../../store/hrmsStore';
import {
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Lock,
  Mail,
  KeyRound,
  CheckCircle2,
  X,
  Building2,
  User,
  Globe,
  AlertCircle,
  Server,
  RefreshCw,
  QrCode,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../api/client';
import { PeopleOSLogo } from '../../components/PeopleOSLogo';

export const LoginView: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector((state) => state.auth);

  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');

  // Sign In State
  const [email, setEmail] = useState(import.meta.env.DEV ? 'admin@humora.internal' : '');
  const [password, setPassword] = useState(import.meta.env.DEV ? 'Password@123' : '');

  // Sign In Method: 'password' | 'qr'
  const [signInMethod, setSignInMethod] = useState<'password' | 'qr'>('password');

  // OAuth Providers State
  const [authProviders, setAuthProviders] = useState<{ google: boolean; github: boolean; microsoft: boolean; qr_code: boolean }>({
    google: false,
    github: false,
    microsoft: false,
    qr_code: true,
  });

  // WhatsApp-style QR Login State
  const [qrPayload, setQrPayload] = useState<string>('');
  const [qrExpiresIn, setQrExpiresIn] = useState<number>(120);
  const [qrStatus, setQrStatus] = useState<'loading' | 'pending' | 'authenticated' | 'expired'>('loading');

  // Fetch enabled OAuth providers on mount
  useEffect(() => {
    api.get<{ google: boolean; github: boolean; microsoft: boolean; qr_code: boolean }>('/auth/providers')
      .then((data) => setAuthProviders(data))
      .catch(() => {});
  }, []);

  // WhatsApp-style QR code lifecycle
  useEffect(() => {
    if (signInMethod !== 'qr') return;

    let timer: any;
    let pollInterval: any;

    const startQrSession = async () => {
      setQrStatus('loading');
      try {
        const res = await api.post<{ session_id: string; qr_payload: string; expires_in: number }>('/auth/qr/initiate', {});
        setQrPayload(res.qr_payload);
        setQrExpiresIn(res.expires_in || 120);
        setQrStatus('pending');

        // Countdown timer
        timer = setInterval(() => {
          setQrExpiresIn((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              clearInterval(pollInterval);
              setQrStatus('expired');
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        // Status polling every 2s
        pollInterval = setInterval(async () => {
          try {
            const statusRes = await api.get<{ status: string; auth?: any }>(`/auth/qr/status?session_id=${res.session_id}`);
            if (statusRes.status === 'authenticated' && statusRes.auth) {
              clearInterval(timer);
              clearInterval(pollInterval);
              setQrStatus('authenticated');
              await useAuthStore.getState().setSessionFromTokens(
                statusRes.auth.access_token,
                statusRes.auth.refresh_token,
                statusRes.auth.user
              );
            } else if (statusRes.status === 'expired') {
              clearInterval(timer);
              clearInterval(pollInterval);
              setQrStatus('expired');
            }
          } catch {
            // Ignore transient network errors during polling
          }
        }, 2000);
      } catch {
        setQrStatus('expired');
      }
    };

    startQrSession();

    return () => {
      if (timer) clearInterval(timer);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [signInMethod]);

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
        minHeight: '100%',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(245, 158, 11, 0.08), transparent), var(--surface-0)',
        padding: '40px 16px',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      <div
        style={{
          maxWidth: authMode === 'register' ? '880px' : '460px',
          width: '100%',
          padding: authMode === 'register' ? '36px 36px' : '36px 30px',
          background: 'var(--surface-1)',
          border: '1px solid var(--border-hairline)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-popover)',
          position: 'relative',
          transition: 'max-width 0.25s cubic-bezier(0.16, 1, 0.3, 1), padding 0.25s ease',
        }}
      >
        {/* Humora Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '26px' }}>
          <div
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '14px',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '18px',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.16) 0%, rgba(251, 191, 36, 0.05) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(245, 158, 11, 0.14)',
                marginBottom: '10px',
              }}
            >
              <PeopleOSLogo size={40} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '24px',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: 'var(--text-primary)',
                }}
              >
                HUMORA
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#f59e0b',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Platform
              </span>
            </div>
          </div>
          <h1
            style={{
              fontSize: '21px',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              marginBottom: '6px',
            }}
          >
            {authMode === 'signin' ? 'Sign In to Workspace' : 'Create Your Organization'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.4 }}>
            {authMode === 'signin'
              ? 'Humora Administrative & Management Workspace'
              : 'Launch your modern enterprise HRMS & biometric workspace in seconds'}
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
            Admin Sign In
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
            {/* Authentication Method Selector: Password vs QR Code */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '6px',
                marginBottom: '16px',
                padding: '4px',
                background: 'var(--surface-2)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-hairline)',
              }}
            >
              <button
                type="button"
                onClick={() => setSignInMethod('password')}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: signInMethod === 'password' ? 'var(--surface-1)' : 'transparent',
                  color: signInMethod === 'password' ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: signInMethod === 'password' ? 'var(--shadow-xs)' : 'none',
                  transition: 'all 0.16s ease',
                }}
              >
                <Lock size={13} color={signInMethod === 'password' ? 'var(--accent-primary)' : 'currentColor'} />
                <span>Password</span>
              </button>

              <button
                type="button"
                onClick={() => setSignInMethod('qr')}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: signInMethod === 'qr' ? 'var(--surface-1)' : 'transparent',
                  color: signInMethod === 'qr' ? '#10b981' : 'var(--text-muted)',
                  boxShadow: signInMethod === 'qr' ? 'var(--shadow-xs)' : 'none',
                  transition: 'all 0.16s ease',
                }}
              >
                <QrCode size={14} color={signInMethod === 'qr' ? '#10b981' : 'currentColor'} />
                <span>QR Code Login</span>
              </button>
            </div>

            {/* Quick-fill for the seeded demo account: development builds only */}
            {import.meta.env.DEV && (
            <div
              style={{
                marginBottom: '16px',
                padding: '6px 12px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border-hairline)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-emerald)' }} />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Demo Admin:</span>
              </div>
              <button
                type="button"
                className="btn-ghost"
                style={{
                  fontSize: '10.5px',
                  fontWeight: 600,
                  color: '#818cf8',
                  padding: '2px 10px',
                  cursor: 'pointer',
                  background: 'rgba(99, 102, 241, 0.1)',
                  borderRadius: '4px',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                }}
                onClick={handleDemoAdmin}
              >
                Auto-fill Admin
              </button>
            </div>
            )}

            {error && (
              <div
                style={{
                  background: 'var(--accent-rose-subtle)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  color: 'var(--accent-rose)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                  marginBottom: '16px',
                }}
              >
                {error}
              </div>
            )}

            {/* METHOD 1: STANDARD PASSWORD FORM */}
            {signInMethod === 'password' && (
              <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                  style={{ width: '100%', marginTop: '4px', height: '40px', gap: '8px' }}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span>Verifying credentials...</span>
                  ) : (
                    <>
                      <span>Sign In to Management Console</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* METHOD 2: WHATSAPP-STYLE QR CODE WEB LOGIN */}
            {signInMethod === 'qr' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Log in with Humora Android App
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '16px', maxWidth: '300px', lineHeight: 1.4 }}>
                  Scan this QR code from your phone's camera or Humora app to log in instantly.
                </div>

                <div
                  style={{
                    padding: '14px',
                    background: '#ffffff',
                    borderRadius: '16px',
                    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    width: '208px',
                    height: '208px',
                  }}
                >
                  {qrStatus === 'loading' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <RefreshCw size={24} className="animate-spin" color="#6366f1" />
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Generating QR...</span>
                    </div>
                  )}

                  {qrStatus === 'pending' && qrPayload && (
                    <QRCodeSVG
                      value={qrPayload}
                      size={180}
                      level="M"
                      includeMargin={false}
                    />
                  )}

                  {qrStatus === 'authenticated' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={48} color="#10b981" />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#10b981' }}>
                        Authenticated!
                      </span>
                    </div>
                  )}

                  {qrStatus === 'expired' && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(15, 23, 42, 0.88)',
                        borderRadius: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px',
                        gap: '10px',
                      }}
                    >
                      <AlertCircle size={28} color="#fbbf24" />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>
                        QR Code Expired
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSignInMethod('password');
                          setTimeout(() => setSignInMethod('qr'), 50);
                        }}
                        style={{
                          padding: '6px 14px',
                          background: '#10b981',
                          color: '#ffffff',
                          borderRadius: '8px',
                          border: 'none',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <RefreshCw size={12} /> Click to Reload
                      </button>
                    </div>
                  )}
                </div>

                {qrStatus === 'pending' && (
                  <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    Code expires in <strong style={{ color: '#fbbf24' }}>{qrExpiresIn}s</strong>
                  </div>
                )}

                <div
                  style={{
                    marginTop: '16px',
                    padding: '10px 14px',
                    background: 'var(--surface-2)',
                    borderRadius: '10px',
                    border: '1px solid var(--border-hairline)',
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    textAlign: 'left',
                    lineHeight: 1.6,
                    width: '100%',
                    maxWidth: '320px',
                  }}
                >
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                    How to use QR Login:
                  </div>
                  1. Open Humora on your Android app<br />
                  2. Tap <strong>Link Web Device</strong> in Settings or the Camera in Pulse Chat<br />
                  3. Point your camera at this QR code
                </div>
              </div>
            )}

            {/* SOCIAL LOGIN (Google, GitHub, Microsoft) */}
            {(authProviders.google || authProviders.github || authProviders.microsoft) && (
              <div style={{ marginTop: '20px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '14px',
                  }}
                >
                  <div style={{ flex: 1, height: '1px', background: 'var(--border-hairline)' }} />
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Or continue with
                  </span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border-hairline)' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {authProviders.google && (
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = '/api/v1/auth/oauth/google?client=web';
                      }}
                      style={{
                        width: '100%',
                        height: '38px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border-hairline)',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        cursor: 'pointer',
                        transition: 'all 0.16s ease',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"/>
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.29 21.43 7.37 24 12 24z"/>
                        <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.17 0 9.97 0 12s.46 3.83 1.26 5.42l4.02-3.15z"/>
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.29 2.57 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                      </svg>
                      <span>Continue with Google</span>
                    </button>
                  )}

                  {authProviders.github && (
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = '/api/v1/auth/oauth/github?client=web';
                      }}
                      style={{
                        width: '100%',
                        height: '38px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border-hairline)',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        cursor: 'pointer',
                        transition: 'all 0.16s ease',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                      </svg>
                      <span>Continue with GitHub</span>
                    </button>
                  )}

                  {authProviders.microsoft && (
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = '/api/v1/auth/oauth/microsoft?client=web';
                      }}
                      style={{
                        width: '100%',
                        height: '38px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border-hairline)',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        cursor: 'pointer',
                        transition: 'all 0.16s ease',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24">
                        <path fill="#f25022" d="M1 1h10v10H1z"/>
                        <path fill="#00a4ef" d="M1 13h10v10H1z"/>
                        <path fill="#7fba00" d="M13 1h10v10H13z"/>
                        <path fill="#ffb900" d="M13 13h10v10H13z"/>
                      </svg>
                      <span>Continue with Microsoft</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: '16px' }}>
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
          </>
        ) : (
          /* Admin / Organization Registration Mode */
          <>
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: '18px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 600, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <Building2 size={14} />
                <span>Enterprise Multi-Tenant Provisioning</span>
              </div>
              Registers your company workspace, initializes automated roles, departments, shifts, and grants you primary <strong>Superadmin</strong> root authority.
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

            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* SECTION 1: WORKSPACE IDENTITY (2-COLUMN GRID) */}
              <div
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px 18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <Building2 size={15} color="var(--accent-primary)" />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                    1. Organization & Domain Setup
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
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
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '3px', display: 'block' }}>
                      Workspace URL: <strong style={{ color: 'var(--accent-primary)' }}>{slug || 'company-slug'}</strong>.humora.internal
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION 2: SUPERADMIN CREDENTIALS (2-COLUMN GRID) */}
              <div
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px 18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <User size={15} color="var(--accent-primary)" />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                    2. Primary Superadmin Account
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
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

                  <div>
                    <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={12} />
                      <span>Corporate Admin Email *</span>
                    </label>
                    <input
                      type="email"
                      className="input-field"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      required
                      placeholder="admin@yourcompany.com"
                    />
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '3px', display: 'block' }}>
                      Primary administrative identity for workspace access.
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
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '3px', display: 'block' }}>
                      Protected by salted bcrypt & cryptographic session tokens.
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION 3: CORPORATE OUTBOUND EMAIL (SMTP GATEWAY) */}
              <div
                style={{
                  border: enableSmtpNow ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-lg)',
                  background: enableSmtpNow ? 'linear-gradient(145deg, rgba(245, 158, 11, 0.05) 0%, var(--surface-2) 100%)' : 'var(--surface-2)',
                  padding: '16px 18px',
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
                    <Server size={15} color="var(--accent-primary)" />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      3. Outbound Email Delivery (SMTP Gateway)
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      Optional
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      color: enableSmtpNow ? '#fbbf24' : 'var(--accent-primary)',
                      fontWeight: 600,
                      background: enableSmtpNow ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.06)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                    }}
                  >
                    {enableSmtpNow ? 'Collapse ▲' : '+ Setup Email Now (Optional) ▼'}
                  </span>
                </div>

                <p style={{ margin: '6px 0 0', fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Connect your corporate SMTP gateway for sending employee onboarding invites, monthly payslips, and OTPs. You can also configure this later in Company Settings.
                </p>

                {enableSmtpNow && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-hairline)' }}>
                    {/* SMTP Row 1: Host, Port, Encryption in a 3-column / responsive grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                      <div style={{ gridColumn: 'span 2' }}>
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

                    {/* SMTP Row 2: Username, Password, From Name in a 3-column / responsive grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
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
                    </div>
                  </div>
                )}
              </div>

              {/* ACTION BUTTON & TOGGLE */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', height: '42px', fontSize: '13px', fontWeight: 600, gap: '8px' }}
                  disabled={isRegistering}
                >
                  {isRegistering ? (
                    <span>Registering Organization...</span>
                  ) : (
                    <>
                      <span>Create Organization & Launch Workspace</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>

                <div style={{ textAlign: 'center', marginTop: '4px' }}>
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

