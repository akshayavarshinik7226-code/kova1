import { Icon } from '../../components/Icon';
import { MarketingButton, PublicPage } from '../../components/PublicLayout';
import { StatusPill } from '../../components/ui';

const STEPS = [
  {
    step: '01',
    title: 'Create your account',
    body: 'Register with a student email. Your account gets its own workspace where every project and deployment belongs to you.',
    detail: ['Password hashed with a salted algorithm', 'Session token stored client-side only', 'Admin accounts are provisioned separately'],
  },
  {
    step: '02',
    title: 'Submit a project',
    body: 'Choose GitHub and paste a repository URL with a branch, or upload a ZIP archive. KOVA validates the source before saving it.',
    detail: ['Repository host is validated', 'Archive contents inspected and counted', 'Duplicate names rejected with a clear error'],
  },
  {
    step: '03',
    title: 'Queue a deployment',
    body: 'Pick the project and an environment. KOVA creates the deployment record with a real queue position and a provider state.',
    detail: ['Queue position comes from stored records', 'Provider state is reported as not_configured', 'Notifications are generated for the event'],
  },
  {
    step: '04',
    title: 'Monitor the outcome',
    body: 'Follow status changes, read the build log, cancel or retry. Admins see the same deployment from the platform side.',
    detail: ['Logs are timestamped per step', 'Cancelled and failed states keep their reason', 'Preview URLs appear only when a provider returns one'],
  },
];

const STATE_MEANINGS = [
  { status: 'queued' as const, text: 'Waiting in the deployment queue. Nothing has been built yet.' },
  { status: 'building' as const, text: 'A build has been accepted and is running. Not produced by this stage.' },
  { status: 'ready' as const, text: 'A build finished and a URL exists. Requires the Cloudflare integration.' },
  { status: 'failed' as const, text: 'The build failed. The error code and message stay attached to the deployment.' },
  { status: 'canceled' as const, text: 'Cancelled by the student or an admin before completion.' },
];

export function HowItWorks() {
  return (
    <PublicPage
      eyebrow="How it works"
      title="Four steps, and every one of them is inspectable"
      lede="KOVA does not hand you a progress bar and hope. Each step writes real records you can read back: validated submission, queue position, log entries and status history."
      actions={<MarketingButton to="/register" icon="arrow-right">Start the flow</MarketingButton>}
    >
      <div className="stack gap-5" style={{ maxWidth: 900 }}>
        {STEPS.map((item) => (
          <article key={item.step} className="card card-pad">
            <div className="row gap-4" style={{ alignItems: 'flex-start' }}>
              <span className="step-num" style={{ flexShrink: 0 }}>{item.step}</span>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ fontSize: '1rem' }}>{item.title}</h3>
                <p className="text-sm text-muted" style={{ marginTop: 8, lineHeight: 1.7 }}>{item.body}</p>
                <ul className="docs-list" style={{ marginTop: 12 }}>
                  {item.detail.map((line) => (
                    <li key={line} className="text-sm text-muted">{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </div>

      <section style={{ marginTop: 48, marginBottom: 80 }}>
        <div className="section-head">
          <p className="eyebrow">Statuses</p>
          <h2 className="section-title">What each deployment status means</h2>
        </div>
        <div className="card">
          {STATE_MEANINGS.map((entry, index) => (
            <div
              key={entry.status}
              className="row gap-4"
              style={{
                padding: '14px 18px',
                borderTop: index === 0 ? 'none' : '1px solid var(--border)',
                alignItems: 'center',
              }}
            >
              <StatusPill status={entry.status} />
              <span className="text-sm text-muted">{entry.text}</span>
            </div>
          ))}
        </div>
        <div className="banner banner-info" style={{ marginTop: 20 }}>
          <Icon name="info" size={16} />
          <p className="text-sm">
            In this stage every new deployment stops at <strong>queued</strong> with provider state
            <code className="mono"> not_configured</code>. That is the honest state — not a bug.
          </p>
        </div>
      </section>
    </PublicPage>
  );
}
