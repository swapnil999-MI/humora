import React from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import { removeToast } from '../store/uiSlice';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const dispatch = useAppDispatch();
  const { toasts } = useAppSelector((state) => state.ui);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast ${
            toast.type === 'success' ? 'toast-success' : 'toast-error'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={16} />
          ) : toast.type === 'error' ? (
            <AlertTriangle size={16} />
          ) : (
            <Info size={16} />
          )}
          <span>{toast.message}</span>
          <button
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              marginLeft: '8px',
            }}
            onClick={() => dispatch(removeToast(toast.id))}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
