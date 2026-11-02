import { useState } from 'react';
import { PageHead } from '../../components/AppLayout';
import { Icon } from '../../components/Icon';
import { Button, Card, EmptyState, ErrorState, LoadingState, Select } from '../../components/ui';
import { api } from '../../lib/api';
import { formatDate, formatRelative } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

const LIMITS = [40, 80, 160];

export function AdminActivity() {
  const [limit, setLimit] = useState(80);
  const state = useAsync(() => api.admin.activity(limit), [limit]);

  if (state.loading) return <LoadingState rows={6} label="Loading activity log" />;
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;

  const events = state.data ?? [];

  return (
    <div className="stack gap-4 fade-in">
      <PageHead
        eyebrow="Administration"
        title="Activity log"
        description="Audit trail recorded by the backend for every meaningful action."
        actions={
          <>
            <Select aria-label="Entries to load" value={String(limit)} onChange={(event) => setLimit(Number(event.target.value))}>
              {LIMITS.map((value) => (
                <option key={value} value={value}>Last {value}</option>
              ))}
            </Select>
            <Button variant="secondary" size="sm" onClick={state.reload}>
              <Icon name="refresh" size={14} /> Refresh
            </Button>
          </>
        }
      />

      {events.length === 0 ? (
        <EmptyState icon="activity" title="No activity yet" description="Actions such as sign-ins and deployments appear here." />
      ) : (
        <Card>
          <div className="card-body">
            <div className="timeline">
              {events.map((event) => (
                <div key={event.id} className="timeline-item">
                  <span className="timeline-dot" />
                  <div className="stack gap-1" style={{ minWidth: 0 }}>
                    <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
                      <strong className="text-sm">{event.actor_name}</strong>
                      <span className="text-sm text-muted">{event.action}</span>
                      {event.target_type && <span className="badge">{event.target_type}</span>}
                    </div>
                    <span className="text-sm">{event.detail}</span>
                    <span className="text-xs text-dim" title={formatDate(event.created_at)}>
                      {formatRelative(event.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
