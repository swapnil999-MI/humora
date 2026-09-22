import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/store';
import {
  fetchShifts,
  createShift,
  updateShift,
  deleteShift,
  fetchShiftRosters,
  assignShift,
  bulkAssignShift,
  fetchEmployees,
} from '../../store/hrmsSlice';
import { addToast } from '../../store/uiSlice';
import {
  Clock4,
  Plus,
  Search,
  Users,
  Moon,
  CalendarCheck,
  RotateCcw,
  Check,
  X,
  Layers,
  Filter,
  Briefcase,
} from 'lucide-react';
import { Shift, EmployeeShiftRoster } from '../../types';

export const ShiftManagementDesk: React.FC = () => {
  const dispatch = useAppDispatch();
  const { shifts: rawShifts, shiftRosters: rawShiftRosters, employees: rawEmployees, isLoadingShifts } = useAppSelector(
    (state) => state.hrms
  );

  const shifts = rawShifts || [];
  const shiftRosters = rawShiftRosters || [];
  const employees = rawEmployees || [];

  // Modal States
  const [isCreateShiftOpen, setIsCreateShiftOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [isAssignShiftOpen, setIsAssignShiftOpen] = useState(false);
  const [searchRoster, setSearchRoster] = useState('');
  const [activeTab, setActiveTab] = useState<'catalog' | 'roster'>('catalog');

  // Form states for Shift Modal
  const [shiftName, setShiftName] = useState('');
  const [shiftCode, setShiftCode] = useState('');
  const [startTime, setStartTime] = useState('09:00:00');
  const [endTime, setEndTime] = useState('18:00:00');
  const [graceMinutes, setGraceMinutes] = useState(15);
  const [halfDayThresholdHours, setHalfDayThresholdHours] = useState(4.0);
  const [isNightShift, setIsNightShift] = useState(false);
  const [shiftColor, setShiftColor] = useState('#f59e0b');

  // Form states for Roster Assign Modal
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    dispatch(fetchShifts());
    dispatch(fetchShiftRosters());
    dispatch(fetchEmployees(''));
  }, [dispatch]);

  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftName.trim() || !shiftCode.trim()) {
      dispatch(addToast({ type: 'error', message: 'Shift name and code are required' }));
      return;
    }

    const payload: Partial<Shift> = {
      name: shiftName,
      start_time: startTime.length === 5 ? `${startTime}:00` : startTime,
      end_time: endTime.length === 5 ? `${endTime}:00` : endTime,
      grace_minutes: Number(graceMinutes),
      half_day_hours: Number(halfDayThresholdHours),
      full_day_hours: 8.0,
      is_night_shift: isNightShift,
      night_shift_allowance: isNightShift ? 150.0 : 0.0,
    };

    try {
      if (editingShift) {
        await dispatch(updateShift({ id: editingShift.id, data: payload })).unwrap();
        dispatch(addToast({ type: 'success', message: 'Shift updated successfully' }));
      } else {
        await dispatch(createShift(payload)).unwrap();
        dispatch(addToast({ type: 'success', message: 'New corporate shift created' }));
      }
      setIsCreateShiftOpen(false);
      setEditingShift(null);
    } catch (err: any) {
      dispatch(addToast({ type: 'error', message: err || 'Failed to save shift' }));
    }
  };

  const handleDeleteShift = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this shift? Active employee assignments may be affected.')) return;
    try {
      await dispatch(deleteShift(id)).unwrap();
      dispatch(addToast({ type: 'info', message: 'Shift removed from catalog' }));
    } catch (err: any) {
      dispatch(addToast({ type: 'error', message: err || 'Failed to delete shift' }));
    }
  };

  const handleAssignRoster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShiftId || selectedEmpIds.length === 0) {
      dispatch(addToast({ type: 'error', message: 'Select a shift and at least one employee' }));
      return;
    }

    try {
      if (selectedEmpIds.length === 1) {
        await dispatch(
          assignShift({
            employee_id: selectedEmpIds[0],
            shift_id: selectedShiftId,
            effective_date: effectiveDate,
          })
        ).unwrap();
      } else {
        await dispatch(
          bulkAssignShift({
            employee_ids: selectedEmpIds,
            shift_id: selectedShiftId,
            effective_date: effectiveDate,
          })
        ).unwrap();
      }
      dispatch(addToast({ type: 'success', message: `Assigned shift to ${selectedEmpIds.length} employee(s)` }));
      setIsAssignShiftOpen(false);
      setSelectedEmpIds([]);
    } catch (err: any) {
      dispatch(addToast({ type: 'error', message: err || 'Failed to assign shift roster' }));
    }
  };

  const filteredRosters = shiftRosters.filter((r) => {
    const q = searchRoster.toLowerCase();
    return (
      (r.first_name || '').toLowerCase().includes(q) ||
      (r.last_name || '').toLowerCase().includes(q) ||
      (r.employee_code || '').toLowerCase().includes(q) ||
      (r.shift_name || '').toLowerCase().includes(q) ||
      (r.department_name || '').toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Desk Header & Subnav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Management Console &bull; Attendance Operations
            </span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '4px 0 0', color: 'var(--text-primary)' }}>
            Shift Catalog &amp; Employee Rostering
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Configure enterprise work schedules, grace periods, night shift allowances, and assign rotational rosters.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              display: 'flex',
              background: 'var(--surface-2)',
              borderRadius: '8px',
              padding: '3px',
              border: '1px solid var(--border-hairline)',
            }}
          >
            <button
              className={`btn-ghost ${activeTab === 'catalog' ? 'active' : ''}`}
              style={{
                fontSize: '12px',
                padding: '6px 14px',
                borderRadius: '6px',
                background: activeTab === 'catalog' ? 'var(--accent-subtle)' : 'transparent',
                color: activeTab === 'catalog' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                border: activeTab === 'catalog' ? '1px solid var(--accent-primary)' : '1px solid transparent',
                fontWeight: activeTab === 'catalog' ? 600 : 500,
              }}
              onClick={() => setActiveTab('catalog')}
            >
              Shift Catalog ({shifts.length})
            </button>
            <button
              className={`btn-ghost ${activeTab === 'roster' ? 'active' : ''}`}
              style={{
                fontSize: '12px',
                padding: '6px 14px',
                borderRadius: '6px',
                background: activeTab === 'roster' ? 'var(--accent-subtle)' : 'transparent',
                color: activeTab === 'roster' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                border: activeTab === 'roster' ? '1px solid var(--accent-primary)' : '1px solid transparent',
                fontWeight: activeTab === 'roster' ? 600 : 500,
              }}
              onClick={() => setActiveTab('roster')}
            >
              Employee Roster ({shiftRosters.length})
            </button>
          </div>

          <button
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}
            onClick={() => {
              if (activeTab === 'catalog') {
                setEditingShift(null);
                setShiftName('');
                setShiftCode('');
                setStartTime('09:00:00');
                setEndTime('18:00:00');
                setGraceMinutes(15);
                setHalfDayThresholdHours(4.0);
                setIsNightShift(false);
                setIsCreateShiftOpen(true);
              } else {
                setIsAssignShiftOpen(true);
              }
            }}
          >
            <Plus size={15} />
            <span>{activeTab === 'catalog' ? 'Create Shift' : 'Assign Shift'}</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Corporate Shifts Catalog */}
      {activeTab === 'catalog' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {shifts.map((s) => (
              <div
                key={s.id}
                className="glass-panel"
                style={{
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: '10px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px',
                  borderTop: '3px solid var(--accent-primary)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div>
                      <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {s.name}
                      </span>
                    </div>
                    {s.is_night_shift && (
                      <span
                        style={{
                          background: 'rgba(168, 85, 247, 0.15)',
                          color: '#c084fc',
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Moon size={12} />
                        Night Shift
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontFamily: 'monospace', color: '#818cf8', fontWeight: 600 }}>
                    <Clock4 size={16} />
                    <span>
                      {s.start_time ? s.start_time.slice(0, 5) : '09:00'} &ndash; {s.end_time ? s.end_time.slice(0, 5) : '18:00'}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    background: 'var(--surface-2)',
                    padding: '10px 12px',
                    borderRadius: '6px',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-dim)' }}>Grace Period: </span>
                    <strong style={{ color: 'var(--text-secondary)' }}>{s.grace_minutes}m</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)' }}>Half-Day Min: </span>
                    <strong style={{ color: 'var(--text-secondary)' }}>{s.half_day_hours}h</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-hairline)', paddingTop: '12px' }}>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '4px' }}
                    onClick={() => {
                      setEditingShift(s);
                      setShiftName(s.name);
                      setShiftCode(s.name.slice(0, 3).toUpperCase());
                      setStartTime(s.start_time);
                      setEndTime(s.end_time);
                      setGraceMinutes(s.grace_minutes);
                      setHalfDayThresholdHours(s.half_day_hours);
                      setIsNightShift(s.is_night_shift);
                      setIsCreateShiftOpen(true);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '4px', color: '#f87171' }}
                    onClick={() => handleDeleteShift(s.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Employee Shift Rostering Matrix */}
      {activeTab === 'roster' && (
        <div
          className="glass-panel"
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-hairline)',
            borderRadius: '12px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input-field"
                placeholder="Search roster by employee or shift..."
                style={{ paddingLeft: '32px', fontSize: '12px', height: '34px' }}
                value={searchRoster}
                onChange={(e) => setSearchRoster(e.target.value)}
              />
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Showing <strong>{filteredRosters.length}</strong> of {shiftRosters.length} employees
            </div>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--border-hairline)', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-hairline)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Employee</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Department</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Current Shift</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Schedule Hours</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Effective Date</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRosters.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No roster records found matching your filter.
                    </td>
                  </tr>
                ) : (
                  filteredRosters.map((r) => (
                    <tr key={r.employee_id} style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: 'var(--surface-3)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                            }}
                          >
                            {(r.first_name || 'E')[0]}{(r.last_name || 'M')[0]}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {r.first_name} {r.last_name}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {r.employee_code} &bull; {r.work_email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                        {r.department_name || 'Engineering'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            background: 'rgba(99, 102, 241, 0.12)',
                            color: '#a5b4fc',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 600,
                            fontSize: '11px',
                          }}
                        >
                          {r.shift_name || 'General Day Shift'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        {r.start_time ? `${r.start_time.slice(0, 5)} - ${r.end_time?.slice(0, 5)}` : '09:00 - 18:00'}
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                        {r.effective_date ? new Date(r.effective_date).toLocaleDateString() : 'Default'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          className="btn-ghost"
                          style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-hairline)' }}
                          onClick={() => {
                            setSelectedEmpIds([r.employee_id]);
                            setSelectedShiftId(r.shift_id || (shifts[0]?.id || ''));
                            setIsAssignShiftOpen(true);
                          }}
                        >
                          Reassign
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: Create / Edit Shift */}
      {isCreateShiftOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setIsCreateShiftOpen(false)}
        >
          <div
            className="glass-panel"
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border-hairline)',
              borderRadius: '12px',
              padding: '28px',
              width: '100%',
              maxWidth: '480px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 16px', color: 'var(--text-primary)' }}>
              {editingShift ? 'Edit Corporate Shift' : 'Create New Work Shift'}
            </h2>

            <form onSubmit={handleSaveShift} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Shift Title</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Standard Morning Shift"
                  value={shiftName}
                  onChange={(e) => setShiftName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Shift Code</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. SHIFT-MORN"
                  value={shiftCode}
                  onChange={(e) => setShiftCode(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Start Time</label>
                  <input
                    type="time"
                    className="input-field"
                    value={startTime.slice(0, 5)}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>End Time</label>
                  <input
                    type="time"
                    className="input-field"
                    value={endTime.slice(0, 5)}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Grace Period (Mins)</label>
                  <input
                    type="number"
                    className="input-field"
                    value={graceMinutes}
                    onChange={(e) => setGraceMinutes(Number(e.target.value))}
                    min={0}
                    max={60}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Half-Day Threshold (Hours)</label>
                  <input
                    type="number"
                    step="0.5"
                    className="input-field"
                    value={halfDayThresholdHours}
                    onChange={(e) => setHalfDayThresholdHours(Number(e.target.value))}
                    min={1}
                    max={12}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                <input
                  type="checkbox"
                  id="night_shift"
                  checked={isNightShift}
                  onChange={(e) => setIsNightShift(e.target.checked)}
                />
                <label htmlFor="night_shift" style={{ fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Crosses Midnight (Night Shift Policy)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ padding: '8px 16px' }}
                  onClick={() => setIsCreateShiftOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px' }}>
                  {editingShift ? 'Save Changes' : 'Create Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Bulk Assign Shift Roster */}
      {isAssignShiftOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setIsAssignShiftOpen(false)}
        >
          <div
            className="glass-panel"
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border-hairline)',
              borderRadius: '12px',
              padding: '28px',
              width: '100%',
              maxWidth: '520px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 16px', color: 'var(--text-primary)' }}>
              Assign Shift Roster
            </h2>

            <form onSubmit={handleAssignRoster} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Target Shift</label>
                <select
                  className="select-field"
                  value={selectedShiftId}
                  onChange={(e) => setSelectedShiftId(e.target.value)}
                  required
                >
                  <option value="">Select a shift...</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Effective Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Select Employee(s) ({selectedEmpIds.length} selected)
                </label>
                <div
                  style={{
                    maxHeight: '160px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-hairline)',
                    borderRadius: '6px',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    background: 'var(--surface-2)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px 6px', borderBottom: '1px solid var(--border-hairline)' }}>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ fontSize: '11px', padding: '2px 6px' }}
                      onClick={() => setSelectedEmpIds(employees.map((e) => e.id))}
                    >
                      Select All ({employees.length})
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ fontSize: '11px', padding: '2px 6px' }}
                      onClick={() => setSelectedEmpIds([])}
                    >
                      Clear
                    </button>
                  </div>
                  {employees.map((emp) => (
                    <label
                      key={emp.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        borderRadius: '4px',
                        background: selectedEmpIds.includes(emp.id) ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedEmpIds.includes(emp.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEmpIds((prev) => [...prev, emp.id]);
                          } else {
                            setSelectedEmpIds((prev) => prev.filter((id) => id !== emp.id));
                          }
                        }}
                      />
                      <span>
                        {emp.first_name} {emp.last_name} ({emp.employee_code})
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ padding: '8px 16px' }}
                  onClick={() => setIsAssignShiftOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px' }}>
                  Assign to Roster
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftManagementDesk;
