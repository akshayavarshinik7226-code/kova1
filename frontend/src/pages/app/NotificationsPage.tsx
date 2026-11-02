import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHead, SectionHead } from '../../components/AppLayout';
import { Icon } from '../../components/Icon';
import { Button, Card, EmptyState, ErrorState, LoadingState } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

export function NotificationsPage() {
  const { notify } = useToast();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const state = useAsync(() => api.notifications(unreadOnly), [unreadOnly]);

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await action();
      notify({ tone: 'success', message });
      state.reload();
    } catch (error) {
      notify({
        tone: 'danger',
        title: 'Action failed',
        message: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setBusy(false);
    }
  }

  const items = state.data ?? [];
  const unreadCount = items.filter((item) => !item.is_read).length;

  return (
    <div className="stack gap-4 fade-in">
      <PageHead
        eyebrow="Inbox"
        title="Notifications"
        description="Queue activity and account messages. Nothing here is simulated — each entry is written by the KOVA backend."
        actions={
          <div className="page-actions">
            <Button
              variant="secondary"
              size="sm"
              loading={busy}
              disabled={unreadCount === 0}
              onClick={() => run(() => api.readAllNotifications(), 'All notifications marked as read.')}
            >
              <Icon name="check" size={14} /> Mark all read
            </Button>
          </div>
        }
      />

      <div className="filter-tabs" role="tablist" aria-label="Notification filters">
        <button
          type="button"
          role="tab"
          aria-selected={!unreadOnly}
          className={`filter-tab${!unreadOnly ? ' active' : ''}`}
          onClick={() => setUnreadOnly(false)}
        >
          All
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={unreadOnly}
          className={`filter-tab${unreadOnly ? ' active' : ''}`}
          onClick={() => setUnreadOnly(true)}
        >
          Unread
        </button>
      </div>

      {state.loading && <LoadingState rows={3} label="Loading notifications" />}
      {state.error && !state.loading && <ErrorState message={state.error} onRetry={state.reload} />}

      {!state.loading && !state.error && items.length === 0 && (
        <EmptyState
          icon="bell"
          title={unreadOnly ? 'No unread notifications' : 'No notifications yet'}
          description="Notifications appear when a project is submitted or a deployment changes state."
          action={
            <Link className="btn btn-secondary btn-sm" to="/app/deployments/new">
              Start a deployment
            </Link>
          }
        />
      )}

      {!state.loading && !state.error && items.length > 0 && (
        <Card>
          <SectionHead title={`${items.length} ${items.length === 1 ? 'message' : 'messages'}`} subtitle={`${unreadCount} unread`} />
          <div className="stack">
            {items.map((item) => (
              <article key={item.id} className={`notif-item${item.is_read ? '' : ' notif-unread'}`}>
                <div className="row" style={{ justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div className="stack gap-1" style={{ minWidth: 0 }}>
                    <div className="row gap-2">
                      {!item.is_read && <span className="notif-dot" aria-label="Unread" />}
                      <strong className="text-sm">{item.title}</strong>
                    </div>
                    <p className="text-sm text-muted">{item.body}</p>
                    <div className="row gap-3 text-xs text-dim">
                      <span>{formatRelative(item.created_at)}</span>
                      <span className="mono">{item.type}</span>
                      {item.link && (
                        <Link className="side-link" to={item.link}>
                          Open
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="row gap-1">
                    {!item.is_read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => run(() => api.readNotification(item.id), 'Marked as read.')}
                      >
                        Read
                      </Button>
                    )}
                    <button
                      type="button"
                      className="btn btn-icon btn-ghost btn-sm"
                      aria-label="Delete notification"
                      disabled={busy}
                      onClick={() => run(() => api.deleteNotification(item.id), 'Notification deleted.')}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
