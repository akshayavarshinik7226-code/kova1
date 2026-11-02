import { useState } from 'react';
import { PageHead } from '../../components/AppLayout';
import { Icon } from '../../components/Icon';
import { Button, EmptyState, ErrorState, Input, LoadingState, Select, StatusPill } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

export function AdminDeployments() {
  const { notify } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const state = useAsync(() => api.admin.deployments({ search, status, limit: 100 }), [search, status]);

  async function cancel(id: string) {
    setBusyId(id);
    try {
      await api.admin.cancelDeployment(id);
      notify({ tone: 'success', message: 'Deployment canceled.' });
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

  const deployments = state.data ?? [];

  return (
    <div className="stack gap-4 fade-in">
      <PageHead
        eyebrow="Administration"
        title="Deployments"
        description="Every queue request, newest first. Cancel requests that should not continue."
      />

      <div className="toolbar">
        <div className="toolbar-search">
          <Input
            type="search"
            placeholder="Search by project or student"
            aria-label="Search deployments"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {['queued', 'building', 'ready', 'failed', 'canceled', 'expired'].map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </Select>
      </div>

      {state.loading && <LoadingState rows={6} label="Loading deployments" />}
      {state.error && !state.loading && <ErrorState message={state.error} onRetry={state.reload} />}
      {!state.loading && !state.error && deployments.length === 0 && (
        <EmptyState icon="rocket" title="No deployments match" description="Try a different search or status filter." />
      )}

      {!state.loading && !state.error && deployments.length > 0 && (
        <div className="table-wrap card">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Project</th>
                <th scope="col">Student</th>
                <th scope="col">Env</th>
                <th scope="col">Status</th>
                <th scope="col">Preview</th>
                <th scope="col">Created</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((item) => (
                <tr key={item.id}>
                  <td className="text-sm">{item.project_name}</td>
                  <td className="text-sm text-muted">{item.owner_name}</td>
                  <td className="text-xs mono text-dim">{item.environment}</td>
                  <td><StatusPill status={item.status} compact /></td>
                  <td className="text-xs text-dim">{item.preview_url ?? 'not issued'}</td>
                  <td className="text-xs text-dim">{formatRelative(item.created_at)}</td>
                  <td>
                    {(item.status === 'queued' || item.status === 'building') && (
                      <Button variant="secondary" size="sm" loading={busyId === item.id} onClick={() => cancel(item.id)}>
                        <Icon name="x" size={14} /> Cancel
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
