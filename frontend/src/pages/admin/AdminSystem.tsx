import { PageHead } from '../../components/AppLayout';
import { Icon } from '../../components/Icon';
import { Badge, Card, CardHeader, EmptyState, ErrorState, InfoBanner, LoadingState } from '../../components/ui';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';

export function AdminSystem() {
  const state = useAsync(() => api.admin.system(), []);

  if (state.loading) return <LoadingState rows={4} label="Loading system status" />;
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;
  if (!state.data) return <EmptyState icon="cpu" title="No status" description="The system endpoint returned no data." />;

  const data = state.data;
  const messaging = Object.entries(data.messaging ?? {});
  const storage = Object.entries(data.storage ?? {});

  return (
    <div className="stack gap-4 fade-in">
      <PageHead
        eyebrow="Administration"
        title="System status"
        description="Configuration read directly from the running API process."
        actions={
          <button className="btn btn-secondary btn-sm" type="button" onClick={state.reload}>
            <Icon name="refresh" size={14} /> Reload
          </button>
        }
      />

      <div className="grid-2">
        <Card>
          <CardHeader title="Runtime" subtitle="Values report what this process is actually running." />
          <div className="card-body">
            <dl className="kv">
              <dt>Version</dt><dd className="mono text-sm">{data.version}</dd>
              <dt>Environment</dt><dd className="mono text-sm">{data.environment}</dd>
              <dt>Database</dt><dd className="mono text-sm">{data.database}</dd>
              <dt>Preview lifetime</dt><dd className="mono text-sm">{data.preview_ttl_hours} hours</dd>
            </dl>
          </div>
        </Card>

        <Card>
          <CardHeader title="Deployment provider" subtitle={data.deploy_provider.label} />
          <div className="card-body stack gap-3">
            <div className="row gap-2">
              <Badge tone={data.deploy_provider.configured ? 'success' : 'warn'} dot>
                {data.deploy_provider.configured ? 'configured' : 'not configured'}
              </Badge>
              <span className="text-xs mono text-dim">{data.deploy_provider.name}</span>
            </div>
            <p className="text-sm text-muted">
              {data.deploy_provider.blocked_reason ??
                'The provider is configured; builds may still be disabled by the platform operator.'}
            </p>
            <p className="text-sm">
              Deployments are validated and queued only. No build runs and no preview URL is issued until the provider
              integration ships.
            </p>
          </div>
        </Card>
      </div>

      {messaging.length > 0 && (
        <Card>
          <CardHeader title="Messaging" subtitle="Delivery channels for notifications." />
          <div className="card-body">
            <dl className="kv">
              {messaging.map(([key, value]) => (
                <>
                  <dt key={`${key}-k`} className="mono text-xs">{key}</dt>
                  <dd key={`${key}-v`} className="text-sm">{value}</dd>
                </>
              ))}
            </dl>
          </div>
        </Card>
      )}

      {storage.length > 0 && (
        <Card>
          <CardHeader title="Storage" subtitle="Where submitted project archives are kept." />
          <div className="card-body">
            <dl className="kv">
              {storage.map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="mono text-xs">{key}</dt>
                  <dd className="text-sm">{String(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>
      )}

      {data.notes && data.notes.length > 0 && (
        <InfoBanner tone="info" icon="info" title="Operator notes">
          <ul className="docs-list">
            {data.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </InfoBanner>
      )}
    </div>
  );
}
