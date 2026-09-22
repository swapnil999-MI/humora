import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import { removeToast, ToastMessage } from '../store/uiSlice';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const ToastItem: React.FC<{ toast: ToastMessage }> = ({ toast }) => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch(removeToast(toast.id));
    }, 3500);
    return () => clearTimeout(timer);
  }, [dispatch, toast.id]);

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  return (
    <div
      className={`toast ${isSuccess ? 'toast-success' : isError ? 'toast-error' : 'toast-info'}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 16px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--surface-2)',
        border: isSuccess
          ? '1px solid rgba(16, 185, 129, 0.35)'
          : isError
          ? '1px solid rgba(239, 68, 68, 0.35)'
          : '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-popover)',
        color: 'var(--text-primary)',
        fontSize: '12.5px',
        fontWeight: 500,
        pointerEvents: 'auto',
        animation: 'toastSlideIn 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        maxWidth: '380px',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {isSuccess ? (
          <CheckCircle2 size={16} color="#10b981" />
        ) : isError ? (
          <AlertTriangle size={16} color="#ef4444" />
        ) : (
          <Info size={16} color="var(--accent-primary)" />
        )}
      </div>

      <span style={{ flex: 1, lineHeight: 1.4 }}>{toast.message}</span>

      <button
        type="button"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2px',
          borderRadius: '4px',
          transition: 'color var(--transition-fast)',
        }}
        onClick={() => dispatch(removeToast(toast.id))}
        title="Dismiss alert"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts } = useAppSelector((state) => state.ui);

  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      className="toast-container"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
};

export default ToastContainer;
