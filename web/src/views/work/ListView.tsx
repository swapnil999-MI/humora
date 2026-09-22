import React, { useState, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { setActiveIssue, transitionIssue, updateIssue } from '../../store/workSlice';
import { setCreateIssueOpen } from '../../store/uiSlice';
import { Issue } from '../../types';
import { StatusGlyph, PriorityGlyph } from '../../components/StatusGlyph';
import {
  Search,
  Plus,
  Bookmark,
  CheckSquare,
  AlertCircle,
  Clock,
  Filter,
  Layers,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

export const ListView: React.FC = () => {
  const dispatch = useAppDispatch();
  const { kanbanBoard, activeProject } = useAppSelector((state) => state.work);
  const { employees } = useAppSelector((state) => state.hrms);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Flatten all issues across columns
  const allIssues = useMemo(() => {
    if (!kanbanBoard?.columns) return [];
    return kanbanBoard.columns.flatMap((col) => col.issues);
  }, [kanbanBoard]);

  // Filter issues
  const filteredIssues = useMemo(() => {
    return allIssues.filter((issue) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesKey = issue.issue_key.toLowerCase().includes(q);
        const matchesTitle = issue.title.toLowerCase().includes(q);
        if (!matchesKey && !matchesTitle) return false;
      }
      if (statusFilter !== 'all' && issue.status_id !== statusFilter) {
        return false;
      }
      if (priorityFilter !== 'all' && issue.priority !== priorityFilter) {
        return false;
      }
      if (typeFilter !== 'all' && issue.issue_type !== typeFilter) {
        return false;
      }
      return true;
    });
  }, [allIssues, searchQuery, statusFilter, priorityFilter, typeFilter]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bug':
        return <AlertCircle size={14} color="var(--text-primary)" />;
      case 'epic':
        return <Sparkles size={14} color="var(--text-primary)" />;
      case 'story':
        return <Bookmark size={14} color="var(--text-primary)" />;
      case 'task':
      default:
        return <CheckSquare size={14} color="var(--text-primary)" />;
    }
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>, issue: Issue) => {
    e.stopPropagation();
    if (!activeProject) return;
    const targetStatusId = e.target.value;
    if (targetStatusId === issue.status_id) return;
    dispatch(
      transitionIssue({
        issueId: issue.id,
        targetStatusId,
        projectId: activeProject.id,
      })
    );
  };

  const handlePriorityChange = (e: React.ChangeEvent<HTMLSelectElement>, issue: Issue) => {
    e.stopPropagation();
    if (!activeProject) return;
    const newPriority = e.target.value;
    if (newPriority === issue.priority) return;
    dispatch(
      updateIssue({
        issueId: issue.id,
        projectId: activeProject.id,
        data: { priority: newPriority },
      })
    );
  };

  const handleAssigneeChange = (e: React.ChangeEvent<HTMLSelectElement>, issue: Issue) => {
    e.stopPropagation();
    if (!activeProject) return;
    const newAssigneeId = e.target.value || undefined;
    dispatch(
      updateIssue({
        issueId: issue.id,
        projectId: activeProject.id,
        data: { assignee_id: newAssigneeId },
      })
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px 28px', gap: '16px' }}>
      {/* Top Filter & Action Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '320px' }}>
          {/* Quick Search */}
          <div style={{ position: 'relative', flex: 1, maxWidth: '340px' }}>
            <Search
              size={14}
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              className="input-field"
              style={{ paddingLeft: '32px', height: '34px', fontSize: '12px' }}
              placeholder="Filter by key or title... (Cmd+K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <select
            className="select-field"
            style={{ width: 'auto', height: '34px', fontSize: '12px', padding: '0 28px 0 10px' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            {kanbanBoard?.columns.map((c) => (
              <option key={c.status_id} value={c.status_id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            className="select-field"
            style={{ width: 'auto', height: '34px', fontSize: '12px', padding: '0 28px 0 10px' }}
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="all">All Priorities</option>
            <option value="highest">Highest</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="lowest">Lowest</option>
          </select>

          {/* Type Filter */}
          <select
            className="select-field"
            style={{ width: 'auto', height: '34px', fontSize: '12px', padding: '0 28px 0 10px' }}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="task">Task</option>
            <option value="story">Story</option>
            <option value="bug">Bug</option>
            <option value="epic">Epic</option>
          </select>
        </div>

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Showing <strong>{filteredIssues.length}</strong> of <strong>{allIssues.length}</strong> issues
          </span>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => dispatch(setCreateIssueOpen(true))}
          >
            <Plus size={14} />
            Create Issue
          </button>
        </div>
      </div>

      {/* High-Density Table Canvas */}
      <div
        style={{
          flex: 1,
          background: 'var(--surface-1)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-hairline)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ overflowX: 'auto', flex: 1 }}>
          <table className="linear-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr
                style={{
                  background: 'var(--surface-2)',
                  borderBottom: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  userSelect: 'none',
                  height: '36px',
                }}
              >
                <th style={{ width: '40px', padding: '0 12px', textAlign: 'center' }}>Type</th>
                <th style={{ width: '100px', padding: '0 12px' }}>Key</th>
                <th style={{ minWidth: '280px', padding: '0 12px' }}>Title</th>
                <th style={{ width: '130px', padding: '0 12px' }}>Status</th>
                <th style={{ width: '120px', padding: '0 12px' }}>Priority</th>
                <th style={{ width: '160px', padding: '0 12px' }}>Assignee</th>
                <th style={{ width: '80px', padding: '0 12px', textAlign: 'center' }}>Points</th>
                <th style={{ width: '90px', padding: '0 12px', textAlign: 'right' }}>Logged</th>
              </tr>
            </thead>
            <tbody>
              {filteredIssues.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                    <Layers size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)' }}>
                      No issues found
                    </div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>
                      Try adjusting your filters or create a new issue for this project.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredIssues.map((issue) => {
                  const currentColumn = kanbanBoard?.columns.find((c) => c.status_id === issue.status_id);

                  return (
                    <tr
                      key={issue.id}
                      onClick={() => dispatch(setActiveIssue(issue))}
                      className="linear-table-row"
                      style={{
                        height: '38px',
                        borderBottom: '1px solid var(--border-hairline)',
                        cursor: 'pointer',
                        transition: 'background var(--transition-fast)',
                        fontSize: '13px',
                      }}
                    >
                      {/* Type Icon */}
                      <td style={{ padding: '0 12px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          {getTypeIcon(issue.issue_type)}
                        </div>
                      </td>

                      {/* Issue Key */}
                      <td style={{ padding: '0 12px', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: 'var(--accent-primary)' }}>
                        {issue.issue_key}
                      </td>

                      {/* Title */}
                      <td style={{ padding: '0 12px', maxWidth: '380px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }} title={issue.title}>
                          {issue.title}
                        </span>
                      </td>

                      {/* Status Dropdown with Circular Glyph */}
                      <td style={{ padding: '0 8px' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <StatusGlyph category={currentColumn?.category || currentColumn?.name} size={14} />
                          <select
                            className="table-cell-select"
                            value={issue.status_id}
                            onChange={(e) => handleStatusChange(e, issue)}
                            style={{
                              width: '100%',
                            }}
                          >
                            {kanbanBoard?.columns.map((c) => (
                              <option key={c.status_id} value={c.status_id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* Priority Dropdown with Linear Bar Glyph */}
                      <td style={{ padding: '0 8px' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <PriorityGlyph priority={issue.priority} size={14} />
                          <select
                            className="table-cell-select"
                            value={issue.priority}
                            onChange={(e) => handlePriorityChange(e, issue)}
                            style={{
                              textTransform: 'capitalize',
                            }}
                          >
                            <option value="highest">Urgent</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                            <option value="lowest">None</option>
                          </select>
                        </div>
                      </td>

                      {/* Assignee Dropdown */}
                      <td style={{ padding: '0 8px' }} onClick={(e) => e.stopPropagation()}>
                        <select
                          className="table-cell-select"
                          value={issue.assignee_id || ''}
                          onChange={(e) => handleAssigneeChange(e, issue)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: issue.assignee_id ? 'var(--text-primary)' : 'var(--text-dim)',
                            fontSize: '12px',
                            cursor: 'pointer',
                            width: '100%',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          <option value="">Unassigned</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.first_name} {emp.last_name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Story Points */}
                      <td style={{ padding: '0 12px', textAlign: 'center' }}>
                        {issue.story_points ? (
                          <span
                            style={{
                              background: 'rgba(255, 255, 255, 0.06)',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {issue.story_points}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>-</span>
                        )}
                      </td>

                      {/* Logged / Estimate */}
                      <td style={{ padding: '0 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {issue.remaining_estimate_seconds ? `${(issue.remaining_estimate_seconds / 3600).toFixed(1)}h rem` : '0h'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
