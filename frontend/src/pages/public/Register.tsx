import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/PublicLayout';
import { Button, Field, Input } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ApiError } from '../../lib/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormState {
  name: string;
  email: string;
  university: string;
  password: string;
  confirm: string;
}

const EMPTY: FormState = { name: '', email: '', university: '', password: '', confirm: '' };

export function Register() {
  const { signUp } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const update = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Your name is required.';
    else if (form.name.trim().length < 2) next.name = 'Use at least 2 characters.';
    if (!form.email.trim()) next.email = 'Email is required.';
    else if (!EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid email address.';
    if (form.password.length < 8) next.password = 'Use at least 8 characters.';
    if (form.confirm !== form.password) next.confirm = 'Passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      const user = await signUp({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        university: form.university.trim() || undefined,
      });
      notify(`Welcome to KOVA, ${user.name.split(' ')[0]}.`, 'success');
      navigate('/app', { replace: true });
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
      <h1 className="auth-title">Create your account</h1>
      <p className="auth-sub">Registration creates a student account. Admin access is provisioned separately.</p>

      <form className="stack gap-4" onSubmit={onSubmit} noValidate>
        {errors.form && (
          <div className="banner banner-warn" role="alert">
            <p className="text-sm">{errors.form}</p>
          </div>
        )}
        <Field label="Full name" htmlFor="reg-name" required error={errors.name}>
          <Input id="reg-name" autoComplete="name" placeholder="Ada Lovelace" value={form.name} onChange={update('name')} invalid={Boolean(errors.name)} />
        </Field>
        <Field label="Email" htmlFor="reg-email" required error={errors.email}>
          <Input id="reg-email" type="email" autoComplete="email" placeholder="you@university.edu" value={form.email} onChange={update('email')} invalid={Boolean(errors.email)} />
        </Field>
        <Field label="University" htmlFor="reg-university" hint="Optional — shown on your profile.">
          <Input id="reg-university" placeholder="University of Example" value={form.university} onChange={update('university')} />
        </Field>
        <Field label="Password" htmlFor="reg-password" required error={errors.password} hint="At least 8 characters.">
          <Input id="reg-password" type="password" autoComplete="new-password" placeholder="••••••••" value={form.password} onChange={update('password')} invalid={Boolean(errors.password)} />
        </Field>
        <Field label="Confirm password" htmlFor="reg-confirm" required error={errors.confirm}>
          <Input id="reg-confirm" type="password" autoComplete="new-password" placeholder="••••••••" value={form.confirm} onChange={update('confirm')} invalid={Boolean(errors.confirm)} />
        </Field>
        <Button type="submit" variant="primary" block loading={submitting}>
          Create account
        </Button>
      </form>

      <p className="auth-alt text-sm text-muted">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
