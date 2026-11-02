import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { MarketingButton } from '../../components/PublicLayout';
import { StatusPill } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'github',
    title: 'Submit from GitHub or ZIP',
    body: 'Paste a repository URL with a branch, or upload a ZIP archive. KOVA validates the submission before anything is queued.',
  },
  {
    icon: 'queue',
    title: 'A queue you can actually read',
    body: 'Every deployment shows its position, environment, source label and the exact blocker holding it back.',
  },
  {
    icon: 'terminal',
    title: 'Build logs per deployment',
    body: 'Each attempt keeps its own timestamped log stream with levels and build steps — no guessing what happened.',
  },
  {
    icon: 'bell',
    title: 'Notifications that matter',
    body: 'Queue events, cancellations and retries generate notifications for the student and visible activity for admins.',
  },
  {
    icon: 'shield',
    title: 'Role-based control',
    body: 'Students manage their own projects. Admins see every student, project, deployment and platform metric.',
  },
  {
    icon: 'clock',
    title: 'Honest by design',
    body: 'Preview URLs are only shown when a provider actually returned one. Until then, KOVA says "pending integration".',
  },
];

const STEPS = [
  {
    title: 'Submit a project',
    body: 'Add a GitHub repository with a branch, or upload a ZIP archive with the entry files. KOVA stores metadata and validates the input.',
  },
  {
    title: 'KOVA validates it',
    body: 'Repository hosts, archive contents, name collisions and payload limits are checked server-side before a project is created.',
  },
  {
    title: 'Queue a deployment',
    body: 'Choose a project and environment. The deployment is created with a real queue position and a provider state of not_configured.',
  },
  {
    title: 'Track it end to end',
    body: 'Follow the status, read the build log, cancel or retry. A live URL appears only after the build provider integration ships.',
  },
];

export function Landing() {
  const { user } = useAuth();
  const primaryTo = user ? (user.role === 'admin' ? '/admin' : '/app') : '/register';

  return (
    <>
      <section className="hero">
        <div className="page hero-inner">
          <div>
            <div className="row gap-2 wrap">
              <span className="badge badge-accent" dot>Stage 1 · control plane</span>
              <span className="badge badge-warn">Cloudflare build provider: pending</span>
            </div>
            <h1 className="hero-title" style={{ marginTop: 20 }}>
              Deploy student projects with <span className="gradient-text">nothing hidden</span>.
            </h1>
            <p className="hero-sub">
              KOVA turns a repository or ZIP archive into a tracked deployment: validated submission,
              transparent queue, per-deployment logs and a status that never lies about being live.
            </p>
            <div className="hero-actions">
              <MarketingButton to={primaryTo} icon="arrow-right">
                {user ? 'Open dashboard' : 'Create a student account'}
              </MarketingButton>
              <MarketingButton to="/how-it-works" variant="secondary">
                See the workflow
              </MarketingButton>
            </div>
            <div className="hero-trust">
              <span><Icon name="check" size={14} /> No credit card, no paid services</span>
              <span><Icon name="check" size={14} /> Dark theme by default</span>
              <span><Icon name="check" size={14} /> Role-based access</span>
            </div>
          </div>

          <div className="hero-panel">
            <div className="hero-panel-head">
              <span className="window-dots" aria-hidden="true"><i /><i /><i /></span>
              <span className="text-xs text-dim mono">kova · deployment</span>
              <span className="badge badge-warn" style={{ marginLeft: 'auto' }}>demo data</span>
            </div>
            <div className="hero-panel-body">
              <div className="row gap-2" style={{ justifyContent: 'space-between' }}>
                <div>
                  <div className="text-sm" style={{ fontWeight: 600 }}>portfolio-site</div>
                  <div className="text-xs text-dim mono">github · main</div>
                </div>
                <StatusPill status="queued" />
              </div>

              <div className="kv" style={{ marginTop: 16 }}>
                <span>Queue position</span>
                <span className="mono">2</span>
                <span>Environment</span>
                <span className="mono">preview</span>
                <span>Provider</span>
                <span className="mono">cloudflare · not_configured</span>
                <span>Preview URL</span>
                <span className="mono text-dim">— none yet</span>
              </div>

              <div className="log-view" style={{ marginTop: 16 }}>
                <div className="log-line log-info">
                  <span className="log-ts">10:24:01</span>
                  <span className="log-level">INFO</span>
                  <span className="log-msg">submission validated · 34 files</span>
                </div>
                <div className="log-line log-info">
                  <span className="log-ts">10:24:02</span>
                  <span className="log-level">INFO</span>
                  <span className="log-msg">queued at position 2 (preview)</span>
                </div>
                <div className="log-line log-warn">
                  <span className="log-ts">10:24:02</span>
                  <span className="log-level">WAIT</span>
                  <span className="log-msg">build provider not configured — no build executed</span>
                </div>
              </div>
              <p className="inline-note" style={{ marginTop: 12 }}>
                Illustrative panel. Real deployments in KOVA report the same honest states from the API.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="page">
          <div className="section-head">
            <p className="eyebrow">Capabilities</p>
            <h2 className="section-title">Everything a student deployment needs, minus the theatre</h2>
            <p className="lede">
              KOVA covers submission, validation, queueing, monitoring and administration. Deployment
              execution is the one piece the Cloudflare integration will add.
            </p>
          </div>
          <div className="feature-grid">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="card card-pad">
                <span className="feature-icon"><Icon name={feature.icon} size={18} /></span>
                <h3 style={{ marginTop: 14, fontSize: '0.98rem' }}>{feature.title}</h3>
                <p className="text-sm text-muted" style={{ marginTop: 8, lineHeight: 1.65 }}>{feature.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-tight">
        <div className="page">
          <div className="step-list">
            {STEPS.map((step, index) => (
              <article key={step.title} className="step-card">
                <span className="step-num">{index + 1}</span>
                <h3 style={{ fontSize: '0.95rem' }}>{step.title}</h3>
                <p className="text-sm text-muted" style={{ marginTop: 8, lineHeight: 1.65 }}>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="page">
          <div className="banner banner-warn">
            <Icon name="alert" size={16} />
            <div>
              <strong>What KOVA does not do yet</strong>
              <p className="text-sm" style={{ marginTop: 6, lineHeight: 1.65 }}>
                Builds are not executed and no preview URL is issued until the Cloudflare deployment
                provider is integrated. Deployments stay in the queue with provider state
                <code className="mono"> not_configured</code>, and the interface says so on every screen.
                KOVA never displays a fake success state or a fabricated live link.
              </p>
              <Link to="/docs#limits" className="text-sm" style={{ display: 'inline-flex', gap: 6, marginTop: 10 }}>
                Read the limits and lifetimes <Icon name="arrow-right" size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section-tight" style={{ paddingBottom: 80 }}>
        <div className="page">
          <div className="cta-band">
            <div>
              <h2 style={{ fontSize: '1.5rem', letterSpacing: '-0.02em' }}>Start with a submission, not a promise.</h2>
              <p className="text-sm text-muted" style={{ marginTop: 10, maxWidth: '55ch' }}>
                Create an account, submit a project and watch KOVA validate it, queue it and report the
                real provider state.
              </p>
            </div>
            <div className="row gap-3 wrap">
              <MarketingButton to={primaryTo} icon="arrow-right">Get started</MarketingButton>
              <MarketingButton to="/docs" variant="secondary">Read the docs</MarketingButton>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
