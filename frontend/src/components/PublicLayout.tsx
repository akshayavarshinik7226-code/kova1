import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icon, LogoMark } from './Icon';
import { Button } from './ui';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/features', label: 'Features' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/docs', label: 'Docs' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
];

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      data-testid="theme-toggle"
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={compact ? 15 : 16} />
    </button>
  );
}

function MarketingNav() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <header className="topnav">
      <div className="topnav-inner">
        <Link to="/" className="brand" aria-label="KOVA home">
          <span className="brand-mark"><LogoMark /></span>
          <span className="brand-name">KOVA</span>
        </Link>

        <nav className="nav-links" aria-label="Main">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="nav-actions">
          <ThemeToggle />
          {user ? (
            <Link to={user.role === 'admin' ? '/admin' : '/app'} className="btn btn-primary btn-sm">
              Open dashboard
              <Icon name="arrow-right" size={14} />
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">Sign in</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Get started</Link>
            </>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-icon nav-toggle"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label="Toggle navigation menu"
          >
            <Icon name={open ? 'x' : 'menu'} size={17} />
          </button>
        </div>
      </div>

      <div className={`mobile-menu${open ? ' open' : ''}`}>
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            {item.label}
          </NavLink>
        ))}
        {!user && (
          <NavLink to="/login" className="nav-link">Sign in</NavLink>
        )}
      </div>
    </header>
  );
}

function MarketingFooter() {
  const { user } = useAuth();
  return (
    <footer className="footer">
      <div className="page">
        <div className="footer-grid">
          <div>
            <Link to="/" className="brand">
              <span className="brand-mark"><LogoMark /></span>
              <span className="brand-name">KOVA</span>
            </Link>
            <p className="text-sm text-muted" style={{ marginTop: 12, maxWidth: '34ch' }}>
              The deployment platform built for student projects. Submit a repository or ZIP, then
              follow every deployment from queue to build.
            </p>
            <div className="row gap-2 wrap" style={{ marginTop: 14 }}>
              <span className="badge badge-warn">Cloudflare: pending integration</span>
            </div>
          </div>
          <div className="footer-col">
            <h4>Platform</h4>
            <Link className="footer-link" to="/features">Features</Link>
            <Link className="footer-link" to="/how-it-works">How it works</Link>
            <Link className="footer-link" to="/docs">Documentation</Link>
          </div>
          <div className="footer-col">
            <h4>Support</h4>
            <Link className="footer-link" to="/faq">FAQ</Link>
            <Link className="footer-link" to="/contact">Contact</Link>
            <Link className="footer-link" to="/docs#limits">Limits &amp; lifetimes</Link>
          </div>
          <div className="footer-col">
            <h4>Account</h4>
            {user ? (
              <>
                <Link className="footer-link" to={user.role === 'admin' ? '/admin' : '/app'}>Dashboard</Link>
                <Link className="footer-link" to="/app/notifications">Notifications</Link>
                <Link className="footer-link" to="/app/profile">Profile</Link>
              </>
            ) : (
              <>
                <Link className="footer-link" to="/login">Sign in</Link>
                <Link className="footer-link" to="/register">Create account</Link>
                <Link className="footer-link" to="/docs#accounts">Accounts</Link>
              </>
            )}
          </div>
        </div>
        <div className="footer-bottom">
          <span>KOVA · Stage 1 interface &amp; control plane</span>
          <span>
            Deployments queue honestly — no build runs until the provider integration ships.
          </span>
        </div>
      </div>
    </footer>
  );
}

export function PublicLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="public-shell">
      <MarketingNav />
      <main id="main">{children ?? <Outlet />}</main>
      <MarketingFooter />
    </div>
  );
}

export function PublicPage({
  eyebrow,
  title,
  lede,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  lede?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="page">
      <div style={{ paddingTop: 56, paddingBottom: 40, maxWidth: 780 }}>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 style={{ marginTop: 10 }}>{title}</h1>
        {lede && <p className="lede" style={{ marginTop: 14 }}>{lede}</p>}
        {actions && <div className="row gap-3 wrap" style={{ marginTop: 24 }}>{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <aside className="auth-side">
        <Link to="/" className="brand" style={{ position: 'relative', zIndex: 1 }}>
          <span className="brand-mark"><LogoMark /></span>
          <span className="brand-name">KOVA</span>
        </Link>
        <div style={{ margin: 'auto 0', position: 'relative', zIndex: 1, maxWidth: 420 }}>
          <p className="eyebrow">Student project deployment</p>
          <h2 style={{ marginTop: 12, fontSize: '1.8rem', letterSpacing: '-0.03em' }}>
            From repository to a queued deployment in one flow.
          </h2>
          <p className="text-sm text-muted" style={{ marginTop: 14, lineHeight: 1.7 }}>
            KOVA validates submissions, tracks every deployment attempt and shows exactly what the
            platform is waiting on. Nothing is reported as live until it truly is.
          </p>
          <div className="stack gap-3" style={{ marginTop: 28 }}>
            {[
              { icon: 'github' as const, text: 'GitHub repository or ZIP archive submissions' },
              { icon: 'queue' as const, text: 'Transparent deployment queue with positions' },
              { icon: 'shield' as const, text: 'Role-based access for students and admins' },
            ].map((item) => (
              <div key={item.text} className="row gap-3 text-sm text-muted">
                <span className="stat-icon" style={{ flexShrink: 0 }}>
                  <Icon name={item.icon} />
                </span>
                {item.text}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-dim" style={{ position: 'relative', zIndex: 1 }}>
          Stage 1 · interface and control plane. Build execution is pending Cloudflare integration.
        </p>
      </aside>
      <section className="auth-form-wrap">
        <div className="auth-card">{children}</div>
      </section>
    </div>
  );
}

export function MarketingButton({
  to,
  children,
  variant = 'primary',
  size = 'lg',
  icon,
}: {
  to: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: 'arrow-right' | 'github' | 'plus';
}) {
  return (
    <Link to={to} className={`btn btn-${variant}${size !== 'md' ? ` btn-${size}` : ''}`}>
      {children}
      {icon && <Icon name={icon} size={15} />}
    </Link>
  );
}

export { Button };
