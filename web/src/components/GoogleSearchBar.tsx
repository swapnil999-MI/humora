import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import {
  navigateToPage,
  setCreateIssueOpen,
  setCreateProjectOpen,
  addToast,
  PageId,
} from '../store/uiSlice';
import { setActiveIssue } from '../store/workSlice';
import { recordPunch } from '../store/hrmsSlice';
import {
  Search,
  X,
  Users,
  Kanban,
  Layers,
  Plus,
  Calendar,
  LogIn,
  LogOut,
  Compass,
  ShieldCheck,
  CreditCard,
  Building2,
  Clock,
  ArrowUpRight,
  User,
  ListFilter,
  CheckCircle2,
  History,
  Sparkles,
} from 'lucide-react';

export type SearchCategory = 'all' | 'people' | 'tickets' | 'pages';

interface SearchResultItem {
  id: string;
  category: 'people' | 'tickets' | 'pages' | 'action';
  title: string;
  subtitle: string;
  badge?: string;
  icon: React.ReactNode;
  action: () => void;
}

// Substring match highlighter for senior UX feedback
const highlightMatch = (text: string, q: string) => {
  if (!q.trim()) return text;
  const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.trim().toLowerCase() ? (
          <mark key={i} className="search-highlight">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};

export const GoogleSearchBar: React.FC = () => {
  const dispatch = useAppDispatch();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<SearchCategory>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Stored recent searches memory
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('humora_recent_searches');
      return saved ? JSON.parse(saved) : ['Attendance', 'Sprints', 'Directory'];
    } catch {
      return ['Attendance', 'Sprints', 'Directory'];
    }
  });

  const addRecentSearch = (term: string) => {
    if (!term || term.trim().length < 2) return;
    setRecentSearches((prev) => {
      const updated = [term.trim(), ...prev.filter((t) => t.toLowerCase() !== term.trim().toLowerCase())].slice(0, 5);
      try {
        localStorage.setItem('humora_recent_searches', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const clearRecentSearches = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches([]);
    try {
      localStorage.removeItem('humora_recent_searches');
    } catch {}
  };

  const { employees, attendanceSummary } = useAppSelector((state) => state.hrms);
  const { kanbanBoard, backlog, projects } = useAppSelector((state) => state.work);

  // Global listener for Cmd+K / Ctrl+K and custom event to focus search
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };

    const handleCustomFocus = () => {
      inputRef.current?.focus();
      setIsOpen(true);
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('focus-header-search', handleCustomFocus);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('focus-header-search', handleCustomFocus);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Build searchable index of items
  const allResults = useMemo(() => {
    const items: SearchResultItem[] = [];

    // 1. Core Quick Actions & Pages
    items.push({
      id: 'action-punch',
      category: 'action',
      title: attendanceSummary?.punched_in ? 'Punch Out & Check Out' : 'Punch In & Start Workday',
      subtitle: attendanceSummary?.punched_in ? 'Stop current session timer' : 'Start attendance tracking',
      badge: 'Action',
      icon: attendanceSummary?.punched_in ? (
        <LogOut size={15} color="var(--accent-primary)" />
      ) : (
        <LogIn size={15} color="var(--accent-primary)" />
      ),
      action: () => {
        dispatch(recordPunch({ punch_type: attendanceSummary?.punched_in ? 'out' : 'in', source: 'web' }));
        setIsOpen(false);
      },
    });

    items.push({
      id: 'page-hub',
      category: 'pages',
      title: 'My Workday Hub',
      subtitle: 'Unified employee cockpit & sprint overview',
      badge: 'ESS Page',
      icon: <Compass size={15} color="var(--accent-primary)" />,
      action: () => {
        dispatch(navigateToPage('hub'));
        setIsOpen(false);
      },
    });

    items.push({
      id: 'page-attendance',
      category: 'pages',
      title: 'My Attendance & Terminal',
      subtitle: 'Punch records, time tracking & regularization',
      badge: 'ESS Page',
      icon: <Clock size={15} color="var(--accent-primary)" />,
      action: () => {
        dispatch(navigateToPage('attendance'));
        setIsOpen(false);
      },
    });

    items.push({
      id: 'page-leaves',
      category: 'pages',
      title: 'Leaves & Absence Planner',
      subtitle: 'Apply for leave, absence balances & quotas',
      badge: 'ESS Page',
      icon: <Calendar size={15} color="var(--accent-primary)" />,
      action: () => {
        dispatch(navigateToPage('leaves'));
        setIsOpen(false);
      },
    });

    items.push({
      id: 'page-payroll',
      category: 'pages',
      title: 'Payroll & Salary Slips',
      subtitle: 'Payslip downloads, CTC breakdown & taxes',
      badge: 'ESS Page',
      icon: <CreditCard size={15} color="var(--accent-primary)" />,
      action: () => {
        dispatch(navigateToPage('payroll'));
        setIsOpen(false);
      },
    });

    items.push({
      id: 'page-directory',
      category: 'pages',
      title: 'Organization & Employee Directory',
      subtitle: 'All staff profiles, teams and departments',
      badge: 'Console',
      icon: <Users size={15} color="var(--accent-primary)" />,
      action: () => {
        dispatch(navigateToPage('directory'));
        setIsOpen(false);
      },
    });

    items.push({
      id: 'page-radar',
      category: 'pages',
      title: 'Live Team Presence Radar',
      subtitle: 'Real-time on-duty, remote & on-leave staff',
      badge: 'Console',
      icon: <ShieldCheck size={15} color="var(--accent-primary)" />,
      action: () => {
        dispatch(navigateToPage('radar'));
        setIsOpen(false);
      },
    });

    items.push({
      id: 'page-shifts',
      category: 'pages',
      title: 'Shift Catalog & Rostering',
      subtitle: 'Rotational patterns and schedule assignments',
      badge: 'Console',
      icon: <Calendar size={15} color="var(--accent-primary)" />,
      action: () => {
        dispatch(navigateToPage('shifts'));
        setIsOpen(false);
      },
    });

    items.push({
      id: 'page-approvals',
      category: 'pages',
      title: 'Approvals Desk',
      subtitle: 'Pending leaves and regularization review',
      badge: 'Console',
      icon: <CheckCircle2 size={15} color="var(--accent-primary)" />,
      action: () => {
        dispatch(navigateToPage('approvals'));
        setIsOpen(false);
      },
    });

    items.push({
      id: 'page-kanban',
      category: 'pages',
      title: 'Work Kanban Board',
      subtitle: 'Sprint issues and workflow columns',
      badge: 'Agile',
      icon: <Kanban size={15} color="var(--accent-primary)" />,
      action: () => {
        dispatch(navigateToPage('kanban'));
        setIsOpen(false);
      },
    });

    items.push({
      id: 'page-list',
      category: 'pages',
      title: 'High-Density Ticket List',
      subtitle: 'Sortable, filterable sprint backlog table',
      badge: 'Agile',
      icon: <ListFilter size={15} color="var(--accent-primary)" />,
      action: () => {
        dispatch(navigateToPage('list'));
        setIsOpen(false);
      },
    });

    items.push({
      id: 'page-backlog',
      category: 'pages',
      title: 'Sprints & Backlog Planning',
      subtitle: 'Capacity estimation and velocity tracking',
      badge: 'Agile',
      icon: <Layers size={15} color="var(--accent-primary)" />,
      action: () => {
        dispatch(navigateToPage('backlog'));
        setIsOpen(false);
      },
    });

    items.push({
      id: 'action-create-issue',
      category: 'action',
      title: 'Create New Work Issue',
      subtitle: 'Add a new task, story, or bug',
      badge: 'Shortcut (C)',
      icon: <Plus size={15} color="var(--accent-primary)" />,
      action: () => {
        dispatch(setCreateIssueOpen(true));
        setIsOpen(false);
      },
    });

    // 2. Employees (People)
    if (employees && employees.length > 0) {
      employees.forEach((emp) => {
        const fullName = `${emp.first_name} ${emp.last_name}`.trim();
        items.push({
          id: `emp-${emp.id}`,
          category: 'people',
          title: fullName || 'Staff Member',
          subtitle: `${emp.designation_title || emp.department_name || 'Staff'} · ${emp.work_email}`,
          badge: emp.employee_code || 'Staff',
          icon: emp.avatar_url ? (
            <img
              src={emp.avatar_url}
              alt=""
              style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                background: 'var(--accent-subtle)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 700,
              }}
            >
              {emp.first_name?.[0] || 'E'}
            </div>
          ),
          action: () => {
            dispatch(navigateToPage('directory'));
            setIsOpen(false);
          },
        });
      });
    }

    // 3. Work Issues & Tickets
    if (kanbanBoard?.columns) {
      kanbanBoard.columns.forEach((col) => {
        col.issues?.forEach((issue) => {
          items.push({
            id: `issue-${issue.id}`,
            category: 'tickets',
            title: `[${issue.issue_key}] ${issue.title}`,
            subtitle: `Status: ${col.name} · Priority: ${issue.priority} · Type: ${issue.issue_type}`,
            badge: issue.issue_key,
            icon: <Kanban size={15} color="var(--accent-primary)" />,
            action: () => {
              dispatch(setActiveIssue(issue));
              dispatch(navigateToPage('kanban'));
              setIsOpen(false);
            },
          });
        });
      });
    }

    if (backlog?.backlog_issues) {
      backlog.backlog_issues.forEach((issue) => {
        if (!items.some((i) => i.id === `issue-${issue.id}`)) {
          items.push({
            id: `issue-${issue.id}`,
            category: 'tickets',
            title: `[${issue.issue_key}] ${issue.title}`,
            subtitle: `Backlog · Priority: ${issue.priority} · Type: ${issue.issue_type}`,
            badge: issue.issue_key,
            icon: <Layers size={15} color="var(--accent-primary)" />,
            action: () => {
              dispatch(setActiveIssue(issue));
              dispatch(navigateToPage('backlog'));
              setIsOpen(false);
            },
          });
        }
      });
    }

    if (backlog?.active_sprint?.issues) {
      backlog.active_sprint.issues.forEach((issue) => {
        if (!items.some((i) => i.id === `issue-${issue.id}`)) {
          items.push({
            id: `issue-${issue.id}`,
            category: 'tickets',
            title: `[${issue.issue_key}] ${issue.title}`,
            subtitle: `Active Sprint · Priority: ${issue.priority} · Type: ${issue.issue_type}`,
            badge: issue.issue_key,
            icon: <Kanban size={15} color="var(--accent-primary)" />,
            action: () => {
              dispatch(setActiveIssue(issue));
              dispatch(navigateToPage('kanban'));
              setIsOpen(false);
            },
          });
        }
      });
    }

    return items;
  }, [dispatch, employees, kanbanBoard, backlog, attendanceSummary]);

  // Filter items according to search query and category
  const filteredResults = useMemo(() => {
    let list = allResults;

    if (category === 'people') {
      list = list.filter((item) => item.category === 'people');
    } else if (category === 'tickets') {
      list = list.filter((item) => item.category === 'tickets');
    } else if (category === 'pages') {
      list = list.filter((item) => item.category === 'pages' || item.category === 'action');
    }

    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      // Return top suggested entries when query is empty
      return list.slice(0, 7);
    }

    return list
      .filter((item) => {
        return (
          item.title.toLowerCase().includes(trimmed) ||
          item.subtitle.toLowerCase().includes(trimmed) ||
          (item.badge && item.badge.toLowerCase().includes(trimmed))
        );
      })
      .slice(0, 10);
  }, [allResults, category, query]);

  // Reset selected index when filtered results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredResults]);

  // Auto-scroll selected item into view on keyboard navigation
  useEffect(() => {
    if (listRef.current) {
      const activeElem = listRef.current.querySelector('.google-dropdown-item.selected') as HTMLElement;
      if (activeElem) {
        activeElem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  const handleItemSelect = (item: SearchResultItem) => {
    if (query.trim()) {
      addRecentSearch(query.trim());
    } else {
      addRecentSearch(item.title);
    }
    item.action();
  };

  // Keyboard navigation inside dropdown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredResults.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredResults.length) % Math.max(1, filteredResults.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredResults[selectedIndex]) {
        handleItemSelect(filteredResults[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div
      ref={containerRef}
      className={`google-search-container ${isOpen ? 'is-active' : ''}`}
      style={{ position: 'relative', width: '380px', maxWidth: '42vw' }}
    >
      {/* The Google-Style Pill Search Input */}
      <div
        className={`google-search-bar ${isOpen ? 'expanded' : ''}`}
        onClick={() => {
          inputRef.current?.focus();
          setIsOpen(true);
        }}
      >
        <Search
          size={16}
          strokeWidth={2}
          className="google-search-icon"
          style={{
            color: isOpen ? 'var(--accent-primary)' : 'var(--text-muted)',
            flexShrink: 0,
            transition: 'color var(--transition-fast)',
          }}
        />

        <input
          ref={inputRef}
          id="header-google-search-input"
          type="text"
          className="google-search-input"
          placeholder="Search employees, tickets, pages..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck={false}
        />

        {query ? (
          <button
            type="button"
            className="google-search-clear-btn"
            onClick={handleClear}
            title="Clear search"
          >
            <X size={14} strokeWidth={2.2} />
          </button>
        ) : (
          <div className="google-search-shortcut" title="Press ⌘K to search">
            <kbd className="cmd-k-kbd">&#8984;</kbd>
            <kbd className="cmd-k-kbd">K</kbd>
          </div>
        )}
      </div>

      {/* Google-Style Attached Live Dropdown (No separate popup screen!) */}
      {isOpen && (
        <div className="google-dropdown-menu">
          {/* Filter Chips Bar */}
          <div className="google-dropdown-tabs">
            <button
              type="button"
              className={`google-tab-chip ${category === 'all' ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setCategory('all');
                inputRef.current?.focus();
              }}
            >
              All
            </button>
            <button
              type="button"
              className={`google-tab-chip ${category === 'people' ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setCategory('people');
                inputRef.current?.focus();
              }}
            >
              People ({employees?.length || 0})
            </button>
            <button
              type="button"
              className={`google-tab-chip ${category === 'tickets' ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setCategory('tickets');
                inputRef.current?.focus();
              }}
            >
              Tickets
            </button>
            <button
              type="button"
              className={`google-tab-chip ${category === 'pages' ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setCategory('pages');
                inputRef.current?.focus();
              }}
            >
              Pages
            </button>
          </div>

          {/* Recent Searches Pill Row (Shown when query is empty) */}
          {!query && recentSearches.length > 0 && (
            <div className="google-recent-searches-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <History size={11} color="var(--accent-primary)" />
                <span style={{ fontWeight: 600 }}>Recent:</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', flex: 1 }}>
                {recentSearches.map((term, ti) => (
                  <button
                    key={ti}
                    type="button"
                    className="google-recent-chip"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQuery(term);
                      inputRef.current?.focus();
                    }}
                  >
                    {term}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="google-recent-clear-link"
                onClick={clearRecentSearches}
              >
                Clear
              </button>
            </div>
          )}

          {/* Autocomplete Results List */}
          <div ref={listRef} className="google-dropdown-list">
            {filteredResults.length === 0 ? (
              <div className="google-dropdown-empty">
                <Search size={22} strokeWidth={1.5} color="var(--text-dim)" />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  No results found for &ldquo;{query}&rdquo;
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Try searching by employee name, issue key (e.g. PAY-101), or page name.
                </span>
              </div>
            ) : (
              filteredResults.map((item, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <div
                    key={item.id}
                    className={`google-dropdown-item ${isSelected ? 'selected' : ''}`}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => handleItemSelect(item)}
                  >
                    {/* Leading Icon / Avatar */}
                    <div className="google-item-icon-box">
                      {item.icon}
                    </div>

                    {/* Content text with Substring Highlighting */}
                    <div className="google-item-content">
                      <div className="google-item-title-row">
                        <span className="google-item-title">
                          {highlightMatch(item.title, query)}
                        </span>
                        {item.badge && (
                          <span className="google-item-badge">{item.badge}</span>
                        )}
                      </div>
                      <span className="google-item-subtitle">
                        {highlightMatch(item.subtitle, query)}
                      </span>
                    </div>

                    {/* Trailing Jump Indicator */}
                    <div className="google-item-trailing">
                      {isSelected ? (
                        <span className="google-item-enter-hint">
                          Select <kbd>↵</kbd>
                        </span>
                      ) : (
                        <ArrowUpRight size={13} strokeWidth={1.8} color="var(--text-dim)" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Google-Style Dropdown Footer */}
          <div className="google-dropdown-footer">
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Building2 size={12} color="var(--accent-primary)" />
              Humora Universal Search
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>
                <kbd>↑</kbd> <kbd>↓</kbd> navigate
              </span>
              <span>
                <kbd>↵</kbd> select
              </span>
              <span>
                <kbd>esc</kbd> close
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
