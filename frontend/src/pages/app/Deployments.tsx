import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHead } from '../../components/AppLayout';
import {
  Badge,
  Button,
  Card,
  DemoTag,
  EmptyState,
  ErrorState,
  LoadingState,
  SearchInput,
  StatusPill,
} from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import type { Deployment, DeploymentStatus } from '../../lib/api';
import { displayUrl, formatRelative } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

const FILTERS: { value: DeploymentStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'queued', label: 'Queued' },
  { value: 'building', label: 'Building' },
  { value: 'ready', label: 'Ready' },
  { value: 'failed', label: 'Failed' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'expired', label: 'Expired' },
];

export function Deployments() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [status, setStatus] = useState<DeploymentStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const state = useAsync(() => api.deployments({ status: status === 'all' ? undefined : status }), [status]);

  const deployments: Deployment[] = state.data ?? [];
  const term = search.trim().toLowerCase();
  const visible = term
    ? deployments.filter(
        (item) =>
          item.project_name.toLowerCase().includes(term) ||
          item.id.toLowerCase().includes(term) ||
          item.source_label.toLowerCase().includes(term),
      )
    : deployments;

  async function act(deployment: Deployment, action: 'cancel' | 'retry') {
    setBusyId(deployment.id);
    try {
      if (action === 'cancel') await api.cancelDeployment(deployment.id);
      else await api.retryDeployment(deployment.id);
      notify({
        tone: 'success',
        title: action === 'cancel' ? 'Deployment canceled' : 'Deployment re-queued',
        message:
          action === 'cancel'
            ? `${deployment.id} will not be built.`
            : `${deployment.id} was placed back in the queue. Provider delivery is still pending.`,
      });
      state.reload();
    } catch (error) {
      notify({
        tone: 'danger',
        title: action === 'cancel' ? 'Cancel failed' : 'Retry failed',
        message: error instanceof Error ? error.message : 'The action was rejected by the API.',
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <PageHead
        eyebrow="Workspace"
        title="Deployments"
        description="Every deployment records its provider state. Preview URLs appear only after a real build succeeds."
        actions={
          <Button variant="primary" icon="plus" onClick={() => navigate('/app/deployments/new')}>
            New deployment
          </Button>
        }
      />

      <div className="toolbar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by project, ID or source…"
          ariaLabel="Search deployments"
        />
        <div className="filter-tabs" role="group" aria-label="Filter by status">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={`filter-tab ${status === filter.value ? 'is-active' : ''}`}
              aria-pressed={status === filter.value}
              onClick={() => setStatus(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {state.loading && <LoadingState rows={5} label="Loading deployments" />}
      {!state.loading && state.error && (
        <ErrorState title="Deployments unavailable" message={state.error} onRetry={state.reload} />
      )}

      {!state.loading && !state.error && visible.length === 0 && (
        <EmptyState
          icon="rocket"
          title={deployments.length === 0 ? 'No deployments yet' : 'No deployments match this filter'}
          description={
            deployments.length === 0
              ? 'Queue your first deployment from a project to see build state and logs here.'
              : 'Try a different status filter or clear the search field.'
          }
          action={
            deployments.length === 0 ? (
              <Button variant="primary" icon="plus" onClick={() => navigate('/app/deployments/new')}>
                New deployment
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => {
                  setStatus('all');
                  setSearch('');
                }}
              >
                Reset filters
              </Button>
            )
          }
        />
      )}

      {!state.loading && !state.error && visible.length > 0 && (
        <Card className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Deployment</th>
                <th>Status</th>
                <th>Provider</th>
                <th>Preview</th>
                <th>Queued</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {visible.map((deployment) => (
                <tr key={deployment.id}>
                  <td>
                    <div className="cell-stack">
                      <Link className="cell-title" to={`/app/deployments/${deployment.id}`}>
                        {deployment.project_name}
                      </Link>
                      <span className="cell-sub mono">
                        {deployment.id} · {deployment.environment}
                        {deployment.is_demo && <DemoTag />}
                      </span>
                    </div>
                  </td>
                  <td>
                    <StatusPill status={deployment.status} compact />
                  </td>
                  <td>
                    <Badge tone={deployment.provider_state === 'not_configured' ? 'warn' : 'neutral'} dot>
                      {deployment.provider}
                    </Badge>
                  </td>
                  <td className="text-sm">
                    {deployment.preview_url ? (
                      <a href={deployment.preview_url} target="_blank" rel="noreferrer noopener">
                        {displayUrl(deployment.preview_url)}
                      </a>
                    ) : (
                      <span className="text-muted" title={deployment.blocked_reason ?? 'Pending provider integration'}>
                        Pending integration
                      </span>
                    )}
                  </td>
                  <td className="text-sm text-muted">{formatRelative(deployment.created_at)}</td>
                  <td>
                    <div className="row-actions">
                      {(deployment.status === 'queued' || deployment.status === 'building') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={busyId === deployment.id}
                          onClick={() => act(deployment, 'cancel')}
                        >
                          Cancel
                        </Button>
                      )}
                      {(deployment.status === 'failed' ||
                        deployment.status === 'canceled' ||
                        deployment.status === 'expired') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon="refresh"
                          loading={busyId === deployment.id}
                          onClick={() => act(deployment, 'retry')}
                        >
                          Retry
                        </Button>
                      )}
                      <Link className="btn btn-ghost btn-sm" to={`/app/deployments/${deployment.id}/logs`}>
                        Logs
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
