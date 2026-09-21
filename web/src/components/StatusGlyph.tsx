import React from 'react';

interface StatusGlyphProps {
  category?: string; // 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled'
  name?: string;
  size?: number;
}

export const StatusGlyph: React.FC<StatusGlyphProps> = ({
  category = 'todo',
  name = '',
  size = 14,
}) => {
  const norm = (category || name || '').toLowerCase().replace(/[\s-]/g, '_');

  if (norm.includes('backlog')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <circle
          cx="8"
          cy="8"
          r="6"
          stroke="#8a8f98"
          strokeWidth="1.5"
          strokeDasharray="2.5 2.5"
        />
      </svg>
    );
  }

  if (norm.includes('progress') || norm === 'in_progress') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <circle cx="8" cy="8" r="6" stroke="#f59e0b" strokeWidth="1.5" />
        <path d="M8 2A6 6 0 0 1 8 14V2Z" fill="#f59e0b" />
      </svg>
    );
  }

  if (norm.includes('review')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <circle cx="8" cy="8" r="6" stroke="#06b6d4" strokeWidth="1.5" />
        <path d="M8 2A6 6 0 1 1 2 8H8V2Z" fill="#06b6d4" />
      </svg>
    );
  }

  if (norm.includes('done') || norm === 'closed') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <circle cx="8" cy="8" r="7" fill="#5e6ad2" />
        <path
          d="M5 8L7 10L11 6"
          stroke="#ffffff"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (norm.includes('cancel')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <circle cx="8" cy="8" r="6" stroke="#64748b" strokeWidth="1.5" />
        <path d="M5 11L11 5" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  // Default: Todo (Hollow crisp circle)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <circle cx="8" cy="8" r="6" stroke="#cbd5e1" strokeWidth="1.5" />
    </svg>
  );
};

interface PriorityGlyphProps {
  priority?: string; // 'urgent' | 'high' | 'medium' | 'low' | 'none'
  size?: number;
}

export const PriorityGlyph: React.FC<PriorityGlyphProps> = ({
  priority = 'medium',
  size = 14,
}) => {
  const norm = (priority || '').toLowerCase();

  if (norm === 'urgent' || norm === 'highest') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <rect x="2" y="2" width="12" height="12" rx="3" fill="#ef4444" />
        <path
          d="M8 5V8.5M8 11H8.01"
          stroke="#ffffff"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (norm === 'high') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <rect x="3" y="9" width="2.5" height="5" rx="1" fill="#f97316" />
        <rect x="6.8" y="6" width="2.5" height="8" rx="1" fill="#f97316" />
        <rect x="10.5" y="3" width="2.5" height="11" rx="1" fill="#f97316" />
      </svg>
    );
  }

  if (norm === 'medium') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <rect x="3" y="9" width="2.5" height="5" rx="1" fill="#eab308" />
        <rect x="6.8" y="6" width="2.5" height="8" rx="1" fill="#eab308" />
        <rect x="10.5" y="3" width="2.5" height="11" rx="1" fill="rgba(255,255,255,0.15)" />
      </svg>
    );
  }

  if (norm === 'low') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <rect x="3" y="9" width="2.5" height="5" rx="1" fill="#64748b" />
        <rect x="6.8" y="6" width="2.5" height="8" rx="1" fill="rgba(255,255,255,0.15)" />
        <rect x="10.5" y="3" width="2.5" height="11" rx="1" fill="rgba(255,255,255,0.15)" />
      </svg>
    );
  }

  // Default: Lowest / None (Horizontal dashes)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <line x1="4" y1="8" x2="6" y2="8" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="7.5" y1="8" x2="9.5" y2="8" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11" y1="8" x2="13" y2="8" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
};
