import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/store';
import {
  fetchKanbanBoard,
  transitionIssue,
  setActiveIssue,
  createIssue,
} from '../../store/workSlice';
import { addToast } from '../../store/uiSlice';
import { KanbanColumn, Issue } from '../../types';
import { StatusGlyph, PriorityGlyph } from '../../components/StatusGlyph';
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragEndEvent,
  closestCenter,
} from '@dnd-kit/core';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Zap,
  Layers,
  ArrowRight,
  Filter,
  Search,
  Bookmark,
  Bug,
  CheckSquare,
  Sparkles,
} from 'lucide-react';

export const KanbanBoard: React.FC = () => {
  const dispatch = useAppDispatch();
  const { activeProject, kanbanBoard } = useAppSelector((state) => state.work);
  const { attendanceSummary } = useAppSelector((state) => state.hrms);

  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    if (activeProject?.id) {
      dispatch(fetchKanbanBoard(activeProject.id));
    }
  }, [dispatch, activeProject?.id]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !activeProject) return;

    const issueId = active.id as string;
    const targetStatusId = over.id as string;

    const currentColumn = kanbanBoard?.columns.find((col) =>
      col.issues.some((i) => i.id === issueId)
    );

    if (currentColumn && currentColumn.status_id === targetStatusId) {
      return;
    }

    dispatch(
      transitionIssue({
        issueId,
        targetStatusId,
        projectId: activeProject.id,
      })
    );
  };

  if (!activeProject) {
    return (
      <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-muted)' }}>
        Please select or create an agile project to view the Kanban board.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Linear-Grade Filter & Control Bar */}
      <div
        style={{
          background: 'var(--surface-3)',
          border: '1px solid var(--border-hairline)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
          {/* Quick Search */}
          <div style={{ position: 'relative', width: '260px' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              className="input-field"
              style={{ paddingLeft: '34px', paddingBottom: '6px', paddingTop: '6px', fontSize: '12px' }}
              placeholder="Filter issues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Priority Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>PRIORITY:</span>
            {['all', 'highest', 'high', 'medium', 'low'].map((p) => (
              <button
                key={p}
                className="btn btn-sm"
                style={{
                  padding: '3px 8px',
                  fontSize: '11px',
                  background: priorityFilter === p ? 'var(--accent-subtle)' : 'var(--surface-2)',
                  color: priorityFilter === p ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  border: priorityFilter === p ? '1px solid var(--accent-primary)' : '1px solid var(--border-hairline)',
                  fontWeight: priorityFilter === p ? 600 : 500,
                }}
                onClick={() => setPriorityFilter(p)}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          {/* Type Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>TYPE:</span>
            {['all', 'story', 'task', 'bug'].map((t) => (
              <button
                key={t}
                className="btn btn-sm"
                style={{
                  padding: '3px 8px',
                  fontSize: '11px',
                  background: typeFilter === t ? 'var(--accent-subtle)' : 'var(--surface-2)',
                  color: typeFilter === t ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  border: typeFilter === t ? '1px solid var(--accent-primary)' : '1px solid var(--border-hairline)',
                  fontWeight: typeFilter === t ? 600 : 500,
                }}
                onClick={() => setTypeFilter(t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Project Key Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="mono-tag" style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>
            [{activeProject.key}]
          </span>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>{activeProject.name}</span>
        </div>
      </div>

      {/* 2. Drag and Drop Kanban Board */}
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="kanban-board">
          {kanbanBoard?.columns.map((column) => {
            // Apply client-side filters
            const filteredIssues = column.issues.filter((iss) => {
              const matchesSearch =
                iss.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                iss.issue_key.toLowerCase().includes(searchQuery.toLowerCase());
              const matchesPriority =
                priorityFilter === 'all' || iss.priority.toLowerCase() === priorityFilter;
              const matchesType =
                typeFilter === 'all' || iss.issue_type.toLowerCase() === typeFilter;
              return matchesSearch && matchesPriority && matchesType;
            });

            return (
              <KanbanColumnComponent
                key={column.status_id}
                column={{ ...column, issues: filteredIssues }}
                isOnline={!!attendanceSummary?.punched_in}
                projectId={activeProject.id}
              />
            );
          })}
        </div>
      </DndContext>
    </div>
  );
};

interface ColumnProps {
  column: KanbanColumn;
  isOnline: boolean;
  projectId: string;
}

const KanbanColumnComponent: React.FC<ColumnProps> = ({ column, isOnline, projectId }) => {
  const dispatch = useAppDispatch();
  const { setNodeRef, isOver } = useDroppable({
    id: column.status_id,
  });

  const [isAdding, setIsAdding] = useState(false);
  const [inlineTitle, setInlineTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleInlineCreate = async () => {
    if (!inlineTitle.trim() || !projectId) return;
    setIsCreating(true);
    try {
      await dispatch(
        createIssue({
          projectId,
          title: inlineTitle.trim(),
          issue_type: 'task',
          priority: 'medium',
        })
      );
      dispatch(fetchKanbanBoard(projectId));
      dispatch(addToast({ type: 'success', message: 'Task created successfully' }));
      setInlineTitle('');
      setIsAdding(false);
    } catch (err: any) {
      dispatch(addToast({ type: 'error', message: err || 'Failed to create task' }));
    } finally {
      setIsCreating(false);
    }
  };

  const totalPoints = column.issues.reduce((sum, iss) => sum + (iss.story_points || 0), 0);
  const wipLimit = 6; // Default WIP limit guideline
  const isOverWip = column.category === 'in_progress' && column.issues.length > wipLimit;

  return (
    <div
      ref={setNodeRef}
      className="kanban-column"
      style={{
        borderColor: isOver
          ? 'var(--accent-primary)'
          : isOverWip
          ? 'var(--border-strong)'
          : 'var(--border-hairline)',
        background: isOver
          ? 'var(--surface-hover)'
          : 'var(--surface-2)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      {/* Column Header */}
      <div className="kanban-column-header" style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-hairline)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <StatusGlyph category={column.category || column.name} size={14} />
          <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>{column.name}</span>
          <span
            style={{
              fontSize: '11px',
              padding: '1px 6px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--surface-hover)',
              color: 'var(--text-secondary)',
              fontWeight: 500,
            }}
          >
            {column.issues.length}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {totalPoints > 0 && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
              {totalPoints} pts
            </span>
          )}
        </div>
      </div>

      {/* Column Cards & Inline Quick Task Creator */}
      <div className="kanban-cards-container" style={{ padding: '8px', gap: '8px', display: 'flex', flexDirection: 'column' }}>
        {column.issues.map((issue) => (
          <KanbanCardComponent key={issue.id} issue={issue} isOnline={isOnline} />
        ))}

        {isAdding ? (
          <div
            style={{
              background: 'var(--surface-3)',
              border: '1px solid var(--accent-primary)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <textarea
              autoFocus
              className="textarea-field"
              placeholder="What needs to be done? (Enter to add)"
              value={inlineTitle}
              onChange={(e) => setInlineTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleInlineCreate();
                } else if (e.key === 'Escape') {
                  setIsAdding(false);
                }
              }}
              style={{
                height: '46px',
                padding: '6px 8px',
                fontSize: '12px',
                resize: 'none',
                background: 'var(--surface-1)',
                border: '1px solid var(--border-subtle)',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                <kbd className="cmd-k-kbd">↵</kbd> save • <kbd className="cmd-k-kbd">Esc</kbd>
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}
                  onClick={() => setIsAdding(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ height: '24px', padding: '0 10px', fontSize: '11px' }}
                  onClick={handleInlineCreate}
                  disabled={isCreating || !inlineTitle.trim()}
                >
                  {isCreating ? '...' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{
              width: '100%',
              justifyContent: 'flex-start',
              padding: '6px 10px',
              fontSize: '11.5px',
              color: 'var(--text-muted)',
              borderRadius: 'var(--radius-sm)',
              gap: '6px',
            }}
            onClick={() => setIsAdding(true)}
          >
            <Plus size={13} strokeWidth={2} />
            Add task
          </button>
        )}
      </div>
    </div>
  );
};

const KanbanCardComponent: React.FC<{ issue: Issue; isOnline: boolean }> = ({ issue, isOnline }) => {
  const dispatch = useAppDispatch();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: issue.id,
  });

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 99 : 1,
    background: 'var(--surface-3)',
    border: '1px solid var(--border-hairline)',
    borderRadius: 'var(--radius-sm)',
    boxShadow: 'var(--shadow-sm)',
  };

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'bug':
        return <Bug size={13} color="var(--text-primary)" />;
      case 'epic':
        return <Sparkles size={13} color="var(--text-primary)" />;
      case 'story':
        return <Bookmark size={13} color="var(--text-primary)" />;
      default:
        return <CheckSquare size={13} color="var(--text-primary)" />;
    }
  };

  const progressPercent = Math.min(
    100,
    Math.max(
      0,
      100 - (issue.remaining_estimate_seconds / (issue.original_estimate_seconds || 1)) * 100
    )
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="kanban-card"
      onClick={() => dispatch(setActiveIssue(issue))}
    >
      {/* Key & Priority Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {getIssueIcon(issue.issue_type)}
          <span
            className="mono-tag"
            style={{
              fontWeight: 600,
              fontSize: '11px',
              color: 'var(--accent-primary)',
            }}
          >
            {issue.issue_key}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <PriorityGlyph priority={issue.priority} size={14} />
        </div>
      </div>

      {/* Title */}
      <div style={{ fontWeight: 500, fontSize: '12px', lineHeight: 1.4, marginBottom: '8px', color: 'var(--text-primary)' }}>
        {issue.title}
      </div>

      {/* Mini Estimate Progress Bar */}
      {issue.original_estimate_seconds > 0 && (
        <div
          style={{
            height: '2px',
            borderRadius: '9999px',
            background: 'var(--border-subtle)',
            marginBottom: '8px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPercent}%`,
              background: 'var(--accent-primary)',
            }}
          />
        </div>
      )}

      {/* Footer Meta */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: 'var(--text-muted)',
          paddingTop: '8px',
          borderTop: '1px solid var(--border-hairline)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {issue.story_points !== undefined && issue.story_points !== null && (
            <span
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: 'var(--accent-subtle)',
                color: 'var(--accent-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '10px',
              }}
            >
              {issue.story_points}
            </span>
          )}
          {issue.remaining_estimate_seconds > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Clock size={11} />
              {(issue.remaining_estimate_seconds / 3600).toFixed(1)}h left
            </span>
          )}
        </div>

        {/* Assignee Avatar with Attendance Pulse Dot */}
        <div style={{ position: 'relative' }}>
          <div
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: 'var(--surface-4)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              fontSize: '10px',
              fontWeight: 500,
            }}
            title={`Assignee: ${issue.assignee_name || 'Unassigned'}`}
          >
            {issue.assignee_name?.charAt(0) || '?'}
          </div>
          {issue.assignee_id && (
            <span
              className={`status-dot ${isOnline ? 'active' : ''}`}
              style={{
                position: 'absolute',
                bottom: '-2px',
                right: '-2px',
                width: '6px',
                height: '6px',
                border: '1px solid var(--surface-1)',
              }}
              title={isOnline ? 'Currently Checked In' : 'Away / Checked Out'}
            />
          )}
        </div>
      </div>
    </div>
  );
};
