import { Link } from 'react-router-dom';
import { PageHead, SectionHead } from '../../components/AppLayout';
import {
  Badge,
  Card,
  CardHeader,
  DemoTag,
  EmptyState,
  ErrorState,
  LoadingState,
  Stat,
  StatusPill,
} from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import type { Deployment, Project } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

export function StudentOverview() {
  const { user } = useAuth();
  const projects = useAsync(() => api.projects(), []);
  const deployments = useAsync(() => api.deployments({ limit: 6 }), []);

  const projectList: Project[] = projects.data ?? [];
  const deploymentList: Deployment[] = deployments.data ?? [];
  const queued = deploymentList.filter((item) => item.status === 'queued').length;
  const failed = deploymentList.filter((item) => item.status === 'failed').length;
  const live = deploymentList.filter((item) => item.status === 'ready').length;

  return (
    <div className="page">
      <PageHead
        eyebrow="Student workspace"
        title={`Welcome back, ${user?.name?.split(' ')[0] ?? 'student'}`}
        description="Track every project, queue deployments and read build output — all from one workspace."
        actions={
          <>
            <Link to="/app/projects" className="btn btn-secondary">
              <Icon name="box" /> My projects
            </Link>
            <Link to="/app/deployments/new" className="btn btn-primary">
              <Icon name="rocket" /> New deployment
            </Link>
          </>
        }
      />

      <div className="stat-grid">
        <Stat label="Projects" value={projects.loading ? '—' : projectList.length} icon="box" foot="Linked repositories and archives" />
        <Stat label="Deployments" value={deployments.loading ? '—' : deploymentList.length} icon="layers" foot="Most recent 6 loaded" />
        <Stat label="Queued" value={deployments.loading ? '—' : queued} icon="queue" foot="Waiting for a build provider" />
        <Stat label="Live" value={deployments.loading ? '—' : live} icon="globe" foot="Deployments with a published URL" />
      </div>

      <div className="banner banner-warn" style={{ marginTop: 18 }}>
        <Icon name="alert" />
        <div>
          <strong>Deployment provider pending integration.</strong> KOVA validates submissions and manages the queue,
          but Cloudflare build/deploy wiring arrives in a later phase. Queued deployments keep{' '}
          <span className="mono">provider_state = not_configured</span> and never receive a live URL.
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 18 }}>
        <Card>
          <CardHeader
            title="Recent deployments"
            subtitle="Newest first, queued items pinned to the top"
            action={
              <Link to="/app/deployments" className="btn btn-ghost btn-sm">
                View all
              </Link>
            }
          />
          <div className="card-body">
            {deployments.loading && <LoadingState rows={3} label="Loading deployments" />}
            {deployments.error && <ErrorState message={deployments.error} onRetry={deployments.reload} />}
            {!deployments.loading && !deployments.error && deploymentList.length === 0 && (
              <EmptyState
                icon="layers"
                title="No deployments yet"
                description="Create a project first, then queue your first deployment."
                action={
                  <Link to="/app/deployments/new" className="btn btn-primary btn-sm">
                    Queue a deployment
                  </Link>
                }
              />
            )}
            {deploymentList.length > 0 && (
              <div style={{ display: 'grid', gap: 10 }}>
                {deploymentList.map((item) => (
                  <Link
                    key={item.id}
                    to={`/app/deployments/${item.id}`}
                    className="queue-item"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div className="row gap-2" style={{ alignItems: 'center' }}>
                        <strong className="truncate">{item.project_name}</strong>
                        <StatusPill status={item.status} compact />
                        {item.is_demo && <DemoTag />}
                      </div>
                      <p className="text-xs text-muted" style={{ marginTop: 4 }}>
                        {item.source_label} · {item.environment} · {formatRelative(item.created_at)}
                      </p>
                    </div>
                    <Icon name="chevron-right" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Your projects"
            subtitle="Validated submissions ready to deploy"
            action={
              <Link to="/app/projects" className="btn btn-ghost btn-sm">
                Manage
              </Link>
            }
          />
          <div className="card-body">
            {projects.loading && <LoadingState rows={3} label="Loading projects" />}
            {projects.error && <ErrorState message={projects.error} onRetry={projects.reload} />}
            {!projects.loading && !projects.error && projectList.length === 0 && (
              <EmptyState
                icon="box"
                title="No projects yet"
                description="Submit a GitHub repository or a ZIP archive to get started."
                action={
                  <Link to="/app/projects" className="btn btn-primary btn-sm">
                    Submit a project
                  </Link>
                }
              />
            )}
            {projectList.slice(0, 5).map((project) => (
              <div key={project.id} className="row" style={{ justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="row gap-2" style={{ alignItems: 'center' }}>
                    <strong className="truncate">{project.name}</strong>
                    <Badge tone={project.source_type === 'github' ? 'info' : 'accent'}>{project.source_type}</Badge>
                    {project.is_demo && <DemoTag />}
                  </div>
                  <p className="text-xs text-muted" style={{ marginTop: 3 }}>
                    {project.deployment_count} deployment{project.deployment_count === 1 ? '' : 's'} · updated{' '}
                    {formatRelative(project.updated_at)}
                  </p>
                </div>
                {project.last_deployment_status ? (
                  <StatusPill status={project.last_deployment_status} compact />
                ) : (
                  <span className="text-xs text-muted">Not deployed</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 24 }}>
        <SectionHead title="What happens next" description="The queue is honest about what KOVA can and cannot do today." />
        <div className="grid-3">
          {[
            {
              icon: 'upload' as const,
              title: '1. Submit',
              body: 'Link a GitHub repository or upload a ZIP. KOVA validates the URL, branch and archive contents.',
            },
            {
              icon: 'queue' as const,
              title: '2. Queue',
              body: 'Deployments enter a FIFO queue with a visible position and full log trail.',
            },
            {
              icon: 'alert' as const,
              title: '3. Await provider',
              body: 'Builds stay queued until Cloudflare integration ships. No fake success, no fake URLs.',
            },
          ].map((step) => (
            <Card key={step.title}>
              <div className="card-pad">
                <span className="feature-icon">
                  <Icon name={step.icon} />
                </span>
                <h3 style={{ marginTop: 10, fontSize: '0.95rem' }}>{step.title}</h3>
                <p className="text-sm text-muted" style={{ marginTop: 6 }}>
                  {step.body}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {failed > 0 && (
        <div className="banner banner-warn" style={{ marginTop: 18 }}>
          <Icon name="alert" />
          <div>
            <strong>
              {failed} deployment{failed === 1 ? '' : 's'} failed.
            </strong>{' '}
            <Link to="/app/deployments?status=failed">Review the logs</Link> to see what the builder reported.
          </div>
        </div>
      )}
    </div>
  );
}
