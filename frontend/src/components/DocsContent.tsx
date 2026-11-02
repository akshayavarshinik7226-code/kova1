import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { StatusPill } from './ui';

interface Section {
  id: string;
  title: string;
  body: React.ReactNode;
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="mono code-inline">{children}</code>;
}

const SECTIONS: Section[] = [
  {
    id: 'overview',
    title: 'Platform overview',
    body: (
      <>
        <p>
          KOVA is a student project deployment platform. Students submit a project from GitHub or as a
          ZIP archive, queue a deployment, and follow its status, queue position and build log. Admins
          see every student, project and deployment across the platform.
        </p>
        <p>
          This is <strong>Stage 1</strong>: the interface and control plane are complete. Build execution
          is not implemented yet — the Cloudflare deployment provider integration is the next stage.
        </p>
      </>
    ),
  },
  {
    id: 'accounts',
    title: 'Accounts and roles',
    body: (
      <>
        <p>Every account has exactly one role:</p>
        <ul className="docs-list">
          <li><strong>Student</strong> — creates and manages their own projects and deployments.</li>
          <li><strong>Admin</strong> — read access to all students and projects, plus queue, usage and system views.</li>
        </ul>
        <p>
          Registration always creates a student account. Admin accounts are provisioned separately by the
          platform operator. Ownership of a project is enforced server-side: a student cannot read or
          mutate another student's records.
        </p>
      </>
    ),
  },
  {
    id: 'projects',
    title: 'Submitting a project',
    body: (
      <>
        <p>Two submission sources are supported:</p>
        <ul className="docs-list">
          <li>
            <strong>GitHub</strong> — provide a name, a repository URL and a branch. The repository host is
            validated before the project is created.
          </li>
          <li>
            <strong>ZIP archive</strong> — upload an archive. KOVA inspects the archive, records the file
            count and size, and rejects empty or oversized archives.
          </li>
        </ul>
        <p>
          Project names must be unique per account. Updates to a project's name, branch or description are
          available from <strong>Project settings</strong>.
        </p>
      </>
    ),
  },
  {
    id: 'deployments',
    title: 'Queueing a deployment',
    body: (
      <>
        <p>
          A deployment belongs to one project and one environment. When created, KOVA records the
          deployment with a queue position computed from existing queued records.
        </p>
        <ul className="docs-list">
          <li>Queue position is returned by the API — it is not generated in the UI.</li>
          <li>A commit reference can be attached when supplied.</li>
          <li>Queued deployments can be cancelled; cancelled or failed deployments can be retried.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'statuses',
    title: 'Deployment statuses',
    body: (
      <>
        <div className="stack gap-2">
          <div className="row gap-3 wrap"><StatusPill status="queued" /><span className="text-sm text-muted">Waiting in the queue.</span></div>
          <div className="row gap-3 wrap"><StatusPill status="building" /><span className="text-sm text-muted">A build is running (requires the provider integration).</span></div>
          <div className="row gap-3 wrap"><StatusPill status="ready" /><span className="text-sm text-muted">Build finished and a URL was issued by the provider.</span></div>
          <div className="row gap-3 wrap"><StatusPill status="failed" /><span className="text-sm text-muted">Build failed. The reason stays attached to the deployment.</span></div>
          <div className="row gap-3 wrap"><StatusPill status="canceled" /><span className="text-sm text-muted">Cancelled before completion.</span></div>
        </div>
      </>
    ),
  },
  {
    id: 'logs',
    title: 'Build logs',
    body: (
      <>
        <p>
          Each deployment keeps its own log stream. Entries carry a timestamp, a level and the build step
          they belong to. The full log is available from the deployment detail page and the dedicated build
          log viewer.
        </p>
        <p>
          Because build execution is not yet integrated, logs in this stage record queue events, validation
          results and provider state — not compiler output.
        </p>
      </>
    ),
  },
  {
    id: 'limits',
    title: 'Limits and lifetimes',
    body: (
      <>
        <ul className="docs-list">
          <li>Preview deployments are designed to expire after <Code>24h</Code>. Expiry cleanup ships with the provider integration.</li>
          <li>ZIP archives are limited in size; oversized uploads are rejected with an error.</li>
          <li>Project names are unique per account.</li>
          <li>Deployment records, logs and activity history are retained so admins can audit them.</li>
        </ul>
        <p className="text-sm text-muted">
          No live URL exists until a build provider returns one. KOVA never fabricates a preview URL.
        </p>
      </>
    ),
  },
  {
    id: 'api',
    title: 'API surface',
    body: (
      <>
        <p>The frontend consumes a versioned JSON API. Key endpoints:</p>
        <pre className="code-block mono">{`GET    /api/meta                 platform metadata & provider state
GET    /api/health               service health
POST   /api/auth/register        create a student account
POST   /api/auth/login           obtain a bearer token
GET    /api/auth/me              current user
PATCH  /api/auth/me              update profile
GET    /api/projects             list your projects
POST   /api/projects/github      submit a GitHub project
POST   /api/projects/zip         upload a ZIP project
GET    /api/deployments          list deployments (+ filters)
POST   /api/deployments          queue a deployment
GET    /api/deployments/:id      deployment detail + logs
POST   /api/deployments/:id/cancel
POST   /api/deployments/:id/retry
GET    /api/notifications        list notifications
GET    /api/admin/overview       admin statistics`}</pre>
        <p className="text-sm text-muted">
          Authenticated requests send <Code>Authorization: Bearer &lt;token&gt;</Code>.
        </p>
      </>
    ),
  },
  {
    id: 'admin',
    title: 'Administration',
    body: (
      <>
        <p>Admin views cover:</p>
        <ul className="docs-list">
          <li>Overview statistics and status breakdown</li>
          <li>Student management with search and status control</li>
          <li>Project and deployment management with filters</li>
          <li>Deployment queue ordered by position</li>
          <li>Failed deployment monitoring with error details</li>
          <li>Activity log, usage statistics and system status</li>
        </ul>
        <p className="text-sm text-muted">
          Usage and system numbers are computed from stored records. Nothing is streamed or simulated in
          real time.
        </p>
      </>
    ),
  },
  {
    id: 'support',
    title: 'Support',
    body: (
      <>
        <p>
          Questions, bugs and account issues go through the contact form. Every message is stored and
          visible to admins.
        </p>
        <p>
          <Link to="/contact" className="text-sm" style={{ display: 'inline-flex', gap: 6 }}>
            Open the contact form <Icon name="arrow-right" size={14} />
          </Link>
        </p>
      </>
    ),
  },
];

export function DocsContent() {
  return (
    <div className="docs-shell">
      <nav className="docs-toc" aria-label="Documentation sections">
        <p className="nav-group-label">On this page</p>
        <div className="stack gap-1" style={{ marginTop: 10 }}>
          {SECTIONS.map((section) => (
            <a key={section.id} className="side-link" href={`#${section.id}`}>
              {section.title}
            </a>
          ))}
        </div>
      </nav>
      <div className="docs-body">
        <div className="banner banner-warn" style={{ marginBottom: 28 }}>
          <Icon name="alert" size={16} />
          <p className="text-sm">
            Stage 1 documentation. Build execution and preview URLs are pending the Cloudflare provider
            integration — deployments queue and report <code className="mono">not_configured</code>.
          </p>
        </div>
        {SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="docs-section">
            <h2>{section.title}</h2>
            <div className="docs-prose">{section.body}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
