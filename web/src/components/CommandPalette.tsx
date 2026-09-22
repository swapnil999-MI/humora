import React, { useEffect, useState, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import {
  navigateToPage,
  setCreateIssueOpen,
  setCreateProjectOpen,
} from '../store/uiSlice';
import { setActiveIssue } from '../store/workSlice';
import { recordPunch } from '../store/hrmsSlice';
import {
  Search,
  Users,
  Kanban,
  Layers,
  Plus,
  Calendar,
  LogIn,
  LogOut,
  FolderGit2,
  CheckCircle,
  Sparkles,
  ArrowRight,
  Clock,
  Compass,
  Activity,
  UserCheck,
  UserPlus,
  ShieldCheck,
  ListFilter,
  CreditCard,
  Building2,
} from 'lucide-react';

interface CommandItem {
  id: string;
  category: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export const CommandPalette: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const dispatch = useAppDispatch();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { attendanceSummary } = useAppSelector((state) => state.hrms);
  const { kanbanBoard, backlog, projects } = useAppSelector((state) => state.work);
  const { employees } = useAppSelector((state) => state.hrms);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Aggregate command items
  const allItems: CommandItem[] = [];

  // 1. Core Actions & Navigation
  allItems.push({
    id: 'action-punch',
    category: 'Attendance',
    title: attendanceSummary?.punched_in ? 'Punch Out & Check Out' : 'Punch In & Start Workday',
    subtitle: 'Logs geofenced attendance entry',
    icon: attendanceSummary?.punched_in ? (
      <LogOut size={16} color="var(--accent-rose)" />
    ) : (
      <LogIn size={16} color="var(--accent-emerald)" />
    ),
    action: () => {
      dispatch(
        recordPunch({
          punch_type: attendanceSummary?.punched_in ? 'out' : 'in',
          source: 'web',
        })
      );
      onClose();
    },
  });

  allItems.push({
    id: 'action-hub',
    category: 'Navigation',
    title: 'Go to My Workday Hub',
    subtitle: 'Unified cockpit, quick punch & active sprint overview',
    icon: <Compass size={16} color="var(--accent-primary)" />,
    shortcut: 'Alt+0',
    action: () => {
      dispatch(navigateToPage('hub'));
      onClose();
    },
  });

  allItems.push({
    id: 'action-switch-attendance',
    category: 'Navigation',
    title: 'Go to Attendance & Time Desk',
    subtitle: 'Live punch terminal, monthly calendar matrix, shift catalog & rostering',
    icon: <Clock size={16} color="#34d399" />,
    action: () => {
      dispatch(navigateToPage('attendance'));
      onClose();
    },
  });

  allItems.push({
    id: 'action-leaves',
    category: 'Navigation',
    title: 'Go to Leaves & Absence Desk',
    subtitle: 'Leave balances, quota tracking, and time-off applications',
    icon: <Calendar size={16} color="#fbbf24" />,
    action: () => {
      dispatch(navigateToPage('leaves'));
      onClose();
    },
  });

  allItems.push({
    id: 'action-capacity',
    category: 'Navigation',
    title: 'Go to Team Capacity & Workload',
    subtitle: 'Sprint delivery risk copilot, burn-rate & developer bandwidth',
    icon: <Activity size={16} color="#38bdf8" />,
    action: () => {
      dispatch(navigateToPage('capacity'));
      onClose();
    },
  });

  allItems.push({
    id: 'action-payroll',
    category: 'Navigation',
    title: 'Go to My Payroll & Payslips (Zoho Payroll)',
    subtitle: 'Monthly salary slips, CTC structure, IT declarations & FBP claims',
    icon: <CreditCard size={16} color="var(--accent-primary)" />,
    action: () => {
      dispatch(navigateToPage('payroll'));
      onClose();
    },
  });

  allItems.push({
    id: 'action-profile',
    category: 'Navigation',
    title: 'Go to My Profile (ESS)',
    subtitle: 'Employee profile, personal info, documents & emergency contacts',
    icon: <UserCheck size={16} color="#a78bfa" />,
    action: () => {
      dispatch(navigateToPage('profile'));
      onClose();
    },
  });

  allItems.push({
    id: 'action-company-settings',
    category: 'Management',
    title: 'Company Profile & Payslip Identity Setup',
    subtitle: 'Configure company legal entity, CIN, GSTIN, logo and signatory',
    icon: <Building2 size={16} color="#10b981" />,
    action: () => {
      dispatch(navigateToPage('company_settings'));
      onClose();
    },
  });

  allItems.push({
    id: 'action-onboarding',
    category: 'Navigation',
    title: 'Go to Onboarding Pipeline',
    subtitle: 'Zoho People-grade candidate onboarding & document verification',
    icon: <UserPlus size={16} color="#f472b6" />,
    action: () => {
      dispatch(navigateToPage('onboarding'));
      onClose();
    },
  });

  allItems.push({
    id: 'action-directory',
    category: 'Navigation',
    title: 'Go to Team Directory & Org Tree',
    subtitle: 'Interactive team reporting lines and employee database',
    icon: <Users size={16} color="var(--accent-emerald)" />,
    action: () => {
      dispatch(navigateToPage('directory'));
      onClose();
    },
  });

  allItems.push({
    id: 'action-approvals',
    category: 'Navigation',
    title: 'Go to Manager Approvals Desk',
    subtitle: 'Review pending leaves, regularizations, and team time off',
    icon: <ShieldCheck size={16} color="#f59e0b" />,
    action: () => {
      dispatch(navigateToPage('approvals'));
      onClose();
    },
  });

  allItems.push({
    id: 'action-shifts',
    category: 'Navigation',
    title: 'Go to Shift Catalog & Rostering',
    subtitle: 'Manage company shifts, policies, and employee roster assignments',
    icon: <Layers size={16} color="#38bdf8" />,
    action: () => {
      dispatch(navigateToPage('shifts'));
      onClose();
    },
  });

  allItems.push({
    id: 'action-radar',
    category: 'Navigation',
    title: 'Go to Live Team Presence Radar',
    subtitle: 'Real-time visibility into who is working, on break, or on leave',
    icon: <Users size={16} color="#34d399" />,
    action: () => {
      dispatch(navigateToPage('radar'));
      onClose();
    },
  });

  allItems.push({
    id: 'action-switch-work',
    category: 'Navigation',
    title: 'Go to Agile Kanban Board',
    subtitle: 'Interactive sprint board, drag-and-drop workflow statuses',
    icon: <Kanban size={16} color="#c084fc" />,
    shortcut: 'Alt+2',
    action: () => {
      dispatch(navigateToPage('kanban'));
      onClose();
    },
  });

  allItems.push({
    id: 'action-list-view',
    category: 'Navigation',
    title: 'Go to High-Density Issues List',
    subtitle: 'Tabular issue view with inline status and priority filters',
    icon: <ListFilter size={16} color="#818cf8" />,
    action: () => {
      dispatch(navigateToPage('list'));
      onClose();
    },
  });

  allItems.push({
    id: 'action-backlog',
    category: 'Navigation',
    title: 'Go to Sprints & Product Backlog',
    subtitle: 'Sprint planning, capacity allocation, and backlog grooming',
    icon: <Layers size={16} color="#60a5fa" />,
    action: () => {
      dispatch(navigateToPage('backlog'));
      onClose();
    },
  });

  allItems.push({
    id: 'action-create-issue',
    category: 'Agile Work',
    title: 'Create New Agile Issue',
    subtitle: 'Task, Story, Bug, or Epic with story points',
    icon: <Plus size={16} color="var(--accent-primary)" />,
    shortcut: 'C',
    action: () => {
      dispatch(setCreateIssueOpen(true));
      onClose();
    },
  });

  // 2. Agile Issues
  const boardIssues = kanbanBoard?.columns.flatMap((c) => c.issues) || [];
  const backlogIssues = backlog?.backlog_issues || [];
  const activeSprintIssues = backlog?.active_sprint?.issues || [];
  const combinedIssues = [...boardIssues, ...backlogIssues, ...activeSprintIssues];
  const uniqueIssues = Array.from(new Map(combinedIssues.map((i) => [i.id, i])).values());

  uniqueIssues.forEach((issue) => {
    allItems.push({
      id: `issue-${issue.id}`,
      category: 'Issues',
      title: `${issue.issue_key}: ${issue.title}`,
      subtitle: `${issue.status_name || 'To Do'} &bull; Priority: ${issue.priority} &bull; ${issue.assignee_name || 'Unassigned'}`,
      icon: <CheckCircle size={16} color="var(--accent-primary)" />,
      action: () => {
        dispatch(navigateToPage('kanban'));
        dispatch(setActiveIssue(issue));
        onClose();
      },
    });
  });

  // 3. Employees
  employees.forEach((emp) => {
    allItems.push({
      id: `emp-${emp.id}`,
      category: 'Employees',
      title: `${emp.first_name} ${emp.last_name} (${emp.employee_code})`,
      subtitle: `${emp.designation_title || 'Team Member'} &bull; ${emp.work_email}`,
      icon: <Users size={16} color="var(--accent-emerald)" />,
      action: () => {
        dispatch(navigateToPage('directory'));
        onClose();
      },
    });
  });

  // Filter based on user query
  const filtered = allItems.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(query.toLowerCase())) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="cmd-palette-overlay" onClick={onClose}>
      <div className="cmd-palette-box" onClick={(e) => e.stopPropagation()}>
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            borderBottom: '1px solid var(--border-hairline)',
            background: 'var(--surface-1)',
          }}
        >
          <Search size={20} color="var(--accent-primary)" strokeWidth={2} />
          <input
            ref={inputRef}
            type="text"
            className="cmd-palette-input"
            placeholder="Type a command, issue key (HUM-1), or employee name..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="cmd-k-kbd">ESC</kbd>
        </div>

        {/* Results List */}
        <div className="cmd-palette-list">
          {filtered.length === 0 ? (
            <div
              style={{
                padding: '44px 20px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px',
              }}
            >
              No matching commands, issues, or employees found.
            </div>
          ) : (
            filtered.map((item, idx) => (
              <div
                key={item.id}
                className={`cmd-palette-item ${idx === selectedIndex ? 'selected' : ''}`}
                onClick={item.action}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: 'var(--radius-sm)',
                      background: idx === selectedIndex ? 'var(--accent-subtle)' : 'var(--surface-2)',
                      border: '1px solid var(--border-hairline)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '13px',
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.title}
                    </div>
                    {item.subtitle && (
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          marginTop: '2px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '12px' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      padding: '2px 7px',
                      borderRadius: 'var(--radius-xs)',
                      background: 'var(--surface-2)',
                      color: 'var(--text-muted)',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      border: '1px solid var(--border-hairline)',
                    }}
                  >
                    {item.category}
                  </span>
                  {item.shortcut && (
                    <kbd className="cmd-k-kbd">{item.shortcut}</kbd>
                  )}
                  <ArrowRight size={13} color="var(--text-muted)" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info bar */}
        <div
          style={{
            padding: '10px 20px',
            borderTop: '1px solid var(--border-hairline)',
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ display: 'flex', gap: '16px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <kbd className="cmd-k-kbd">&uarr;&darr;</kbd> Navigate
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <kbd className="cmd-k-kbd">&crarr;</kbd> Select
            </span>
          </div>
          <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>Humora Spotlight Engine</span>
        </div>
      </div>
    </div>
  );
};
