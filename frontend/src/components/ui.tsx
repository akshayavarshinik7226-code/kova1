import { useEffect, useId, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { STATUS_LABEL } from '../lib/format';
import type { DeploymentStatus } from '../lib/api';

/* ------------------------------- button ---------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  loading?: boolean;
  icon?: IconName;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  block = false,
  loading = false,
  icon,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    `btn-${variant}`,
    size !== 'md' ? `btn-${size}` : '',
    block ? 'btn-block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} disabled={disabled || loading} {...rest}>
      {loading ? <span className="spinner" aria-hidden="true" /> : icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

/* -------------------------------- badge ---------------------------------- */

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'success' | 'warn' | 'danger' | 'info';
  dot?: boolean;
}) {
  return (
    <span className={`badge ${tone !== 'neutral' ? `badge-${tone}` : ''}`}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}

export function DemoTag({ label = 'Demo data' }: { label?: string }) {
  return <span className="demo-tag" title="Seeded example record, not a real submission">{label}</span>;
}

/* ----------------------------- status pill -------------------------------- */

export function StatusPill({ status, compact = false }: { status: DeploymentStatus; compact?: boolean }) {
  return (
    <span className={`pill pill-${status}`} title={STATUS_LABEL[status]}>
      <span className="pill-dot" />
      {compact ? STATUS_LABEL[status] : STATUS_LABEL[status]}
    </span>
  );
}

/* -------------------------------- fields --------------------------------- */

interface FieldProps {
  label?: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, hint, error, required, htmlFor, children, className = '' }: FieldProps) {
  const generatedId = useId();
  const id = htmlFor ?? generatedId;
  return (
    <div className={`field ${className}`}>
      {label && (
        <label className="field-label" htmlFor={id}>
          {label}
          {required && <span className="req" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <span className="field-error" role="alert">
          <Icon name="alert" size={12} />
          {error}
        </span>
      ) : (
        hint && <span className="field-hint">{hint}</span>
      )}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props;
  return <input className={`input ${className}`} {...rest} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = '', ...rest } = props;
  return <textarea className={`textarea ${className}`} {...rest} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', children, ...rest } = props;
  return (
    <select className={`select ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
}) {
  return (
    <div className="input-affix">
      <Icon name="search" />
      <input
        className="input"
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

/* --------------------------------- cards --------------------------------- */

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="card-header">
      <div>
        <h3>{title}</h3>
        {subtitle && <p className="text-xs text-muted" style={{ marginTop: 3 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  foot,
  icon,
}: {
  label: string;
  value: ReactNode;
  foot?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="stat">
      <div className="stat-label">
        {label}
        {icon && (
          <span className="stat-icon">
            <Icon name={icon} />
          </span>
        )}
      </div>
      <div className="stat-value">{value}</div>
      {foot && <div className="stat-foot">{foot}</div>}
    </div>
  );
}

/* --------------------------------- avatar -------------------------------- */

export function Avatar({
  name,
  color = 'violet',
  size = 'md',
}: {
  name: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const classes = ['avatar', `avatar-${color}`, size !== 'md' ? `avatar-${size}` : ''].filter(Boolean).join(' ');
  return (
    <span className={classes} aria-hidden="true">
      {letters || '?'}
    </span>
  );
}

/* -------------------------------- states --------------------------------- */

export function EmptyState({
  icon = 'box',
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="state-block">
      <span className="state-icon">
        <Icon name={icon} size={19} />
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  title = 'Something went wrong',
}: {
  message: string;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div className="state-block state-danger">
      <span className="state-icon">
        <Icon name="alert" size={19} />
      </span>
      <h3>{title}</h3>
      <p>{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function LoadingState({ rows = 4, label = 'Loading', variant = 'rows' }: {
  rows?: number;
  label?: string;
  variant?: 'rows' | 'cards' | 'center';
}) {
  if (variant === 'center') {
    return (
      <div className="center" style={{ padding: 56, gap: 10, flexDirection: 'column', color: 'var(--text-muted)' }}>
        <span className="spinner spinner-lg" />
        <span className="text-sm">{label}…</span>
      </div>
    );
  }
  return (
    <div aria-busy="true" aria-label={label} style={{ display: 'grid', gap: 10 }}>
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="skeleton" style={{ height: variant === 'cards' ? 96 : 46, borderRadius: 12 }} />
      ))}
    </div>
  );
}

/* --------------------------------- modal --------------------------------- */

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  width = 520,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: 'rgba(4, 5, 9, 0.62)',
        backdropFilter: 'blur(3px)',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="fade-in"
        style={{
          width: '100%',
          maxWidth: width,
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          outline: 'none',
        }}
      >
        <div className="card-header">
          <div>
            <h3 style={{ fontSize: 15 }}>{title}</h3>
            {description && <p className="text-xs text-muted" style={{ marginTop: 4 }}>{description}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close dialog" className="btn-icon">
            <Icon name="x" size={15} />
          </Button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
        {footer && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------- toasts --------------------------------- */

export function ToastStack() {
  return null;
}

export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: { id: number; variant: 'success' | 'error' | 'info'; message: string }[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.variant}`}>
          <Icon name={toast.variant === 'error' ? 'alert' : toast.variant === 'info' ? 'info' : 'check'} />
          <span>{toast.message}</span>
          <button type="button" className="toast-close" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
            <Icon name="x" size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------- utilities ------------------------------- */

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      icon={copied ? 'check' : 'copy'}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        } catch {
          setCopied(false);
        }
      }}
      aria-label={`${label} ${value}`}
    >
      {copied ? 'Copied' : label}
    </Button>
  );
}

export function InfoBanner({
  tone = 'info',
  icon = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warn' | 'accent';
  icon?: IconName;
  title?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={`banner banner-${tone}`}>
      <Icon name={icon} />
      <div>
        {title && <strong>{title} </strong>}
        {children}
      </div>
    </div>
  );
}

export function Spinner({ large = false }: { large?: boolean }) {
  return <span className={`spinner ${large ? 'spinner-lg' : ''}`} role="status" aria-label="Loading" />;
}
