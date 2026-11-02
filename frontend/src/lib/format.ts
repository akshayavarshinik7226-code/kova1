import type { ApiUser, DeploymentStatus } from './api';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = ['violet', 'cyan', 'mint', 'amber', 'rose', 'slate'] as const;

export function avatarColorFor(seed: string): string {
  let total = 0;
  for (let i = 0; i < seed.length; i += 1) total += seed.charCodeAt(i);
  return AVATAR_COLORS[total % AVATAR_COLORS.length];
}

export function colorFor(user: Pick<ApiUser, 'avatar_color' | 'email'>): string {
  return AVATAR_COLORS.includes(user.avatar_color as (typeof AVATAR_COLORS)[number])
    ? user.avatar_color
    : avatarColorFor(user.email || user.name || 'kova');
}

/** Parse the API's ISO timestamps (they are UTC but may omit the Z suffix). */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalised = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`;
  const date = new Date(normalised);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatShortDate(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTime(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return '—';
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatRelative(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return '—';
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  const future = seconds < 0;
  const abs = Math.abs(seconds);
  const units: [number, string][] = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.34, 'week'],
    [12, 'month'],
  ];
  let amount = abs;
  let unit = 'second';
  for (const [size, name] of units) {
    unit = name;
    if (amount < size) break;
    amount = amount / size;
  }
  if (abs < 45) return future ? 'in a few seconds' : 'just now';
  const rounded = Math.max(1, Math.round(amount));
  const label = `${rounded} ${unit}${rounded === 1 ? '' : 's'}`;
  return future ? `in ${label}` : `${label} ago`;
}

export const STATUS_LABEL: Record<DeploymentStatus, string> = {
  queued: 'Queued',
  building: 'Building',
  ready: 'Ready',
  failed: 'Failed',
  canceled: 'Canceled',
  expired: 'Expired',
};

export const STATUS_MEANING: Record<DeploymentStatus, string> = {
  queued: 'Waiting in the deployment queue — no build infrastructure is connected yet.',
  building: 'A build provider is compiling this project.',
  ready: 'Deployment finished and a live URL exists.',
  failed: 'The build failed. Check the logs for the reported error.',
  canceled: 'Canceled before it left the queue.',
  expired: 'The 24-hour preview lifetime elapsed and the URL was retired.',
};

export const ENVIRONMENTS = ['preview', 'production'] as const;

export function githubRepoName(url: string): string | null {
  const match = url.trim().match(/github\.com[/:]([^/\s]+)\/([^/\s#?]+)/i);
  if (!match) return null;
  return `${match[1]}/${match[2].replace(/\.git$/i, '')}`;
}

export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}
