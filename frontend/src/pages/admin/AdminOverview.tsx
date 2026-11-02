import { Link } from 'react-router-dom';
import { PageHead, SectionHead } from '../../components/AppLayout';
import { Icon } from '../../components/Icon';
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  Stat,
  StatusPill,
} from '../../components/ui';
import { api } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

export function AdminOverview() {
  const state = useAsync(() => api.admin.overview(), []);

  if (state.loading) return <LoadingState rows={6} label="Loading platform statistics" />;
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;
  if (!state.data) return <EmptyState icon="chart" title="No statistics" description="The overview endpoint returned no data." />;

  const data = state.data;
  const totals = data.totals;
  const value = (key: string) => totals[key] ?? 0;

  return (
    <div className="stack gap-5 fade-in">
      <PageHead
        eyebrow="Administration"
        title="Platform overview"
        description="Live counters read from the KOVA database — nothing here is simulated."
        actions={
          <Link className="btn btn-secondary btn-sm" to="/admin/system">
            <Icon name="cpu" size={14} /> System status
          </Link>
        }
      />

      <div className="stat-grid">
        <Stat label="Students" value={value('students')} foot="Registered accounts" icon="users" />
        <Stat label="Projects" value={value('projects')} foot={`${value('active_projects')} active`} icon="box" />
        <Stat label="Deployments" value={value('deployments')} foot={`${value('ready')} ready`} icon="rocket" />
        <Stat label="In queue" value={value('queued')} foot={`${value('failed')} failed`} icon="queue" />
      </div>

      {!data.provider.configured && (
        <InfoBanner tone="warn" icon="alert" title={`${data.provider.label} · not connected`}>
          Deployments are validated and queued, but no builds run and no preview URLs are issued until the provider
          integration ships. {data.provider.blocked_reason ?? ''}
        </InfoBanner>
      )}

      <div className="grid-2">
        <Card>
          <CardHeader
            title="Deployment queue"
            subtitle={`${data.queue.length} request${data.queue.length === 1 ? '' : 's'} waiting`}
            action={<Link className="btn btn-ghost btn-sm" to="/admin/queue">Open queue</Link>}
          />
          <div className="card-body stack gap-2">
            {data.queue.length === 0 ? (
              <p className="text-muted text-sm">The queue is empty. New submissions appear here immediately.</p>
            ) : (
              data.queue.slice(0, 5).map((item) => (
                <div key={item.id} className="queue-item">
                  <span className="queue-pos">#{item.queue_position ?? '–'}</span>
                  <div className="stack gap-1" style={{ minWidth: 0 }}>
                    <span className="text-sm truncate">{item.project_name}</span>
                    <span className="text-xs text-dim">{item.owner_name} · {formatRelative(item.created_at)}</span>
                  </div>
                  <StatusPill status={item.status} compact />
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Recent activity"
            subtitle="Audit trail written by the backend."
            action={<Link className="btn btn-ghost btn-sm" to="/admin/activity">All activity</Link>}
          />
          <div className="card-body">
            {data.recent_activity.length === 0 ? (
              <p className="text-muted text-sm">No activity recorded yet.</p>
            ) : (
              <div className="timeline">
                {data.recent_activity.slice(0, 6).map((event) => (
                  <div key={event.id} className="timeline-item">
                    <span className="timeline-dot" />
                    <div className="stack gap-1">
                      <span className="text-sm">
                        <strong>{event.actor_name}</strong> {event.action}
                      </span>
                      <span className="text-xs text-dim">{event.detail} · {formatRelative(event.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <SectionHead title="Recent deployments" subtitle="Newest queue requests across every student." />
        <div className="table-wrap">
          {data.recent_deployments.length === 0 ? (
            <div className="card-body">
              <p className="text-muted text-sm">No deployments have been requested yet.</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Project</th>
                  <th scope="col">Student</th>
                  <th scope="col">Status</th>
                  <th scope="col">Provider</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_deployments.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="text-sm">{item.project_name}</span>
                      {item.is_demo && <Badge tone="info">demo</Badge>}
                    </td>
                    <td className="text-sm text-muted">{item.owner_name}</td>
                    <td><StatusPill status={item.status} compact /></td>
                    <td className="text-xs mono text-dim">{item.provider_state}</td>
                    <td className="text-sm text-muted">{formatRelative(item.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
