import { Icon } from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { MarketingButton, PublicPage } from '../../components/PublicLayout';

interface FeatureGroup {
  icon: IconName;
  title: string;
  body: string;
  points: string[];
}

const GROUPS: FeatureGroup[] = [
  {
    icon: 'github',
    title: 'Submission',
    body: 'Two supported sources, one validated pipeline.',
    points: [
      'GitHub repository URL with host validation and branch selection',
      'ZIP archive upload with server-side archive inspection',
      'Duplicate project names rejected per account',
      'Source metadata stored and shown on every project card',
    ],
  },
  {
    icon: 'queue',
    title: 'Deployment queue',
    body: 'Positions are computed from the database, never simulated.',
    points: [
      'Queue position returned from the API for each deployment',
      'Environment selection (preview or production)',
      'Commit reference recorded when supplied',
      'Cancel and retry actions on eligible deployments',
    ],
  },
  {
    icon: 'terminal',
    title: 'Observability',
    body: 'Per-deployment logs and platform activity in one place.',
    points: [
      'Timestamped log entries with level and build step',
      'Dedicated full-page build log viewer',
      'Activity log of student and admin actions',
      'Usage summaries computed from stored records',
    ],
  },
  {
    icon: 'shield',
    title: 'Access control',
    body: 'Students and admins share a platform, not permissions.',
    points: [
      'Token auth with role checks on every admin route',
      'Students only ever see their own projects',
      'Ownership enforced server-side, not in the UI',
      'Profile and password management for every account',
    ],
  },
  {
    icon: 'sparkle',
    title: 'Interface',
    body: 'A developer platform that feels considered.',
    points: [
      'Dark theme default with a persisted light theme',
      'Consistent status pills for every deployment state',
      'Real loading, empty and error states on every page',
      'Responsive layouts down to small phone widths',
    ],
  },
  {
    icon: 'info',
    title: 'Honesty',
    body: 'Pending work is labelled, not hidden.',
    points: [
      'Cloudflare provider state surfaced as pending integration',
      'No fabricated preview URL anywhere in the UI',
      'Demo records tagged with a demo badge',
      'Explicit explanation of what is not yet executed',
    ],
  },
];

export function Features() {
  return (
    <PublicPage
      eyebrow="Features"
      title="Built for the parts of deployment students actually feel"
      lede="Validation, queueing, logging and administration are implemented end to end. Build execution is the next integration — and KOVA says so everywhere it matters."
      actions={<MarketingButton to="/register" icon="arrow-right">Create an account</MarketingButton>}
    >
      <div className="feature-grid" style={{ paddingBottom: 80 }}>
        {GROUPS.map((group) => (
          <article key={group.title} className="card card-pad">
            <div className="row gap-3">
              <span className="feature-icon"><Icon name={group.icon} size={18} /></span>
              <div>
                <h3 style={{ fontSize: '0.98rem' }}>{group.title}</h3>
                <p className="text-xs text-muted" style={{ marginTop: 4 }}>{group.body}</p>
              </div>
            </div>
            <ul className="docs-list" style={{ marginTop: 16 }}>
              {group.points.map((point) => (
                <li key={point} className="text-sm text-muted">{point}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </PublicPage>
  );
}
