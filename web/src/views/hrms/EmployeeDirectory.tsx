import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { fetchEmployees, fetchOrgTree, enrollBiometricFace } from '../../store/hrmsSlice';
import { addToast } from '../../store/uiSlice';
import { OrgNode, Employee } from '../../types';
import {
  Search,
  Users,
  Network,
  Mail,
  Briefcase,
  User,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Kanban,
  ShieldCheck,
  Camera,
  Upload,
  X,
  Check,
  RefreshCw,
  Trash2,
} from 'lucide-react';

export const EmployeeDirectory: React.FC = () => {
  const dispatch = useAppDispatch();
  const { employees, orgTree, attendanceSummary } = useAppSelector((state) => state.hrms);
  const { kanbanBoard, backlog } = useAppSelector((state) => state.work);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'grid' | 'tree'>('grid');

  // Biometric Enrollment State
  const [enrollingEmp, setEnrollingEmp] = useState<Employee | null>(null);
  const [enrollImages, setEnrollImages] = useState<string[]>([]);
  const [isEnrolling, setIsEnrolling] = useState(false);

  useEffect(() => {
    dispatch(fetchEmployees(searchTerm));
    dispatch(fetchOrgTree());
  }, [dispatch, searchTerm]);

  // Cross-domain issue counts per employee
  const allIssues = [
    ...(kanbanBoard?.columns.flatMap((c) => c.issues) || []),
    ...(backlog?.backlog_issues || []),
    ...(backlog?.active_sprint?.issues || []),
  ];

  const getIssueCountForEmp = (empId: string) => {
    return allIssues.filter((i) => i.assignee_id === empId).length;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header Filter Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div style={{ position: 'relative', width: '380px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            className="input-field"
            style={{ paddingLeft: '40px' }}
            placeholder="Search by name, email, department, or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="workspace-switcher">
          <button
            className={`workspace-pill ${activeTab === 'grid' ? 'active' : ''}`}
            onClick={() => setActiveTab('grid')}
          >
            <Users size={14} />
            Workforce Directory ({employees.length})
          </button>
          <button
            className={`workspace-pill ${activeTab === 'tree' ? 'active' : ''}`}
            onClick={() => setActiveTab('tree')}
          >
            <Network size={14} />
            Interactive Org Canvas
          </button>
        </div>
      </div>

      {activeTab === 'grid' ? (
        /* Rich Employee Grid */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '20px',
          }}
        >
          {employees.map((emp) => {
            const assignedCount = getIssueCountForEmp(emp.id);
            const isUserOnline = attendanceSummary?.punched_in; // Current test user

            return (
              <div
                key={emp.id}
                className="glass-panel glass-panel-interactive"
                style={{
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                    <div style={{ position: 'relative' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--surface-4)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-primary)',
                          fontWeight: 600,
                          fontSize: '15px',
                          boxShadow: 'var(--shadow-sm)',
                        }}
                      >
                        {emp.first_name.charAt(0)}
                        {emp.last_name.charAt(0)}
                      </div>
                      <span
                        className={`status-dot ${isUserOnline ? 'active' : ''}`}
                        style={{
                          position: 'absolute',
                          bottom: '-2px',
                          right: '-2px',
                          border: '2px solid #111420',
                        }}
                      />
                    </div>

                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: 600 }}>
                        {emp.first_name} {emp.last_name}
                      </h3>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {emp.designation_title || 'Lead Architect'} &bull;{' '}
                        <span className="mono-tag" style={{ color: 'var(--accent-primary)' }}>
                          {emp.employee_code}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Profile Details */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      padding: '14px 0',
                      borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Mail size={13} color="var(--text-muted)" />
                      <span>{emp.work_email}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Briefcase size={13} color="var(--text-muted)" />
                      <span>{emp.department_name || 'Engineering & Product'}</span>
                    </div>
                    {emp.manager_name && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <User size={13} color="var(--text-muted)" />
                        <span>Reports to: {emp.manager_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Biometric Face ID Status & Enrollment Trigger */}
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '8px 12px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {emp.biometric_sample_count ? (
                        <>
                          <ShieldCheck size={14} color="#34d399" />
                          <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 600 }}>
                            Face Enrolled ({emp.biometric_sample_count} shot{emp.biometric_sample_count > 1 ? 's' : ''})
                          </span>
                        </>
                      ) : (
                        <>
                          <Camera size={14} color="#94a3b8" />
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>No Biometric Profile</span>
                        </>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setEnrollingEmp(emp);
                        setEnrollImages([]);
                      }}
                      style={{
                        background: 'rgba(99, 102, 241, 0.15)',
                        border: '1px solid rgba(129, 140, 248, 0.3)',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        color: '#c7d2fe',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {emp.biometric_sample_count ? 'Update Face' : 'Enroll Face'}
                    </button>
                  </div>
                </div>

                {/* Cross-Domain Agile Work & Status Badges */}
                <div
                  style={{
                    marginTop: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span className="badge badge-done">{emp.employment_type}</span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: 'rgba(99, 102, 241, 0.16)',
                        color: '#a5b4fc',
                        fontWeight: 600,
                      }}
                    >
                      {assignedCount} Assigned Tasks
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Interactive Hierarchical Org Chart Canvas */
        <div
          className="glass-panel"
          style={{
            padding: '36px',
            overflowX: 'auto',
            minHeight: '600px',
            background: 'radial-gradient(ellipse at top, rgba(99, 102, 241, 0.08) 0%, rgba(17, 20, 32, 0.95) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>
                Enterprise Reporting Hierarchy
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Multi-level management tree with direct report counters.
              </p>
            </div>
            <span className="badge badge-done">Live Hierarchy Synchronized</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {(orgTree || [])
              .filter((node) => Boolean(node && node.employee))
              .map((node) => (
                <OrgNodeCanvas key={node.employee.id} node={node} level={0} />
              ))}
          </div>
        </div>
      )}

      {/* Biometric Face Enrollment Modal */}
      {enrollingEmp && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#18181b',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              width: '500px',
              maxWidth: '92vw',
              overflow: 'hidden',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(99, 102, 241, 0.15)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(24, 24, 27, 0.9)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'rgba(99, 102, 241, 0.2)',
                    border: '1px solid rgba(129, 140, 248, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#818cf8',
                  }}
                >
                  <Camera size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                    Enroll Biometric Face Profile
                  </h3>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                    {enrollingEmp.first_name} {enrollingEmp.last_name} ({enrollingEmp.employee_code})
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setEnrollingEmp(null);
                  setEnrollImages([]);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '12px',
                  color: '#c7d2fe',
                  lineHeight: '1.5',
                }}
              >
                <strong>Multi-Shot Centroid Aggregation:</strong> Upload 1 to 3 clear front-facing photos. MobileFaceNet normalizes embeddings into a unified 128-dimensional centroid vector for high-accuracy verification.
              </div>

              {/* Upload Input Area */}
              <div
                style={{
                  border: '2px dashed rgba(255, 255, 255, 0.15)',
                  borderRadius: '12px',
                  padding: '24px',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <Upload size={24} color="#818cf8" />
                <div style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 500 }}>
                  Select 1 to 3 Face Photos
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Supports JPEG, PNG, WebP format (min 112x112 px)
                </div>

                <label
                  style={{
                    background: 'var(--accent-primary)',
                    color: '#ffffff',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginTop: '4px',
                  }}
                >
                  Browse Files
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      files.slice(0, 3 - enrollImages.length).forEach((file) => {
                        const reader = new FileReader();
                        reader.onload = () => {
                          setEnrollImages((prev) => [...prev, reader.result as string].slice(0, 3));
                        };
                        reader.readAsDataURL(file);
                      });
                    }}
                  />
                </label>
              </div>

              {/* Photos Previews */}
              {enrollImages.length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', marginBottom: '8px' }}>
                    Enrolled Samples ({enrollImages.length} / 3):
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {enrollImages.map((img, idx) => (
                      <div
                        key={idx}
                        style={{
                          position: 'relative',
                          width: '84px',
                          height: '84px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                        }}
                      >
                        <img src={img} alt={`Sample ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          type="button"
                          onClick={() => setEnrollImages((prev) => prev.filter((_, i) => i !== idx))}
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: 'rgba(0, 0, 0, 0.7)',
                            border: 'none',
                            color: '#f87171',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px',
                padding: '16px 20px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(24, 24, 27, 0.9)',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setEnrollingEmp(null);
                  setEnrollImages([]);
                }}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  color: '#94a3b8',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={enrollImages.length === 0 || isEnrolling}
                onClick={async () => {
                  if (!enrollingEmp || enrollImages.length === 0) return;
                  setIsEnrolling(true);
                  try {
                    await dispatch(enrollBiometricFace(enrollingEmp.id, enrollImages)).unwrap();
                    dispatch(
                      addToast({
                        type: 'success',
                        message: `Biometric face profile registered with ${enrollImages.length} sample(s)!`,
                      })
                    );
                    dispatch(fetchEmployees(searchTerm));
                    setEnrollingEmp(null);
                    setEnrollImages([]);
                  } catch (err: any) {
                    dispatch(
                      addToast({
                        type: 'error',
                        message: err?.message || 'Failed to register biometric profile.',
                      })
                    );
                  } finally {
                    setIsEnrolling(false);
                  }
                }}
                style={{
                  background: enrollImages.length === 0 ? '#4b5563' : 'var(--accent-primary)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 18px',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: enrollImages.length === 0 || isEnrolling ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isEnrolling ? (
                  <>
                    <RefreshCw size={14} className="spin" /> Computing Centroid Vector...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={15} /> Save Biometric Profile
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const OrgNodeCanvas: React.FC<{ node: OrgNode; level: number }> = ({ node, level }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  if (!node || !node.employee) return null;
  const hasReports = node.subordinates && node.subordinates.length > 0;

  return (
    <div style={{ marginLeft: `${level * 40}px`, position: 'relative' }}>
      {/* Node Card */}
      <div
        className="glass-panel glass-panel-interactive"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '14px',
          padding: '14px 20px',
          background: 'var(--surface-2)',
          borderLeft: level === 0 ? '3px solid var(--accent-primary)' : '2px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
          cursor: hasReports ? 'pointer' : 'default',
        }}
        onClick={() => hasReports && setIsExpanded(!isExpanded)}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-4)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-primary)',
            fontWeight: 600,
            fontSize: '13px',
          }}
        >
          {node.employee.first_name.charAt(0)}
        </div>

        <div>
          <div style={{ fontWeight: 600, fontSize: '14px' }}>
            {node.employee.first_name} {node.employee.last_name}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {node.employee.designation_title || 'Leader'} &bull; {node.employee.work_email}
          </div>
        </div>

        {hasReports && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px' }}>
            <span className="badge badge-in-progress">
              {node.subordinates.length} Direct Reports
            </span>
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        )}
      </div>

      {/* Child Nodes */}
      {hasReports && isExpanded && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginTop: '12px',
            paddingLeft: '16px',
            borderLeft: '1px dashed rgba(255, 255, 255, 0.15)',
          }}
        >
          {node.subordinates.map((child) => (
            <OrgNodeCanvas key={child.employee.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};
