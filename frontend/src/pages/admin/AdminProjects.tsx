import { useState } from 'react';
import { PageHead } from '../../components/AppLayout';
import { Icon } from '../../components/Icon';
import { Button, EmptyState, ErrorState, Input, LoadingState, Select, StatusPill } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

export function AdminProjects() {
  const { notify } = useToast();
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const state = useAsync(() => api.admin.projects({ search, source, status }), [search, source, status]);

  async function toggleArchive(id: string, next: 'active' | 'archived') {
    setBusyId(id);
    try {
      await api.admin.updateProject(id, { status: next });
      notify({ tone: 'success', message: next === 'archived' ? 'Project archived.' : 'Project restored.' });
      state.reload();
    } catch (error) {
      notify({
        tone: 'danger',
        title: 'Update failed',
        message: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setBusyId(null);
    }
  }

  const projects = state.data ?? [];

  return (
    <div className="stack gap-4 fade-in">
      <PageHead eyebrow="Administration" title="Projects" description="Every submitted project, including archived ones." />

      <div className="toolbar">
        <div className="toolbar-search">
          <Input
            type="search"
            placeholder="Search projects or owners"
            aria-label="Search projects"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select aria-label="Filter by source" value={source} onChange={(event) => setSource(event.target.value)}>
          <option value="">All sources</option>
          <option value="github">GitHub</option>
          <option value="zip">ZIP upload</option>
        </Select>
        <Select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </Select>
      </div>

      {state.loading && <LoadingState rows={5} label="Loading projects" />}
      {state.error && !state.loading && <ErrorState message={state.error} onRetry={state.reload} />}
      {!state.loading && !state.error && projects.length === 0 && (
        <EmptyState icon="box" title="No projects match" description="Try a different search term or filter." />
      )}

      {!state.loading && !state.error && projects.length > 0 && (
        <div className="table-wrap card">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Project</th>
                <th scope="col">Owner</th>
                <th scope="col">Source</th>
                <th scope="col">Last deployment</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td>
                    <div className="stack">
                      <span className="text-sm">{project.name}</span>
                      <span className="text-xs text-dim mono">{project.slug}</span>
                    </div>
                  </td>
                  <td className="text-sm text-muted">{project.owner_email}</td>
                  <td className="text-sm">
                    <span className="row gap-1">
                      <Icon name={project.source_type === 'github' ? 'github' : 'upload'} size={14} />
                      {project.source_type}
                    </span>
                  </td>
                  <td>
                    {project.last_deployment_status ? (
                      <div className="stack gap-1">
                        <StatusPill status={project.last_deployment_status} compact />
                        <span className="text-xs text-dim">{formatRelative(project.last_deployment_at)}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-dim">Never deployed</span>
                    )}
                  </td>
                  <td className="text-sm">{project.status}</td>
                  <td>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={busyId === project.id}
                      onClick={() => toggleArchive(project.id, project.status === 'archived' ? 'active' : 'archived')}
                    >
                      <Icon name="archive" size={14} />
                      {project.status === 'archived' ? 'Restore' : 'Archive'}
                    </Button>
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
