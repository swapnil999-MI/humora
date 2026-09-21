import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import { createIssue } from '../store/workSlice';
import { setCreateIssueOpen, addToast } from '../store/uiSlice';
import { X, Plus, Sparkles } from 'lucide-react';

export const CreateIssueModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isCreateIssueOpen } = useAppSelector((state) => state.ui);
  const { activeProject } = useAppSelector((state) => state.work);
  const { employees } = useAppSelector((state) => state.hrms);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [issueType, setIssueType] = useState('story');
  const [priority, setPriority] = useState('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [storyPoints, setStoryPoints] = useState('3');
  const [estimateHours, setEstimateHours] = useState('8');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isCreateIssueOpen || !activeProject) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await dispatch(
        createIssue({
          projectId: activeProject.id,
          title: title.trim(),
          description: description.trim() || undefined,
          issue_type: issueType,
          priority,
          assignee_id: assigneeId || undefined,
          story_points: storyPoints ? parseInt(storyPoints, 10) : undefined,
          original_estimate_seconds: estimateHours ? Math.round(parseFloat(estimateHours) * 3600) : 0,
        })
      ).unwrap();

      dispatch(addToast({ type: 'success', message: 'Issue created successfully!' }));
      dispatch(setCreateIssueOpen(false));
      setTitle('');
      setDescription('');
    } catch (err: any) {
      dispatch(addToast({ type: 'error', message: err || 'Failed to create issue' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => dispatch(setCreateIssueOpen(false))}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#818cf8',
                background: 'rgba(99, 102, 241, 0.2)',
                padding: '2px 8px',
                borderRadius: '4px',
              }}
            >
              {activeProject.key}
            </span>
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Create New Agile Issue</h2>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => dispatch(setCreateIssueOpen(false))}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">Issue Summary / Title</label>
            <input
              type="text"
              className="input-field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Build multi-tenant SSO provider"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="input-group">
              <label className="input-label">Issue Type</label>
              <select
                className="select-field"
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
              >
                <option value="story">Story</option>
                <option value="task">Task</option>
                <option value="bug">Bug</option>
                <option value="epic">Epic</option>
                <option value="subtask">Subtask</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Priority</label>
              <select
                className="select-field"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="lowest">Lowest</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="highest">Highest</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="input-group">
              <label className="input-label">Assignee (HRMS Employee)</label>
              <select
                className="select-field"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name} ({emp.employee_code})
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Story Points</label>
              <input
                type="number"
                min="0"
                max="100"
                className="input-field"
                value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value)}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Original Estimate (Hours)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              className="input-field"
              value={estimateHours}
              onChange={(e) => setEstimateHours(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Description</label>
            <textarea
              className="textarea-field"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed acceptance criteria and specifications..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => dispatch(setCreateIssueOpen(false))}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              <Plus size={14} />
              {isSubmitting ? 'Creating...' : 'Create Issue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
