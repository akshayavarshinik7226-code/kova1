import { Link, useParams } from 'react-router-dom';
import { PageHead } from '../../components/AppLayout';
import { Icon } from '../../components/Icon';
import { EmptyState, ErrorState, InfoBanner, LoadingState, StatusPill } from '../../components/ui';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

export function BuildLogsPage() {
  const { id = '' } = useParams();
  const state = useAsync(() => api.deployment(id), [id]);

  if (state.loading) return <LoadingState rows={6} label="Loading build logs" variant="center" />;
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;
  if (!state.data) return <EmptyState icon="terminal" title="No log stream" description="This deployment is not available." />;

  const deployment = state.data;

  return (
    <div className="stack gap-4 fade-in">
      <PageHead
        eyebrow="Build logs"
        title={`${deployment.project_name} · ${deployment.environment}`}
        description={
          <span className="row gap-2">
            <StatusPill status={deployment.status} />
            <span className="text-muted text-sm">
              {deployment.logs.length} {deployment.logs.length === 1 ? 'entry' : 'entries'}
            </span>
          </span>
        }
        actions={
          <div className="page-actions">
            <Link className="btn btn-secondary btn-sm" to={`/app/deployments/${deployment.id}`}>
              <Icon name="layers" size={14} /> Deployment
            </Link>
          </div>
        }
      />

      <InfoBanner tone="info" icon="info" title="Queue-only stage">
        Logs reflect KOVA's own validation and queue lifecycle. No build or container output exists until the provider
        integration ships.
      </InfoBanner>

      {deployment.logs.length === 0 ? (
        <EmptyState
          icon="terminal"
          title="Nothing logged yet"
          description="Log lines appear as soon as the queue worker processes this request."
        />
      ) : (
        <div className="log-view" role="log" aria-label="Build log entries">
          {deployment.logs.map((entry) => (
            <div key={entry.id} className="log-line">
              <span className="log-ts">{formatDate(entry.ts)}</span>
              <span className={`log-level log-${entry.level}`}>{entry.level}</span>
              <span className="log-msg">
                <span className="mono text-xs text-dim">[{entry.step}] </span>
                {entry.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
