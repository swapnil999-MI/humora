import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/store';
import {
  toggleNotificationDrawer,
  setNotificationDrawerOpen,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  clearNotifications,
  navigateToPage,
  PageId,
} from '../store/uiSlice';
import {
  Bell,
  X,
  CheckCheck,
  Trash2,
  Clock,
  Briefcase,
  CheckCircle2,
  Calendar,
  Info,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export const NotificationDrawer: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isNotificationDrawerOpen, notifications } = useAppSelector((state) => state.ui);
  const [filterTab, setFilterTab] = useState<'all' | 'unread'>('all');

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isNotificationDrawerOpen) {
        dispatch(setNotificationDrawerOpen(false));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch, isNotificationDrawerOpen]);

  if (!isNotificationDrawerOpen) return null;

  const unreadCount = (notifications || []).filter((n) => !n.read).length;
  const filteredNotifications = (notifications || []).filter((n) => {
    if (filterTab === 'unread') return !n.read;
    return true;
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'work':
        return <Briefcase size={15} color="var(--accent-primary)" />;
      case 'approval':
        return <CheckCircle2 size={15} color="#10b981" />;
      case 'punch':
        return <Clock size={15} color="var(--accent-primary)" />;
      case 'leave':
        return <Calendar size={15} color="#f59e0b" />;
      default:
        return <Info size={15} color="var(--accent-primary)" />;
    }
  };

  const handleNotificationClick = (notifId: string, actionLink?: PageId) => {
    dispatch(markNotificationAsRead(notifId));
    if (actionLink) {
      dispatch(navigateToPage(actionLink));
      dispatch(setNotificationDrawerOpen(false));
    }
  };

  return (
    <div
      className="drawer-overlay"
      onClick={() => dispatch(setNotificationDrawerOpen(false))}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'fadeIn 180ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div
        className="notification-drawer"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '420px',
          maxWidth: '92vw',
          height: '100%',
          backgroundColor: 'var(--surface-1)',
          borderLeft: '1px solid var(--border-hairline)',
          boxShadow: 'var(--shadow-popover)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1001,
          animation: 'drawerSlideIn 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid var(--border-hairline)',
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bell size={16} color="var(--accent-primary)" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '1px 7px',
                      borderRadius: '999px',
                      background: 'var(--accent-primary)',
                      color: '#000000',
                    }}
                  >
                    {unreadCount} new
                  </span>
                )}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                System events, regularizations & work alerts
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ width: '28px', height: '28px', padding: 0 }}
              onClick={() => dispatch(setNotificationDrawerOpen(false))}
              title="Close drawer (Esc)"
            >
              <X size={15} color="var(--text-secondary)" />
            </button>
          </div>
        </div>

        {/* Tab & Actions Toolbar */}
        <div
          style={{
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-hairline)',
            background: 'var(--surface-1)',
          }}
        >
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className={`btn btn-sm ${filterTab === 'all' ? 'btn-primary' : 'btn-ghost'}`}
              style={{
                fontSize: '11.5px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
              }}
              onClick={() => setFilterTab('all')}
            >
              All ({(notifications || []).length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${filterTab === 'unread' ? 'btn-primary' : 'btn-ghost'}`}
              style={{
                fontSize: '11.5px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
              }}
              onClick={() => setFilterTab('unread')}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Action links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {unreadCount > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{
                  fontSize: '11px',
                  padding: '3px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: 'var(--accent-primary)',
                }}
                onClick={() => dispatch(markAllNotificationsAsRead())}
                title="Mark all notifications as read"
              >
                <CheckCheck size={13} />
                Mark all read
              </button>
            )}
            {(notifications || []).length > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{
                  fontSize: '11px',
                  padding: '3px 6px',
                  color: 'var(--text-muted)',
                }}
                onClick={() => dispatch(clearNotifications())}
                title="Clear all notifications"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Notifications Scrollable List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {filteredNotifications.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                textAlign: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-hairline)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '14px',
                }}
              >
                <Sparkles size={22} color="var(--accent-primary)" />
              </div>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '6px',
                }}
              >
                You're all caught up!
              </span>
              <span style={{ fontSize: '12px', maxWidth: '240px', lineHeight: 1.5 }}>
                {filterTab === 'unread'
                  ? 'There are no unread notifications.'
                  : 'No notification alerts or messages at this time.'}
              </span>
            </div>
          ) : (
            filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif.id, notif.actionLink)}
                style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  background: notif.read ? 'var(--surface-2)' : 'rgba(245, 158, 11, 0.04)',
                  border: notif.read
                    ? '1px solid var(--border-hairline)'
                    : '1px solid rgba(245, 158, 11, 0.28)',
                  cursor: notif.actionLink ? 'pointer' : 'default',
                  transition: 'all var(--transition-fast)',
                  position: 'relative',
                  display: 'flex',
                  gap: '12px',
                }}
                className="notification-item-card"
              >
                {/* Category Icon */}
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-3)',
                    border: '1px solid var(--border-hairline)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  {getNotificationIcon(notif.type)}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      marginBottom: '4px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: notif.read ? 600 : 700,
                        color: notif.read ? 'var(--text-primary)' : '#faf8f5',
                        lineHeight: 1.3,
                      }}
                    >
                      {notif.title}
                    </span>
                    {!notif.read && (
                      <span
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--accent-primary)',
                          boxShadow: '0 0 6px rgba(245, 158, 11, 0.8)',
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </div>

                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.45,
                      margin: '0 0 8px 0',
                    }}
                  >
                    {notif.message}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                    }}
                  >
                    <span style={{ color: 'var(--text-dim)' }}>{notif.timestamp}</span>

                    {notif.actionLink && (
                      <span
                        style={{
                          color: 'var(--accent-primary)',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px',
                        }}
                      >
                        View details
                        <ChevronRight size={12} />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-hairline)',
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: 'var(--text-dim)',
          }}
        >
          <span>Click anywhere outside or press Esc to close</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '11px', padding: '3px 10px' }}
            onClick={() => dispatch(setNotificationDrawerOpen(false))}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationDrawer;
