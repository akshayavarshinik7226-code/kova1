import { useEffect, useState } from 'react';
import { PageHead } from '../../components/AppLayout';
import { Icon } from '../../components/Icon';
import { Avatar, Badge, Button, Card, CardHeader, Field, Input, Textarea } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { colorFor, formatDate } from '../../lib/format';

const COLORS = ['violet', 'cyan', 'mint', 'amber', 'rose', 'slate'];

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { notify } = useToast();

  const [name, setName] = useState(user?.name ?? '');
  const [university, setUniversity] = useState(user?.university ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [avatarColor, setAvatarColor] = useState(user?.avatar_color ?? 'violet');
  const [notifyDeployments, setNotifyDeployments] = useState(user?.notify_deployments ?? true);
  const [notifyProduct, setNotifyProduct] = useState(user?.notify_product ?? true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setUniversity(user.university ?? '');
    setBio(user.bio ?? '');
    setAvatarColor(user.avatar_color);
    setNotifyDeployments(user.notify_deployments);
    setNotifyProduct(user.notify_product);
  }, [user]);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2) {
      setFormError('Enter your full name (at least 2 characters).');
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const updated = await api.updateProfile({
        name: name.trim(),
        university: university.trim(),
        bio: bio.trim(),
        avatar_color: avatarColor,
        notify_deployments: notifyDeployments,
        notify_product: notifyProduct,
      });
      updateUser(updated);
      notify({ tone: 'success', title: 'Profile saved', message: 'Your details are up to date.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save your profile.';
      setFormError(message);
      notify({ tone: 'danger', title: 'Save failed', message });
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    if (next.length < 8) {
      setPwError('New password must be at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      setPwError('New passwords do not match.');
      return;
    }
    setPwError(null);
    setPwBusy(true);
    try {
      await api.changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      notify({ tone: 'success', title: 'Password changed', message: 'Use your new password next time you sign in.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not change your password.';
      setPwError(message);
      notify({ tone: 'danger', title: 'Change failed', message });
    } finally {
      setPwBusy(false);
    }
  }

  if (!user) return null;

  return (
    <div className="stack gap-5 fade-in">
      <PageHead eyebrow="Account" title="Profile settings" description="Update your details and how KOVA contacts you." />

      <Card>
        <div className="card-body row gap-4" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Avatar name={user.name} color={colorFor(user)} size="lg" />
          <div className="stack gap-1" style={{ minWidth: 0 }}>
            <div className="row gap-2">
              <strong>{user.name}</strong>
              {user.role === 'admin' && <Badge tone="accent">Admin</Badge>}
              <Badge tone={user.status === 'active' ? 'success' : 'danger'} dot>
                {user.status}
              </Badge>
            </div>
            <span className="text-sm text-muted">{user.email}</span>
            <span className="text-xs text-dim">Member since {formatDate(user.created_at)}</span>
          </div>
        </div>
      </Card>

      <div className="grid-2">
        <Card>
          <CardHeader title="Your details" subtitle="Shown on projects you submit." />
          <form className="card-body stack gap-3" onSubmit={saveProfile} noValidate>
            <Field label="Full name" htmlFor="profile-name">
              <Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} required />
            </Field>
            <Field label="Email" htmlFor="profile-email" hint="Contact support to change your sign-in email.">
              <Input id="profile-email" value={user.email} readOnly disabled />
            </Field>
            <Field label="University or school" htmlFor="profile-university">
              <Input id="profile-university" value={university} onChange={(event) => setUniversity(event.target.value)} />
            </Field>
            <Field label="Short bio" htmlFor="profile-bio" hint={`${bio.length}/280 characters`}>
              <Textarea
                id="profile-bio"
                value={bio}
                maxLength={280}
                rows={3}
                onChange={(event) => setBio(event.target.value)}
              />
            </Field>
            <Field label="Avatar colour">
              <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Use ${color} avatar`}
                    aria-pressed={avatarColor === color}
                    className="btn btn-icon btn-ghost"
                    style={{ outline: avatarColor === color ? '2px solid var(--accent)' : 'none', borderRadius: '50%' }}
                    onClick={() => setAvatarColor(color)}
                  >
                    <Avatar name={user.name} color={color} size="sm" />
                  </button>
                ))}
              </div>
            </Field>
            {formError && <p className="form-error" role="alert">{formError}</p>}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button type="submit" variant="primary" loading={saving}>
                <Icon name="check" size={14} /> Save changes
              </Button>
            </div>
          </form>
        </Card>

        <div className="stack gap-4">
          <Card>
            <CardHeader title="Notifications" subtitle="Choose which emails KOVA sends." />
            <div className="card-body stack gap-3">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={notifyDeployments}
                  onChange={(event) => setNotifyDeployments(event.target.checked)}
                />
                <span className="text-sm">Deployment and queue updates</span>
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={notifyProduct}
                  onChange={(event) => setNotifyProduct(event.target.checked)}
                />
                <span className="text-sm">Product announcements</span>
              </label>
              <p className="text-xs text-dim" style={{ margin: 0 }}>
                Preferences are saved with your profile and stored by the API.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Password" subtitle="Use at least 8 characters." />
            <form className="card-body stack gap-3" onSubmit={changePassword} noValidate>
              <Field label="Current password" htmlFor="pw-current">
                <Input
                  id="pw-current"
                  type="password"
                  autoComplete="current-password"
                  value={current}
                  onChange={(event) => setCurrent(event.target.value)}
                />
              </Field>
              <Field label="New password" htmlFor="pw-new">
                <Input
                  id="pw-new"
                  type="password"
                  autoComplete="new-password"
                  value={next}
                  onChange={(event) => setNext(event.target.value)}
                />
              </Field>
              <Field label="Confirm new password" htmlFor="pw-confirm">
                <Input
                  id="pw-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </Field>
              {pwError && <p className="form-error" role="alert">{pwError}</p>}
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <Button type="submit" variant="secondary" loading={pwBusy}>
                  <Icon name="lock" size={14} /> Update password
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
