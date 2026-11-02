import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHead, SectionHead } from '../../components/AppLayout';
import { Icon } from '../../components/Icon';
import {
  Button,
  Card,
  CardHeader,
  DemoTag,
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  StatusPill,
} from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { formatDate, formatRelative, STATUS_MEANING } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

export function DeploymentDetailPage() {
  const { id = '' } = useParams();
  const { notify } = useToast();
  const state = useAsync(() => api.deployment(id), [id]);
  const [busy, setBusy] = useState(false);

  async function act(kind: 'cancel' | 'retry') {
    setBusy(true);
    try {
      if (kind === 'cancel') {
        await api.cancelDeployment(id);
        notify({ tone: 'success', title: 'Deployment canceled', message: 'The queue request was canceled.' });
      } else {
        await api.retryDeployment(id);
        notify({ tone: 'success', title: 'Re-queued', message: 'A new queue request was created for this project.' });
      }
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

  if (state.loading) return <LoadingState rows={5} label="Loading deployment" />;
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;
  if (!state.data) {
    return (
      <EmptyState
        icon="layers"
        title="Deployment not found"
        description="This deployment may belong to another account."
        action={<Link className="btn btn-secondary btn-sm" to="/app/deployments">All deployments</Link>}
      />
    );
  }

  const deployment = state.data;
  const queued = deployment.status === 'queued' || deployment.status === 'building';

  return (
    <div className="stack gap-5 fade-in">
      <PageHead
        eyebrow="Deployment"
        title={deployment.project_name}
        description={
          <span className="row gap-2" style={{ flexWrap: 'wrap' }}>
            <StatusPill status={deployment.status} />
            <span className="text-muted text-sm">{deployment.source_label}</span>
            {deployment.is_demo && <DemoTag label="Demo data" />}
          </span>
        }
        actions={
          <div className="page-actions">
            <Link className="btn btn-ghost btn-sm" to={`/app/projects/${deployment.project_id}`}>
              <Icon name="box" size={14} /> Project
            </Link>
            <Link className="btn btn-secondary btn-sm" to={`/app/deployments/${deployment.id}/logs`}>
              <Icon name="terminal" size={14} /> Build logs
            </Link>
            {queued && (
              <Button variant="secondary" size="sm" loading={busy} onClick={() => act('cancel')}>
                Cancel
              </Button>
            )}
            {deployment.status === 'failed' && (
              <Button variant="primary" size="sm" loading={busy} onClick={() => act('retry')}>
                <Icon name="refresh" size={14} /> Retry
              </Button>
            )}
          </div>
        }
      />

      <InfoBanner tone="warn" icon="alert" title="Provider integration pending">
        {STATUS_MEANING[deployment.status]} KOVA records the request in the queue, but the build and hosting provider is not
        connected yet, so no live URL is issued.
      </InfoBanner>

      <div className="grid-2">
        <Card>
          <CardHeader title="Details" subtitle="Recorded by the KOVA control plane." />
          <div className="card-body stack gap-3">
            {[
              ['Environment', deployment.environment],
              ['Commit / source', deployment.commit_ref ?? 'Default branch head'],
              ['Provider', `${deployment.provider} · ${deployment.provider_state}`],
              ['Preview URL', deployment.preview_url ?? 'Not issued — provider not configured'],
              ['Queue position', deployment.queue_position ? `#${deployment.queue_position}` : '—'],
              ['Requested', `${formatDate(deployment.created_at)} (${formatRelative(deployment.created_at)})`],
              ['Expires', deployment.expires_at ? formatDate(deployment.expires_at) : 'No expiry until a preview exists'],
            ].map(([label, value]) => (
              <div key={label} className="row" style={{ justifyContent: 'space-between', gap: 16 }}>
                <span className="text-muted text-sm">{label}</span>
                <span className="text-sm truncate" style={{ textAlign: 'right' }}>{value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Build logs"
            subtitle="Every queue decision is appended here."
            action={<Link className="btn btn-ghost btn-sm" to={`/app/deployments/${deployment.id}/logs`}>Open</Link>}
          />
          <div className="card-body">
            {deployment.logs.length === 0 ? (
              <p className="text-muted text-sm">No log entries yet. KOVA writes a line whenever the request changes state.</p>
            ) : (
              <div className="stack gap-2">
                {deployment.logs.slice(-4).map((entry) => (
                  <div key={entry.id} className="row gap-2 text-sm">
                    <span className={`log-level log-${entry.level}`}>{entry.level}</span>
                    <span className="truncate">{entry.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {deployment.status === 'failed' && deployment.error_message && (
        <Card>
          <SectionHead title="Failure report" subtitle="Reported by the queue worker." />
          <div className="card-body">
            <p className="text-sm mono">{deployment.error_code ?? 'deployment_failed'}</p>
            <p className="text-sm text-muted" style={{ marginTop: 8 }}>{deployment.error_message}</p>
          </div>
        </Card>
      )}
    </div>
  );
}
