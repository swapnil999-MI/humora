import React, { useEffect, useState, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { fetchTeamRadar } from '../../store/hrmsSlice';
import {
  Users,
  Search,
  CheckCircle2,
  Coffee,
  Calendar,
  AlertCircle,
  Clock,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { TeamPresenceRadarMember } from '../../types';

export const TeamRadarDesk: React.FC = () => {
  const dispatch = useAppDispatch();
  const { teamRadar: rawTeamRadar } = useAppSelector((state) => state.hrms);
  const teamRadar = rawTeamRadar || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [presenceFilter, setPresenceFilter] = useState<'all' | 'working' | 'on_break' | 'on_leave' | 'absent'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    dispatch(fetchTeamRadar());
  }, [dispatch]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await dispatch(fetchTeamRadar());
    setIsRefreshing(false);
  };

  const stats = useMemo(() => {
    const total = teamRadar.length;
    const working = teamRadar.filter((m) => m.presence_status === 'working').length;
    const onBreak = teamRadar.filter((m) => m.presence_status === 'on_break').length;
    const onLeave = teamRadar.filter((m) => m.presence_status === 'on_leave').length;
    const absent = teamRadar.filter((m) => m.presence_status === 'absent' || m.presence_status === 'not_punched').length;
    return { total, working, onBreak, onLeave, absent };
  }, [teamRadar]);

  const filteredMembers = useMemo(() => {
    return teamRadar.filter((m) => {
      const q = searchQuery.toLowerCase();
      const matchesQuery =
        (m.first_name || '').toLowerCase().includes(q) ||
        (m.last_name || '').toLowerCase().includes(q) ||
        (m.employee_code || '').toLowerCase().includes(q) ||
        (m.department_name || '').toLowerCase().includes(q) ||
        (m.work_email || '').toLowerCase().includes(q);

      if (!matchesQuery) return false;

      if (presenceFilter === 'working') return m.presence_status === 'working';
      if (presenceFilter === 'on_break') return m.presence_status === 'on_break';
      if (presenceFilter === 'on_leave') return m.presence_status === 'on_leave';
      if (presenceFilter === 'absent') return m.presence_status === 'absent' || m.presence_status === 'not_punched';

      return true;
    });
  }, [teamRadar, searchQuery, presenceFilter]);

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Management Console &bull; Live Operations
            </span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '4px 0 0', color: 'var(--text-primary)' }}>
            Live Team Presence Radar
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Real-time workforce availability, active shift punches, break tracking, and absence telemetry.
          </p>
        </div>

        <button
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
          <span>Refresh Radar</span>
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
        <div className="glass-panel" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-hairline)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Workforce</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>{stats.total}</div>
        </div>

        <div className="glass-panel" style={{ background: 'var(--surface-1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#34d399', textTransform: 'uppercase', fontWeight: 600 }}>Working Now</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#34d399', marginTop: '4px' }}>{stats.working}</div>
        </div>

        <div className="glass-panel" style={{ background: 'var(--surface-1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#fbbf24', textTransform: 'uppercase', fontWeight: 600 }}>On Break</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#fbbf24', marginTop: '4px' }}>{stats.onBreak}</div>
        </div>

        <div className="glass-panel" style={{ background: 'var(--surface-1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#60a5fa', textTransform: 'uppercase', fontWeight: 600 }}>On Leave</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#60a5fa', marginTop: '4px' }}>{stats.onLeave}</div>
        </div>

        <div className="glass-panel" style={{ background: 'var(--surface-1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: '#f87171', textTransform: 'uppercase', fontWeight: 600 }}>Not Punched / Out</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: '#f87171', marginTop: '4px' }}>{stats.absent}</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        className="glass-panel"
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border-hairline)',
          borderRadius: '10px',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`btn-ghost ${presenceFilter === 'all' ? 'active' : ''}`}
            style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '6px', background: presenceFilter === 'all' ? 'var(--surface-3)' : 'transparent' }}
            onClick={() => setPresenceFilter('all')}
          >
            All ({stats.total})
          </button>
          <button
            className={`btn-ghost ${presenceFilter === 'working' ? 'active' : ''}`}
            style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '6px', color: '#34d399', background: presenceFilter === 'working' ? 'rgba(16, 185, 129, 0.15)' : 'transparent' }}
            onClick={() => setPresenceFilter('working')}
          >
            Working ({stats.working})
          </button>
          <button
            className={`btn-ghost ${presenceFilter === 'on_break' ? 'active' : ''}`}
            style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '6px', color: '#fbbf24', background: presenceFilter === 'on_break' ? 'rgba(245, 158, 11, 0.15)' : 'transparent' }}
            onClick={() => setPresenceFilter('on_break')}
          >
            On Break ({stats.onBreak})
          </button>
          <button
            className={`btn-ghost ${presenceFilter === 'on_leave' ? 'active' : ''}`}
            style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '6px', color: '#60a5fa', background: presenceFilter === 'on_leave' ? 'rgba(59, 130, 246, 0.15)' : 'transparent' }}
            onClick={() => setPresenceFilter('on_leave')}
          >
            On Leave ({stats.onLeave})
          </button>
          <button
            className={`btn-ghost ${presenceFilter === 'absent' ? 'active' : ''}`}
            style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '6px', color: '#f87171', background: presenceFilter === 'absent' ? 'rgba(239, 68, 68, 0.15)' : 'transparent' }}
            onClick={() => setPresenceFilter('absent')}
          >
            Out / Absent ({stats.absent})
          </button>
        </div>

        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-field"
            placeholder="Search team members..."
            style={{ paddingLeft: '32px', fontSize: '12px', height: '34px' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Member Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '16px' }}>
        {filteredMembers.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No team members found matching current filter.
          </div>
        ) : (
          filteredMembers.map((member) => (
            <div
              key={member.employee_id}
              className="glass-panel"
              style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--border-hairline)',
                borderRadius: '10px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ position: 'relative' }}>
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt={member.first_name}
                      style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        background: 'var(--surface-3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {(member.first_name || 'E')[0]}{(member.last_name || 'M')[0]}
                    </div>
                  )}
                  <span
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: '11px',
                      height: '11px',
                      borderRadius: '50%',
                      border: '2px solid var(--surface-1)',
                      background:
                        member.presence_status === 'working'
                          ? 'var(--accent-primary)'
                          : member.presence_status === 'on_break'
                          ? 'var(--accent-amber)'
                          : member.presence_status === 'on_leave'
                          ? 'var(--text-muted)'
                          : '#ef4444',
                    }}
                  />
                </div>

                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                    {member.first_name} {member.last_name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {member.department_name || 'Engineering'} &bull; {member.employee_code}
                  </div>
                </div>
              </div>

              <div
                style={{
                  background: 'var(--surface-2)',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                  <Clock size={13} />
                  <span>Shift: {member.shift_name || 'General Day Shift'}</span>
                </div>

                <span
                  style={{
                    background:
                      member.presence_status === 'working'
                        ? 'rgba(16, 185, 129, 0.15)'
                        : member.presence_status === 'on_break'
                        ? 'rgba(245, 158, 11, 0.15)'
                        : member.presence_status === 'on_leave'
                        ? 'rgba(59, 130, 246, 0.15)'
                        : 'rgba(239, 68, 68, 0.15)',
                    color:
                      member.presence_status === 'working'
                        ? '#34d399'
                        : member.presence_status === 'on_break'
                        ? '#fbbf24'
                        : member.presence_status === 'on_leave'
                        ? '#60a5fa'
                        : '#f87171',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                  }}
                >
                  {member.presence_status.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TeamRadarDesk;
