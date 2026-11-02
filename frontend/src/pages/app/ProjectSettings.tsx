import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHead, SectionHead } from '../../components/AppLayout';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Select,
  Textarea,
} from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { formatRelative, githubRepoName } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

export function ProjectSettings() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const state = useAsync(() => api.project(id), [id]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [branch, setBranch] = useState('');
  const [status, setStatus] = useState('active');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!state.data) return;
    setName(state.data.name);
    setDescription(state.data.description);
    setBranch(state.data.repo_branch ?? '');
    setStatus(state.data.status);
  }, [state.data]);

  async function save() {
    if (name.trim().length < 2) {
      setError('Project names need at least 2 characters.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const updated = await api.updateProject(id, {
        name: name.trim(),
        description: description.trim(),
        status,
        ...(state.data?.source_type === 'github' ? { branch: branch.trim() || 'main' } : {}),
      });
      notify({ tone: 'success', title: 'Settings saved', message: `${updated.name} was updated.` });
      state.reload();
    } catch (err) {
      notify({
        tone: 'danger',
        title: 'Could not save settings',
        message: err instanceof Error ? err.message : 'The update was rejected.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this project and all of its deployments? This cannot be undone.')) return;
    try {
      await api.deleteProject(id);
      notify({ tone: 'success', title: 'Project deleted', message: 'The project was removed from your workspace.' });
      navigate('/app/projects');
    } catch (err) {
      notify({
        tone: 'danger',
        title: 'Delete failed',
        message: err instanceof Error ? err.message : 'The project could not be deleted.',
      });
    }
  }

  if (state.loading) return <div className="page"><LoadingState rows={4} label="Loading settings" /></div>;
  if (state.error || !state.data) {
    return (
      <div className="page">
        <ErrorState
          title="Project unavailable"
          message={state.error ?? 'This project does not exist or you no longer have access.'}
          onRetry={state.reload}
        />
      </div>
    );
  }

  const project = state.data;

  return (
    <div className="page">
      <PageHead
        eyebrow={
          <>
            <Link to="/app/projects">Projects</Link> /{' '}
            <Link to={`/app/projects/${project.id}`}>{project.name}</Link> / Settings
          </>
        }
        title="Project settings"
        description="Rename the project, change its branch or archive it when a course is finished."
        actions={
          <Button variant="primary" icon="check" loading={saving} onClick={save}>
            Save changes
          </Button>
        }
      />

      <div className="split">
        <div className="stack">
          <Card>
            <CardHeader title="General" subtitle="Visible only to you and KOVA administrators." />
            <Field label="Project name" required htmlFor="settings-name" error={error}>
              <Input
                id="settings-name"
                value={name}
                invalid={Boolean(error)}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field label="Description" htmlFor="settings-desc" hint="Optional — up to 400 characters.">
              <Textarea
                id="settings-desc"
                rows={3}
                maxLength={400}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
            {project.source_type === 'github' ? (
              <Field
                label="Deployment branch"
                htmlFor="settings-branch"
                hint="Only the selected branch will be built once the provider is connected."
              >
                <Input
                  id="settings-branch"
                  value={branch}
                  placeholder="main"
                  onChange={(event) => setBranch(event.target.value)}
                />
              </Field>
            ) : (
              <Field label="Archive" hint="ZIP projects deploy from the uploaded archive and cannot change branch.">
                <Input value={project.zip_filename ?? 'archive.zip'} disabled readOnly />
              </Field>
            )}
            <Field label="Project state" htmlFor="settings-status" hint="Archived projects stay readable but stop queueing.">
              <Select id="settings-status" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </Select>
            </Field>
          </Card>

          <Card>
            <CardHeader title="Danger zone" subtitle="Deleting a project removes its deployments and logs." />
            <div className="row-between">
              <div>
                <strong>Delete this project</strong>
                <p className="text-sm text-muted">This action cannot be undone.</p>
              </div>
              <Button variant="danger" icon="trash" onClick={remove}>
                Delete project
              </Button>
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <CardHeader title="Source" subtitle="Read-only submission details captured at validation." />
            <dl className="detail-list">
              <div>
                <dt>Type</dt>
                <dd>
                  <Badge tone={project.source_type === 'github' ? 'info' : 'accent'} dot>
                    {project.source_type === 'github' ? 'GitHub' : 'ZIP archive'}
                  </Badge>
                </dd>
              </div>
              {project.repo_url && (
                <div>
                  <dt>Repository</dt>
                  <dd className="mono">
                    <a href={project.repo_url} target="_blank" rel="noreferrer noopener">
                      {githubRepoName(project.repo_url) ?? project.repo_url}
                    </a>
                  </dd>
                </div>
              )}
              {project.archive_entries > 0 && (
                <div>
                  <dt>Archive entries</dt>
                  <dd>{project.archive_entries} files</dd>
                </div>
              )}
              <div>
                <dt>Slug</dt>
                <dd className="mono">{project.slug}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{formatRelative(project.created_at)}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{formatRelative(project.updated_at)}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Next steps" />
            <div className="stack-tight">
              <Button variant="secondary" block icon="rocket" onClick={() => navigate('/app/deployments/new')}>
                Queue a deployment
              </Button>
              <Button variant="ghost" block icon="arrow-right" onClick={() => navigate(`/app/projects/${project.id}`)}>
                Back to project
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <SectionHead title="Why this matters" subtitle="KOVA keeps project scope explicit so deployments stay predictable." />
    </div>
  );
}
