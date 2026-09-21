import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { login } from '../../store/authSlice';
import { Sparkles, Shield, ArrowRight } from 'lucide-react';

export const LoginView: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector((state) => state.auth);

  const [email, setEmail] = useState('founder@acme.io');
  const [password, setPassword] = useState('StrongPassword2026!');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(login({ email, password }));
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-0)',
        padding: '24px',
      }}
    >
      <div
        style={{
          maxWidth: '420px',
          width: '100%',
          padding: '36px',
          background: 'var(--surface-2)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-popover)',
        }}
      >
        {/* Brand Icon */}
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
              marginBottom: '14px',
            }}
          >
            <Sparkles size={22} color="#fff" />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '6px' }}>
            Sign in to Humora
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Unified Enterprise HRMS & Agile Work Platform
          </p>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(244, 63, 94, 0.12)',
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

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">Work Email</label>
            <input
              type="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label">Master Password</label>
            <input
              type="password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '8px', padding: '12px' }}
            disabled={isLoading}
          >
            {isLoading ? 'Verifying with Argon2id...' : 'Sign In'}
            <ArrowRight size={16} />
          </button>
        </form>

        <div
          style={{
            marginTop: '28px',
            paddingTop: '20px',
            borderTop: '1px solid var(--border-subtle)',
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
            <Shield size={14} color="var(--accent-emerald)" />
            <span>Zero-Trust Session Isolation & Dynamic RBAC Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
