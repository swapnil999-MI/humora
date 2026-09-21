import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import { setCreateProjectOpen, addToast } from '../store/uiSlice';
import { fetchProjects, setActiveProject } from '../store/workSlice';
import { api } from '../api/client';
import { X, Plus, FolderPlus } from 'lucide-react';

export const CreateProjectModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isCreateProjectOpen } = useAppSelector((state) => state.ui);
  const { employees } = useAppSelector((state) => state.hrms);

  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [projectType, setProjectType] = useState('scrum');
  const [leadId, setLeadId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isCreateProjectOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || !name.trim() || !leadId) return;

    setIsSubmitting(true);
    try {
      const project = await api.post('/work/projects', {
        key: key.trim().toUpperCase(),
        name: name.trim(),
        project_type: projectType,
        lead_id: leadId,
      });

      dispatch(addToast({ type: 'success', message: 'Project created successfully!' }));
      dispatch(fetchProjects());
      dispatch(setActiveProject(project));
      dispatch(setCreateProjectOpen(false));
      setKey('');
      setName('');
    } catch (err: any) {
      dispatch(addToast({ type: 'error', message: err.message || 'Failed to create project' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => dispatch(setCreateProjectOpen(false))}>
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
            <FolderPlus size={20} color="var(--accent-primary)" />
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Create New Agile Project</h2>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => dispatch(setCreateProjectOpen(false))}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
            <div className="input-group">
              <label className="input-label">Project Key (2-10 chars)</label>
              <input
                type="text"
                className="input-field"
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                placeholder="e.g. ENG"
                maxLength={10}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">Project Name</label>
              <input
                type="text"
                className="input-field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Engineering Core"
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="input-group">
              <label className="input-label">Methodology / Type</label>
              <select
                className="select-field"
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
              >
                <option value="scrum">Scrum (Sprints & Backlog)</option>
                <option value="kanban">Kanban (Continuous Flow)</option>
                <option value="service">Service Desk</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Project Lead (Employee)</label>
              <select
                className="select-field"
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                required
              >
                <option value="">Select Project Lead</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => dispatch(setCreateProjectOpen(false))}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              <Plus size={14} />
              {isSubmitting ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
