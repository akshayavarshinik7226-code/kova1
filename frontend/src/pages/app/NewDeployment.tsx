import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PageHead } from '../../components/AppLayout';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  InfoBanner,
  Input,
  LoadingState,
  Select,
} from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import type { Project } from '../../lib/api';
import { formatRelative, githubRepoName } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

export function NewDeployment() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [params] = useSearchParams();
  const projects = useAsync(() => api.projects({ status: 'active' }), []);

  const [projectId, setProjectId] = useState(params.get('project') ?? '');
  const [environment, setEnvironment] = useState('preview');
  const [commitRef, setCommitRef] = useState('');
  const [errors, setErrors] = useState<{ project?: string; commit?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const list: Project[] = projects.data ?? [];
  const selected = list.find((project) => project.id === projectId) ?? null;

  async function submit() {
    const next: { project?: string; commit?: string } = {};
    if (!projectId) next.project = 'Choose the project you want to deploy.';
    if (commitRef.trim() && commitRef.trim().length < 4) next.commit = 'Commit references need at least 4 characters.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      const deployment = await api.createDeployment({
        project_id: projectId,
        environment,
        ...(commitRef.trim() ? { commit_ref: commitRef.trim() } : {}),
      });
      notify({
        tone: 'success',
        title: 'Deployment queued',
        message: 'KOVA recorded the request. Provider delivery is pending Cloudflare integration.',
      });
      navigate(`/app/deployments/${deployment.id}`);
    } catch (error) {
      notify({
        tone: 'danger',
        title: 'Could not queue deployment',
        message: error instanceof Error ? error.message : 'The deployment was rejected.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <PageHead
        eyebrow={
          <>
            <Link to="/app/deployments">Deployments</Link> / New
          </>
        }
        title="New deployment"
        description="Pick a validated project and queue it. The build stays queued until the deployment provider is connected."
      />

      <InfoBanner tone="warn" icon="info" title="Preview deployments expire after 24 hours">
        KOVA keeps previews short-lived by design. Queueing is fully implemented; build execution and live
        URLs are pending the Cloudflare integration planned for a later phase.
      </InfoBanner>

      {projects.loading && <LoadingState rows={3} label="Loading projects" />}
      {!projects.loading && projects.error && (
        <ErrorState title="Projects unavailable" message={projects.error} onRetry={projects.reload} />
      )}

      {!projects.loading && !projects.error && list.length === 0 && (
        <EmptyState
          icon="box"
          title="No active projects"
          description="Submit a GitHub repository or ZIP archive before queueing a deployment."
          action={
            <Button variant="primary" icon="plus" onClick={() => navigate('/app/projects')}>
              Submit a project
            </Button>
          }
        />
      )}

      {!projects.loading && !projects.error && list.length > 0 && (
        <div className="split">
          <Card>
            <CardHeader title="Deployment request" subtitle="Only validated projects can be queued." />
            <Field label="Project" required htmlFor="deploy-project" error={errors.project}>
              <Select
                id="deploy-project"
                value={projectId}
                invalid={Boolean(errors.project)}
                onChange={(event) => setProjectId(event.target.value)}
              >
                <option value="">Select a project…</option>
                {list.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} ({project.source_type === 'github' ? 'GitHub' : 'ZIP'})
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Environment" htmlFor="deploy-env" hint="Production deployments still require the same provider integration.">
              <Select id="deploy-env" value={environment} onChange={(event) => setEnvironment(event.target.value)}>
                <option value="preview">Preview</option>
                <option value="production">Production</option>
              </Select>
            </Field>

            <Field
              label="Commit reference"
              htmlFor="deploy-commit"
              error={errors.commit}
              hint="Optional — branch, tag or commit SHA to build."
            >
              <Input
                id="deploy-commit"
                value={commitRef}
                invalid={Boolean(errors.commit)}
                placeholder={selected?.repo_branch ?? 'main'}
                onChange={(event) => setCommitRef(event.target.value)}
              />
            </Field>

            <div className="row-between" style={{ marginTop: 12 }}>
              <Button variant="ghost" onClick={() => navigate('/app/deployments')}>
                Cancel
              </Button>
              <Button variant="primary" icon="rocket" loading={submitting} onClick={submit}>
                Queue deployment
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Submission summary" subtitle="What KOVA will queue right now." />
            {selected ? (
              <dl className="detail-list">
                <div>
                  <dt>Project</dt>
                  <dd>{selected.name}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>
                    <Badge tone={selected.source_type === 'github' ? 'info' : 'accent'} dot>
                      {selected.source_type === 'github'
                        ? githubRepoName(selected.repo_url ?? '') ?? 'GitHub'
                        : selected.zip_filename ?? 'ZIP archive'}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt>Branch / archive</dt>
                  <dd className="mono">{selected.repo_branch ?? `${selected.archive_entries} files`}</dd>
                </div>
                <div>
                  <dt>Previous deployments</dt>
                  <dd>{selected.deployment_count}</dd>
                </div>
                <div>
                  <dt>Last updated</dt>
                  <dd>{formatRelative(selected.updated_at)}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted">
                <Icon name="info" /> Select a project to preview what will be queued.
              </p>
            )}
            <div className="banner banner-warn" style={{ marginTop: 16 }}>
              <Icon name="alert" />
              <div>
                <strong>Honest state reporting</strong>
                <p>
                  A queued deployment is not a live site. KOVA will only show a preview URL once a provider
                  build actually succeeds.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
