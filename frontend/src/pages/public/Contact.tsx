import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { MarketingButton, PublicPage } from '../../components/PublicLayout';
import { Button, Card, CardHeader, Field, Input, Select, Textarea } from '../../components/ui';
import { api, ApiError } from '../../lib/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TOPICS = ['General question', 'Bug report', 'Account access', 'Deployment issue', 'Feature request'];

interface FormState {
  name: string;
  email: string;
  topic: string;
  message: string;
}

const EMPTY: FormState = { name: '', email: '', topic: TOPICS[0], message: '' };

export function Contact() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ id: string } | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Your name is required.';
    if (!form.email.trim()) next.email = 'Email is required.';
    else if (!EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid email address.';
    if (form.message.trim().length < 12) next.message = 'Please write at least 12 characters.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSending(true);
    try {
      const result = await api.contact({
        name: form.name.trim(),
        email: form.email.trim(),
        topic: form.topic,
        message: form.message.trim(),
      });
      setSent({ id: result.id });
      setForm(EMPTY);
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Could not reach the KOVA API. Try again in a moment.';
      setErrors({ form: message });
    } finally {
      setSending(false);
    }
  };

  return (
    <PublicPage
      eyebrow="Contact"
      title="Talk to the team behind KOVA"
      lede="Bug reports, account questions and access requests all land in the same admin inbox — every message is stored, nothing is auto-deleted."
      actions={<MarketingButton to="/docs" variant="secondary">Read the docs first</MarketingButton>}
    >
      <div className="contact-grid" style={{ paddingBottom: 80 }}>
        <Card>
          <CardHeader title="Send a message" subtitle="Fields marked required must be filled in." />
          {sent ? (
            <div className="stack gap-4" style={{ padding: 24 }}>
              <div className="banner banner-info">
                <Icon name="check" size={16} />
                <p className="text-sm">
                  Message received. Your reference is <code className="mono">{sent.id.slice(0, 8)}</code> and it is
                  now visible to admins in the messages view.
                </p>
              </div>
              <div className="row gap-3 wrap">
                <Button variant="secondary" onClick={() => setSent(null)}>
                  Send another message
                </Button>
                <Link to="/" className="text-sm">
                  Back to home
                </Link>
              </div>
            </div>
          ) : (
            <form className="stack gap-4" style={{ padding: 24 }} onSubmit={onSubmit} noValidate>
              {errors.form && (
                <div className="banner banner-warn" role="alert">
                  <p className="text-sm">{errors.form}</p>
                </div>
              )}
              <div className="form-row">
                <Field label="Name" htmlFor="contact-name" required error={errors.name}>
                  <Input id="contact-name" autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} invalid={Boolean(errors.name)} />
                </Field>
                <Field label="Email" htmlFor="contact-email" required error={errors.email}>
                  <Input id="contact-email" type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} invalid={Boolean(errors.email)} />
                </Field>
              </div>
              <Field label="Topic" htmlFor="contact-topic" required>
                <Select id="contact-topic" value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })}>
                  {TOPICS.map((topic) => (
                    <option key={topic} value={topic}>
                      {topic}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Message" htmlFor="contact-message" required error={errors.message} hint="Describe what happened, what you expected, and any deployment ID involved.">
                <Textarea
                  id="contact-message"
                  rows={7}
                  value={form.message}
                  onChange={(event) => setForm({ ...form, message: event.target.value })}
                  invalid={Boolean(errors.message)}
                />
              </Field>
              <Button type="submit" variant="primary" loading={sending} icon="mail">
                Send message
              </Button>
            </form>
          )}
        </Card>

        <div className="stack gap-4">
          <Card>
            <div style={{ padding: 22 }}>
              <span className="feature-icon">
                <Icon name="clock" size={18} />
              </span>
              <h3 style={{ margin: '14px 0 8px', fontSize: 16 }}>Response expectations</h3>
              <p className="text-sm text-muted">
                KOVA is a student-stage platform, so replies are made during working sessions rather than
                around the clock. Account access issues are handled first.
              </p>
            </div>
          </Card>
          <Card>
            <div style={{ padding: 22 }}>
              <span className="feature-icon">
                <Icon name="info" size={18} />
              </span>
              <h3 style={{ margin: '14px 0 8px', fontSize: 16 }}>Deployment problems</h3>
              <p className="text-sm text-muted">
                Build execution is pending the Cloudflare provider integration. A deployment that stays
                queued is expected behaviour in this stage, not a support incident.
              </p>
              <p className="text-sm" style={{ marginTop: 12 }}>
                <Link to="/faq">See the FAQ</Link>
              </p>
            </div>
          </Card>
        </div>
      </div>
    </PublicPage>
  );
}
