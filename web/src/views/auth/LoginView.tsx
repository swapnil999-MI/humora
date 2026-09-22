import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { login } from '../../store/authSlice';
import { Sparkles, ShieldCheck, ArrowRight, Lock, Mail } from 'lucide-react';

export const LoginView: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector((state) => state.auth);

  const [email, setEmail] = useState('founder@acme.io');
  const [password, setPassword] = useState('StrongPassword2026!');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(login({ email, password }));
  };

  const handleDemoFill = () => {
    setEmail('founder@acme.io');
    setPassword('StrongPassword2026!');
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
            Sign in to Humora
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.4 }}>
            Enterprise HRMS & Agile Work Intelligence
          </p>
        </div>

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
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Demo Workspace Active
            </span>
          </div>
          <button
            type="button"
            className="btn-ghost"
            style={{
              fontSize: '11px',
              fontWeight: 500,
              color: 'var(--accent-primary)',
              padding: '2px 8px',
              cursor: 'pointer',
            }}
            onClick={handleDemoFill}
          >
            Auto-fill Credentials
          </button>
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
        </form>

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
    </div>
  );
};

