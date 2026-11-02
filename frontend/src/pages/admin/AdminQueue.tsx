import { useState } from 'react';
import { PageHead } from '../../components/AppLayout';
import { Icon } from '../../components/Icon';
import { Button, Card, CardHeader, EmptyState, ErrorState, InfoBanner, LoadingState, StatusPill } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

export function AdminQueue() {
  const { notify } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const state = useAsync(() => api.admin.queue(), []);

  async function cancel(id: string) {
    setBusyId(id);
    try {
      await api.admin.cancelDeployment(id);
      notify({ tone: 'success', message: 'Removed from the queue.' });
      state.reload();
    } catch (error) {
      notify({
        tone: 'danger',
        title: 'Cancel failed',
        message: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setBusyId(null);
    }
  }

  if (state.loading) return <LoadingState rows={4} label="Loading queue" />;
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;
  if (!state.data) return <EmptyState icon="queue" title="Queue unavailable" description="The queue endpoint returned no data." />;

  const { items, provider, note } = state.data;

  return (
    <div className="stack gap-4 fade-in">
      <PageHead
        eyebrow="Administration"
        title="Deployment queue"
        description="Requests are processed in the order they arrive. No worker consumes this queue yet."
        actions={
          <Button variant="secondary" size="sm" onClick={state.reload}>
            <Icon name="refresh" size={14} /> Refresh
          </Button>
        }
      />

      <InfoBanner tone="warn" icon="alert" title={`${provider.label} · ${provider.configured ? 'configured' : 'not configured'}`}>
        {note}
      </InfoBanner>

      <Card>
        <CardHeader title={`${items.length} pending`} subtitle="Ordered by queue position." />
        <div className="card-body stack gap-2">
          {items.length === 0 ? (
            <p className="text-muted text-sm">Nothing is waiting. New submissions appear here immediately.</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="queue-item">
                <span className="queue-pos">#{item.queue_position ?? '–'}</span>
                <div className="stack gap-1" style={{ minWidth: 0, flex: 1 }}>
                  <span className="text-sm truncate">{item.project_name}</span>
                  <span className="text-xs text-dim">
                    {item.owner_name} · {item.source_label} · {formatRelative(item.created_at)}
                  </span>
                </div>
                <StatusPill status={item.status} compact />
                <Button variant="ghost" size="sm" loading={busyId === item.id} onClick={() => cancel(item.id)}>
                  Cancel
                </Button>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
