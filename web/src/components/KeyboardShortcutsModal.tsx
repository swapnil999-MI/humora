import React, { useEffect } from 'react';
import { X, Command, CornerDownLeft, ArrowDown, ArrowUp, Sparkles, Keyboard } from 'lucide-react';

interface ShortcutItem {
  keys: string[];
  description: string;
  category: 'Navigation' | 'Actions' | 'Global';
}

const SHORTCUTS: ShortcutItem[] = [
  // Navigation
  { keys: ['⌘', 'K'], description: 'Focus Universal Search & Autocomplete', category: 'Navigation' },
  { keys: ['⌘', '\\'], description: 'Toggle Collapsible Left Sidebar', category: 'Navigation' },
  { keys: ['Alt', '0'], description: 'Switch to Employee Self-Service Space (ESS)', category: 'Navigation' },
  { keys: ['Alt', '1'], description: 'Switch to Management Console', category: 'Navigation' },
  { keys: ['Alt', '2'], description: 'Switch to Agile Work Management', category: 'Navigation' },

  // Actions
  { keys: ['C'], description: 'Open Quick Issue Creation Dialog', category: 'Actions' },
  { keys: ['↑', '↓'], description: 'Navigate Live Search Dropdown Suggestions', category: 'Actions' },
  { keys: ['↵'], description: 'Select / Execute Active Search Suggestion', category: 'Actions' },
  { keys: ['Esc'], description: 'Dismiss Active Dropdown, Drawer, or Modal', category: 'Actions' },

  // Global
  { keys: ['?'], description: 'Toggle Keyboard Shortcuts Guide', category: 'Global' },
];

export const KeyboardShortcutsModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories = ['Navigation', 'Actions', 'Global'] as const;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10, 16, 29, 0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
        animation: 'fadeIn 120ms ease-out',
      }}
    >
      <div
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '560px',
          maxWidth: '94vw',
          maxHeight: '85vh',
          backgroundColor: 'var(--surface-1)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-popover)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideUp 160ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-hairline)',
            background: 'var(--surface-2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--accent-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}
            >
              <Keyboard size={18} strokeWidth={2} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Keyboard Shortcuts</h3>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Master navigation and instant productivity across Humora
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn-ghost"
            style={{
              width: '28px',
              height: '28px',
              padding: 0,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: '16px 20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {categories.map((cat) => {
            const items = SHORTCUTS.filter((s) => s.category === cat);
            return (
              <div key={cat}>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--accent-primary)',
                    marginBottom: '8px',
                  }}
                >
                  {cat}
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    backgroundColor: 'var(--surface-2)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-hairline)',
                    padding: '6px',
                  }}
                >
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        transition: 'background-color var(--transition-fast)',
                      }}
                      className="shortcut-row"
                    >
                      <span style={{ fontSize: '12.5px', color: 'var(--text-primary)', fontWeight: 500 }}>
                        {item.description}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {item.keys.map((k, ki) => (
                          <kbd
                            key={ki}
                            className="cmd-k-kbd"
                            style={{
                              fontSize: '11px',
                              padding: '2px 7px',
                              minWidth: '22px',
                              textAlign: 'center',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                            }}
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 20px',
            background: 'var(--surface-2)',
            borderTop: '1px solid var(--border-hairline)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: 'var(--text-muted)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={13} color="var(--accent-primary)" />
            Press <kbd className="cmd-k-kbd">?</kbd> anytime to reopen this guide
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
