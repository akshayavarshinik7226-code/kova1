import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHead, SectionHead } from '../../components/AppLayout';
import {
  Badge,
  Button,
  Card,
  DemoTag,
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  StatusPill,
} from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { formatRelative, githubRepoName } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

export function ProjectDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const project = useAsync(() => api.project(id), [id]);
  const deployments = useAsync(() => api.deployments({ project_id: id }), [id]);
  const [queueing, setQueueing] = useState(false);

  async function queue() {
    setQueueing(true);
    try {
      const deployment = await api.createDeployment({ project_id: id, environment: 'preview' });
      notify({
        tone: 'success',
        title: 'Deployment queued',
        message: 'The build is waiting in the queue. Cloudflare delivery is pending integration.',
      });
      navigate(`/app/deployments/${deployment.id}`);
    } catch (error) {
      notify({
        tone: 'danger',
        title: 'Could not queue deployment',
        message: error instanceof Error ? error.message : 'The deployment was rejected.',
      });
    } finally {
      setQueueing(false);
    }
  }

  if (project.loading) return <div className="page"><LoadingState rows={4} label="Loading project" /></div>;

  if (project.error || !project.data) {
    return (
      <div className="page">
        <ErrorState
          title="Project unavailable"
          message={project.error ?? 'This project does not exist or you no longer have access.'}
          onRetry={project.reload}
        />
      </div>
    );
  }

  const data = project.data;
  const repo = data.repo_url ? githubRepoName(data.repo_url) : null;
  const list = deployments.data ?? [];

  return (
    <div className="page">
      <PageHead
        eyebrow={
          <>
            <Link to="/app/projects">Projects</Link> / {data.name}
          </>
        }
        title={
          <>
            {data.name} {data.is_demo && <DemoTag />}
          </>
        }
        description={data.description || 'No description yet — add one from project settings.'}
        actions={
          <>
            <Button variant="secondary" icon="settings" onClick={() => navigate(`/app/projects/${data.id}/settings`)}>
              Settings
            </Button>
            <Button variant="primary" icon="rocket" loading={queueing} onClick={queue}>
              Queue deployment
            </Button>
          </>
        }
      />

      <InfoBanner tone="warn" icon="info" title="Cloudflare integration pending">
        Deployments are recorded in the queue with a pending provider state. Builds and live preview URLs will
        be produced once the deployment provider is connected in a later phase — KOVA will never display a
        preview URL that does not exist.
      </InfoBanner>

      <div className="stat-grid">
        <Card>
          <div className="stat">
            <div className="stat-label">Source</div>
            <div className="stat-value" style={{ fontSize: '1rem' }}>
              {data.source_type === 'github' ? repo ?? 'GitHub repository' : data.zip_filename ?? 'ZIP archive'}
            </div>
            <div className="stat-foot">
              <Badge tone={data.source_type === 'github' ? 'info' : 'accent'} dot>
                {data.source_type === 'github' ? `Branch ${data.repo_branch}` : `${data.archive_entries} files`}
              </Badge>
            </div>
          </div>
        </Card>
        <Card>
          <div className="stat">
            <div className="stat-label">Deployments</div>
            <div className="stat-value">{data.deployment_count}</div>
            <div className="stat-foot">Queued over the lifetime of this project</div>
          </div>
        </Card>
        <Card>
          <div className="stat">
            <div className="stat-label">Last status</div>
            <div className="stat-value" style={{ fontSize: '1rem' }}>
              {data.last_deployment_status ? <StatusPill status={data.last_deployment_status} /> : 'Not deployed'}
            </div>
            <div className="stat-foot">
              {data.last_deployment_at ? formatRelative(data.last_deployment_at) : 'Queue your first deployment'}
            </div>
          </div>
        </Card>
        <Card>
          <div className="stat">
            <div className="stat-label">Project state</div>
            <div className="stat-value" style={{ fontSize: '1rem' }}>
              <Badge tone={data.status === 'active' ? 'success' : 'neutral'} dot>
                {data.status === 'active' ? 'Active' : 'Archived'}
              </Badge>
            </div>
            <div className="stat-foot">Created {formatRelative(data.created_at)}</div>
          </div>
        </Card>
      </div>

      <SectionHead title="Deployments" subtitle="Every queue attempt for this project, newest first." />

      {deployments.loading && <LoadingState rows={4} label="Loading deployments" />}
      {!deployments.loading && deployments.error && (
        <ErrorState title="Deployments unavailable" message={deployments.error} onRetry={deployments.reload} />
      )}
      {!deployments.loading && !deployments.error && list.length === 0 && (
        <EmptyState
          icon="rocket"
          title="No deployments yet"
          description="Queue a deployment to see it appear here with its provider state and build logs."
          action={
            <Button variant="primary" icon="rocket" loading={queueing} onClick={queue}>
              Queue deployment
            </Button>
          }
        />
      )}
      {!deployments.loading && !deployments.error && list.length > 0 && (
        <Card className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Deployment</th>
                <th>Environment</th>
                <th>Status</th>
                <th>Queued</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {list.map((deployment) => (
                <tr key={deployment.id}>
                  <td>
                    <div className="cell-stack">
                      <Link className="cell-title" to={`/app/deployments/${deployment.id}`}>
                        {deployment.id}
                      </Link>
                      <span className="cell-sub">{deployment.source_label}</span>
                    </div>
                  </td>
                  <td>
                    <Badge tone="neutral">{deployment.environment}</Badge>
                  </td>
                  <td>
                    <StatusPill status={deployment.status} compact />
                  </td>
                  <td className="text-sm text-muted">{formatRelative(deployment.created_at)}</td>
                  <td>
                    <Link className="btn btn-ghost btn-sm" to={`/app/deployments/${deployment.id}/logs`}>
                      <Icon name="terminal" />
                      Logs
                    </Link>
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
