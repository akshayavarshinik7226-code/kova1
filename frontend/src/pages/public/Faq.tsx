import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { MarketingButton, PublicPage } from '../../components/PublicLayout';

interface Question {
  q: string;
  a: string;
}

const QUESTIONS: Question[] = [
  {
    q: 'Can I get a live URL for my project today?',
    a: 'Not yet. KOVA validates and queues your deployment, but build execution requires the Cloudflare provider integration, which is the next stage. Until then every deployment reports provider state "not_configured" and no preview URL exists.',
  },
  {
    q: 'Why does my deployment stay in "queued"?',
    a: 'Because nothing has executed it yet. That is the honest state of the platform rather than a failure. When the provider integration ships, queued deployments become buildable without changing your workflow.',
  },
  {
    q: 'Which submission sources are supported?',
    a: 'A GitHub repository URL with a branch, or a ZIP archive upload. Both are validated server-side before a project is created, and both keep their source metadata visible on the project.',
  },
  {
    q: 'How is my project data isolated?',
    a: 'Every request is authorised against the owning account. A student can only read and modify their own projects and deployments; admins have read access across the platform for support and monitoring.',
  },
  {
    q: 'What does the "preview" environment mean?',
    a: 'Preview deployments are intended for short-lived review builds and are designed to expire after 24 hours. Production is the long-lived target. Expiry cleanup arrives with the provider integration.',
  },
  {
    q: 'Is the demo account real?',
    a: 'Yes — the seeded student and admin accounts are real database records on this deployment. They exist so the interface can be reviewed with data. Anything seeded is labelled DEMO DATA in the interface.',
  },
  {
    q: 'How do I become an admin?',
    a: 'Admin accounts are provisioned by the platform operator, not through public registration. Self-service registration always creates a student account.',
  },
  {
    q: 'Where can I see what happened to a deployment?',
    a: 'Open the deployment to see its status, queue position, provider state and full log stream. Admins additionally get a platform-wide activity log.',
  },
  {
    q: 'Do you store my password?',
    a: 'Only a salted hash produced by a password hashing algorithm. Plain-text passwords are never stored, and session tokens are issued per sign-in.',
  },
  {
    q: 'How do I report a bug or ask for an account change?',
    a: 'Use the contact form. Messages are stored with a topic and visible to admins in the messages view.',
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <PublicPage
      eyebrow="FAQ"
      title="Straight answers about how KOVA behaves"
      lede="If something on the platform looks unfinished, it is probably listed here with the reason."
      actions={<MarketingButton to="/contact" variant="secondary">Contact support</MarketingButton>}
    >
      <div className="stack gap-3" style={{ maxWidth: 860, paddingBottom: 80 }}>
        {QUESTIONS.map((item, index) => {
          const isOpen = open === index;
          return (
            <div key={item.q} className="card" style={{ overflow: 'hidden' }}>
              <button
                type="button"
                className="faq-trigger"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : index)}
              >
                <span>{item.q}</span>
                <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={16} />
              </button>
              {isOpen && <div className="faq-answer text-sm text-muted">{item.a}</div>}
            </div>
          );
        })}
        <div className="banner banner-info">
          <Icon name="mail" size={16} />
          <p className="text-sm">
            Still stuck? <Link to="/contact">Send a message</Link> and it will appear in the admin inbox.
          </p>
        </div>
      </div>
    </PublicPage>
  );
}
