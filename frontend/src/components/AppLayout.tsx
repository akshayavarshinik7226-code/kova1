import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon, LogoMark } from './Icon';
import type { IconName } from './Icon';
import { Avatar, Button } from './ui';
import { ThemeToggle } from './PublicLayout';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { Notification } from '../lib/api';
import { avatarColorFor, formatRelative } from '../lib/format';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const STUDENT_NAV: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { to: '/app', label: 'Overview', icon: 'grid', end: true },
      { to: '/app/projects', label: 'My projects', icon: 'box' },
      { to: '/app/deployments', label: 'Deployments', icon: 'layers' },
    ],
  },
  {
    label: 'Ship',
    items: [
      { to: '/app/deployments/new', label: 'New deployment', icon: 'rocket' },
      { to: '/app/docs', label: 'Documentation', icon: 'book' },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/app/notifications', label: 'Notifications', icon: 'bell' },
      { to: '/app/profile', label: 'Profile settings', icon: 'user' },
    ],
  },
];

const ADMIN_NAV: NavGroup[] = [
  {
    label: 'Monitor',
    items: [
      { to: '/admin', label: 'Overview', icon: 'grid', end: true },
      { to: '/admin/queue', label: 'Deployment queue', icon: 'queue' },
      { to: '/admin/failed', label: 'Failed builds', icon: 'alert' },
      { to: '/admin/activity', label: 'Activity log', icon: 'activity' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { to: '/admin/students', label: 'Students', icon: 'users' },
      { to: '/admin/projects', label: 'Projects', icon: 'box' },
      { to: '/admin/deployments', label: 'Deployments', icon: 'layers' },
      { to: '/admin/messages', label: 'Contact messages', icon: 'mail' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { to: '/admin/usage', label: 'Usage', icon: 'chart' },
      { to: '/admin/system', label: 'System status', icon: 'cpu' },
    ],
  },
];

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';
  const groups = isAdmin ? ADMIN_NAV : STUDENT_NAV;

  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <>
      {open && <div className="sidebar-scrim" onClick={onClose} aria-hidden="true" />}
      <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Dashboard navigation">
        <div className="sidebar-head">
          <Link to="/" className="brand">
            <span className="brand-mark"><LogoMark /></span>
            <span className="brand-name">KOVA</span>
          </Link>
          <span className={`badge ${isAdmin ? 'badge-accent' : ''}`} style={{ marginLeft: 'auto' }}>
            {isAdmin ? 'Admin' : 'Student'}
          </span>
        </div>

        <div className="sidebar-scroll">
          {groups.map((group) => (
            <div key={group.label} className="nav-group">
              <p className="nav-group-label">{group.label}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        <div className="sidebar-foot">
          <div className="row gap-2" style={{ justifyContent: 'space-between' }}>
            <div className="row gap-2" style={{ minWidth: 0 }}>
              <Avatar name={user?.name ?? 'K'} color={avatarColorFor(user?.id ?? 'k')} size="sm" />
              <div style={{ minWidth: 0 }}>
                <div className="text-sm truncate" style={{ fontWeight: 550 }}>{user?.name ?? 'Signed out'}</div>
                <div className="text-xs text-dim truncate">{user?.email ?? '—'}</div>
              </div>
            </div>
            <ThemeToggle compact />
          </div>
          <div className="row gap-2" style={{ marginTop: 10 }}>
            {!isAdmin && user && (
              <Link to="/app/deployments/new" className="btn btn-primary btn-sm btn-block">
                <Icon name="plus" size={14} />
                New deploy
              </Link>
            )}
            <Button
              variant="ghost"
              size="sm"
              icon="logout"
              aria-label="Sign out"
              onClick={() => {
                signOut();
                navigate('/login');
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}

function NotificationBell() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const wrapRef = useRef<HTMLDivElement>(null);

  const loadCount = useCallback(async () => {
    try {
      const list = await api.notifications(true);
      setCount(list.length);
    } catch {
      /* badge is non-critical; ignore transient errors */
    }
  }, []);

  useEffect(() => {
    void loadCount();
  }, [loadCount, location.pathname]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setState('loading');
    api
      .notifications()
      .then((list) => {
        if (!active) return;
        setItems(list.slice(0, 6));
        setState('idle');
      })
      .catch(() => {
        if (active) setState('error');
      });
    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!user) return null;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn btn-ghost btn-icon"
        aria-label={`Notifications${count > 0 ? `, ${count} unread` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        style={{ position: 'relative' }}
      >
        <Icon name="bell" />
        {count > 0 && <span className="notif-dot" />}
      </button>

      {open && (
        <div className="popover" style={{ right: 0, left: 'auto', width: 320 }}>
          <div className="popover-head">
            <span>Notifications</span>
            {count > 0 && <span className="badge badge-accent">{count} new</span>}
          </div>
          <div className="popover-body" style={{ maxHeight: 320, overflowY: 'auto' }}>
            {state === 'loading' && <p className="text-sm text-muted" style={{ padding: 14 }}>Loading notifications…</p>}
            {state === 'error' && <p className="text-sm text-muted" style={{ padding: 14 }}>Could not load notifications.</p>}
            {state === 'idle' && items.length === 0 && (
              <p className="text-sm text-muted" style={{ padding: 14 }}>No notifications yet.</p>
            )}
            {state === 'idle' &&
              items.map((item) => (
                <Link
                  key={item.id}
                  to={item.link ?? '/app/notifications'}
                  className={`notif-item${item.is_read ? '' : ' notif-unread'}`}
                  onClick={() => setOpen(false)}
                >
                  <div className="row gap-2" style={{ justifyContent: 'space-between' }}>
                    <strong className="text-sm">{item.title}</strong>
                    <span className="text-xs text-dim">{formatRelative(item.created_at)}</span>
                  </div>
                  <p className="text-xs text-muted" style={{ marginTop: 4 }}>{item.body}</p>
                </Link>
              ))}
          </div>
          <div className="popover-foot">
            <Link to="/app/notifications" className="btn btn-ghost btn-sm btn-block" onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function AccountMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!user) return null;
  const isAdmin = user.role === 'admin';

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn btn-ghost"
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        style={{ paddingLeft: 6, paddingRight: 8 }}
      >
        <Avatar name={user.name} color={avatarColorFor(user.id)} size="sm" />
        <span className="text-sm" style={{ fontWeight: 550 }}>{user.name.split(' ')[0]}</span>
        <Icon name="chevron-down" size={14} />
      </button>

      {open && (
        <div className="popover" style={{ right: 0, left: 'auto', width: 250 }}>
          <div className="menu-head">
            <strong className="text-sm">{user.name}</strong>
            <div className="text-xs text-dim truncate">{user.email}</div>
          </div>
          <div style={{ padding: 6 }}>
            {isAdmin ? (
              <NavLink to="/admin" className="menu-item">
                <Icon name="grid" /> Admin overview
              </NavLink>
            ) : (
              <>
                <NavLink to="/app" className="menu-item">
                  <Icon name="grid" /> Dashboard
                </NavLink>
                <NavLink to="/app/profile" className="menu-item">
                  <Icon name="settings" /> Profile settings
                </NavLink>
              </>
            )}
            <Link to={isAdmin ? '/admin/system' : '/app/docs'} className="menu-item">
              <Icon name="book" /> {isAdmin ? 'System status' : 'Documentation'}
            </Link>
            <div className="menu-sep" />
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                signOut();
                navigate('/login');
              }}
            >
              <Icon name="logout" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const TITLES: { match: RegExp; label: string }[] = [
  { match: /^\/app\/?$/, label: 'Overview' },
  { match: /^\/app\/projects\/[^/]+\/settings$/, label: 'Project settings' },
  { match: /^\/app\/projects$/, label: 'My projects' },
  { match: /^\/app\/deployments\/new$/, label: 'New deployment' },
  { match: /^\/app\/deployments\/[^/]+\/logs$/, label: 'Build logs' },
  { match: /^\/app\/deployments\/[^/]+$/, label: 'Deployment details' },
  { match: /^\/app\/deployments$/, label: 'Deployments' },
  { match: /^\/app\/notifications$/, label: 'Notifications' },
  { match: /^\/app\/profile$/, label: 'Profile settings' },
  { match: /^\/app\/docs$/, label: 'Documentation' },
  { match: /^\/admin\/?$/, label: 'Admin overview' },
  { match: /^\/admin\/students$/, label: 'Students' },
  { match: /^\/admin\/projects$/, label: 'Projects' },
  { match: /^\/admin\/deployments$/, label: 'Deployments' },
  { match: /^\/admin\/queue$/, label: 'Deployment queue' },
  { match: /^\/admin\/failed$/, label: 'Failed builds' },
  { match: /^\/admin\/activity$/, label: 'Activity log' },
  { match: /^\/admin\/usage$/, label: 'Usage' },
  { match: /^\/admin\/system$/, label: 'System status' },
  { match: /^\/admin\/messages$/, label: 'Contact messages' },
];

export function AppLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const title = TITLES.find((entry) => entry.match.test(location.pathname))?.label ?? 'Dashboard';
  const isAdmin = user?.role === 'admin';

  return (
    <div className="app-shell">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="app-main">
        <header className="app-topbar">
          <button
            type="button"
            className="btn btn-ghost btn-icon nav-toggle"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <Icon name="menu" size={17} />
          </button>
          <div className="crumbs">
            <Link to={isAdmin ? '/admin' : '/app'}>{isAdmin ? 'Admin' : 'Workspace'}</Link>
            <Icon name="chevron-right" size={12} />
            <span style={{ color: 'var(--text)' }}>{title}</span>
          </div>
          <div className="row gap-2" style={{ marginLeft: 'auto' }}>
            <span className="badge badge-warn" style={{ display: 'inline-flex' }} title="Deployments are queued only until the provider integration ships">
              Provider: pending
            </span>
            <ThemeToggle />
            <NotificationBell />
            <AccountMenu />
          </div>
        </header>
        <main className="app-content" id="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PageHead({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div style={{ minWidth: 0 }}>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 style={{ fontSize: '1.45rem', letterSpacing: '-0.02em', marginTop: eyebrow ? 6 : 0 }}>{title}</h1>
        {description && <p className="text-sm text-muted" style={{ marginTop: 6, maxWidth: '70ch' }}>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function SectionHead({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginBottom: 12 }}>
      <div>
        <h2 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{title}</h2>
        {description && <p className="text-xs text-muted" style={{ marginTop: 3 }}>{description}</p>}
      </div>
      {actions}
    </div>
  );
}
