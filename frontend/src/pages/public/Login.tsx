import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/PublicLayout';
import { Button, Field, Input, InfoBanner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ApiError } from '../../lib/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Login() {
  const { signIn } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'Email is required.';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Password is required.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      const user = await signIn(email.trim(), password);
      notify(`Signed in as ${user.name}.`, 'success');
      const fallback = user.role === 'admin' ? '/admin' : '/app';
      navigate(location.state?.from ?? fallback, { replace: true });
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Could not reach the KOVA API. Try again in a moment.';
      setErrors({ form: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="auth-title">Sign in to KOVA</h1>
      <p className="auth-sub">Deployments, build logs and project settings for your student account.</p>

      <form className="stack gap-4" onSubmit={onSubmit} noValidate>
        {errors.form && (
          <div className="banner banner-warn" role="alert">
            <p className="text-sm">{errors.form}</p>
          </div>
        )}
        <Field label="Email" htmlFor="login-email" required error={errors.email}>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@university.edu"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            invalid={Boolean(errors.email)}
          />
        </Field>
        <Field label="Password" htmlFor="login-password" required error={errors.password}>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            invalid={Boolean(errors.password)}
          />
        </Field>
        <Button type="submit" variant="primary" block loading={submitting}>
          Sign in
        </Button>
      </form>

      <p className="auth-alt text-sm text-muted">
        No account yet? <Link to="/register">Create a student account</Link>
      </p>

      <div style={{ marginTop: 22 }}>
        <InfoBanner tone="info" icon="shield" title="Demo accounts">
          <p className="text-sm text-muted">
            Seeded for review — DEMO DATA. Student: <code className="mono">student@kova.dev</code> /{' '}
            <code className="mono">KovaDemo123!</code>. Admin: <code className="mono">admin@kova.dev</code> /{' '}
            <code className="mono">KovaAdmin123!</code>
          </p>
        </InfoBanner>
      </div>
    </AuthLayout>
  );
}
