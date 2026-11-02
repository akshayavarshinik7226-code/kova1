import { PageHead } from '../../components/AppLayout';
import { Icon } from '../../components/Icon';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, InfoBanner, LoadingState } from '../../components/ui';
import { api } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

export function AdminFailed() {
  const state = useAsync(() => api.admin.failed(), []);

  if (state.loading) return <LoadingState rows={4} label="Loading failed deployments" />;
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;
  if (!state.data) return <EmptyState icon="alert" title="No report" description="The failed-deployment endpoint returned no data." />;

  const { items, note } = state.data;

  return (
    <div className="stack gap-4 fade-in">
      <PageHead
        eyebrow="Administration"
        title="Failed deployments"
        description="Failures reported by the queue worker, with the recorded error."
        actions={
          <Button variant="secondary" size="sm" onClick={state.reload}>
            <Icon name="refresh" size={14} /> Refresh
          </Button>
        }
      />

      <InfoBanner tone="warn" icon="info" title="Monitoring note">{note}</InfoBanner>

      {items.length === 0 ? (
        <EmptyState icon="check" title="No failures recorded" description="No deployment has reported a failed state." />
      ) : (
        <div className="stack gap-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardHeader
                title={item.project_name}
                subtitle={`${item.owner_name} · ${formatRelative(item.created_at)}`}
                action={<Badge tone="danger">{item.error_code ?? 'failed'}</Badge>}
              />
              <div className="card-body stack gap-2">
                <p className="text-sm">{item.error_message ?? 'No error message was recorded.'}</p>
                <span className="text-xs text-dim mono">
                  {item.provider} · {item.provider_state} · {item.source_label}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
