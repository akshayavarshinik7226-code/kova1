/**
 * Typed client for the KOVA control-plane API.
 *
 * Every call goes through `request()` so auth headers, JSON handling and error
 * normalisation (FastAPI's `detail` shapes) behave the same everywhere.
 */

const TOKEN_KEY = 'kova.token';

export type Role = 'student' | 'admin';
export type DeploymentStatus = 'queued' | 'building' | 'ready' | 'failed' | 'canceled' | 'expired';

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: 'active' | 'suspended';
  university: string | null;
  bio: string | null;
  avatar_color: string;
  notify_deployments: boolean;
  notify_product: boolean;
  is_demo: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface StudentAdmin extends ApiUser {
  project_count: number;
  deployment_count: number;
  queued_count: number;
}

export interface ProviderInfo {
  name: string;
  label: string;
  configured: boolean;
  blocked_reason: string | null;
}

export interface Project {
  id: string;
  owner_id: string;
  owner_name: string;
  owner_email: string;
  name: string;
  slug: string;
  description: string;
  source_type: 'github' | 'zip';
  repo_url: string | null;
  repo_branch: string | null;
  framework: string | null;
  zip_filename: string | null;
  archive_entries: number;
  status: string;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  deployment_count: number;
  last_deployment_status: DeploymentStatus | null;
  last_deployment_at: string | null;
}

export interface Deployment {
  id: string;
  project_id: string;
  project_name: string;
  owner_id: string;
  owner_name: string;
  status: DeploymentStatus;
  environment: string;
  commit_ref: string | null;
  source_label: string;
  provider: string;
  provider_state: string;
  blocked_reason: string | null;
  preview_url: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  queue_position: number | null;
  is_demo: boolean;
}

export interface LogEntry {
  id: string;
  ts: string;
  level: 'info' | 'warn' | 'error';
  step: string;
  message: string;
}

export interface DeploymentDetail extends Deployment {
  logs: LogEntry[];
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface ActivityEvent {
  id: string;
  actor_name: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail: string;
  created_at: string;
}

export interface PlatformMeta {
  name: string;
  version: string;
  stage: string;
  preview_ttl_hours: number;
  deploy_provider: ProviderInfo;
  demo_enabled: boolean;
  features: Record<string, boolean>;
}

export interface AdminOverview {
  totals: Record<string, number>;
  status_breakdown: Record<string, number>;
  source_breakdown: Record<string, number>;
  recent_deployments: Deployment[];
  recent_activity: ActivityEvent[];
  queue: Deployment[];
  provider: ProviderInfo;
}

export interface UsageStats {
  range_days: number;
  deployments_by_day: { date: string; count: number }[];
  projects_by_source: Record<string, number>;
  top_students: { id: string; name: string; email: string; projects: number; deployments: number }[];
  limits?: { max_upload_mb: number; preview_ttl_hours: number };
}

export interface SystemStatus {
  version: string;
  environment: string;
  database: string;
  deploy_provider: ProviderInfo;
  preview_ttl_hours: number;
  messaging?: Record<string, string>;
  storage?: Record<string, string | number>;
  notes?: string[];
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  status: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: ApiUser;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage can be unavailable in private mode; the session simply won't persist */
  }
}

function messageFromBody(body: unknown, status: number): string {
  if (typeof body === 'string' && body.trim()) return body;
  if (body && typeof body === 'object') {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      const parts = detail.map((item) => {
        if (item && typeof item === 'object') {
          const msg = (item as { msg?: string }).msg;
          const loc = (item as { loc?: unknown[] }).loc;
          const field = Array.isArray(loc) ? loc[loc.length - 1] : undefined;
          if (typeof msg === 'string') {
            const clean = msg.replace(/^Value error,\s*/i, '');
            return typeof field === 'string' ? `${field}: ${clean}` : clean;
          }
        }
        return typeof item === 'string' ? item : '';
      });
      const joined = parts.filter(Boolean).join(' · ');
      if (joined) return joined;
    }
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You do not have access to this resource.';
  if (status === 404) return 'Not found.';
  if (status >= 500) return 'The KOVA API hit an unexpected error. Please try again.';
  return `Request failed (${status}).`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Accept', 'application/json');

  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...init, headers });
  } catch {
    throw new ApiError('Cannot reach the KOVA API. Check that the server is running.', 0);
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const body: unknown = isJson ? await response.json().catch(() => null) : await response.text();

  if (!response.ok) {
    throw new ApiError(messageFromBody(body, response.status), response.status);
  }
  return body as T;
}

type Query = Record<string, string | number | boolean | null | undefined>;

function query(params: Query): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  university?: string;
}

export interface ProjectGithubInput {
  name: string;
  repo_url: string;
  branch: string;
  description: string;
}

export interface ProfileUpdateInput {
  name?: string;
  university?: string;
  bio?: string;
  notify_deployments?: boolean;
  notify_product?: boolean;
  avatar_color?: string;
}

export const api = {
  /* --- platform ------------------------------------------------------- */
  meta: () => request<PlatformMeta>('/meta'),
  health: () => request<{ status: string; version: string }>('/health'),

  /* --- auth ----------------------------------------------------------- */
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (input: RegisterInput) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  me: () => request<ApiUser>('/auth/me'),
  updateProfile: (input: ProfileUpdateInput) =>
    request<ApiUser>('/auth/me', { method: 'PATCH', body: JSON.stringify(input) }),
  changePassword: (current_password: string, new_password: string) =>
    request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password, new_password }),
    }),

  /* --- projects ------------------------------------------------------- */
  projects: (params: { search?: string; source?: string; status?: string } = {}) =>
    request<Project[]>(`/projects${query(params)}`),
  project: (id: string) => request<Project>(`/projects/${id}`),
  createGithubProject: (input: ProjectGithubInput) =>
    request<Project>('/projects/github', { method: 'POST', body: JSON.stringify(input) }),
  createZipProject: (form: FormData) =>
    request<Project>('/projects/zip', { method: 'POST', body: form }),
  updateProject: (
    id: string,
    input: Partial<{ name: string; description: string; branch: string; status: string }>,
  ) => request<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteProject: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),

  /* --- deployments ---------------------------------------------------- */
  deployments: (params: { status?: string; project_id?: string; search?: string; limit?: number } = {}) =>
    request<Deployment[]>(`/deployments${query(params)}`),
  deployment: (id: string) => request<DeploymentDetail>(`/deployments/${id}`),
  createDeployment: (input: { project_id: string; commit_ref?: string; environment?: string }) =>
    request<DeploymentDetail>('/deployments', { method: 'POST', body: JSON.stringify(input) }),
  cancelDeployment: (id: string) =>
    request<Deployment>(`/deployments/${id}/cancel`, { method: 'POST' }),
  retryDeployment: (id: string) => request<Deployment>(`/deployments/${id}/retry`, { method: 'POST' }),

  /* --- notifications -------------------------------------------------- */
  notifications: (unreadOnly = false) =>
    request<Notification[]>(`/notifications${query({ unread_only: unreadOnly })}`),
  readAllNotifications: () => request<{ message: string }>('/notifications/read-all', { method: 'POST' }),
  readNotification: (id: string) => request<Notification>(`/notifications/${id}/read`, { method: 'POST' }),
  deleteNotification: (id: string) => request<void>(`/notifications/${id}`, { method: 'DELETE' }),

  /* --- public --------------------------------------------------------- */
  contact: (input: { name: string; email: string; topic: string; message: string }) =>
    request<{ id: string; status: string }>('/contact', { method: 'POST', body: JSON.stringify(input) }),

  /* --- admin ---------------------------------------------------------- */
  admin: {
    overview: () => request<AdminOverview>('/admin/overview'),
    students: (params: { search?: string; status?: string } = {}) =>
      request<StudentAdmin[]>(`/admin/students${query(params)}`),
    updateStudent: (id: string, input: { status?: string; role?: string }) =>
      request<ApiUser>(`/admin/students/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    deleteStudent: (id: string) => request<void>(`/admin/students/${id}`, { method: 'DELETE' }),
    projects: (params: { search?: string; source?: string; status?: string } = {}) =>
      request<Project[]>(`/admin/projects${query(params)}`),
    updateProject: (id: string, input: { name?: string; description?: string; branch?: string; status?: string }) =>
      request<Project>(`/admin/projects/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    deleteProject: (id: string) => request<void>(`/admin/projects/${id}`, { method: 'DELETE' }),
    deployments: (params: { status?: string; search?: string; limit?: number } = {}) =>
      request<Deployment[]>(`/admin/deployments${query(params)}`),
    queue: () => request<{ items: Deployment[]; provider: ProviderInfo; note: string }>('/admin/queue'),
    failed: () => request<{ items: Deployment[]; note: string }>('/admin/failed'),
    cancelDeployment: (id: string) =>
      request<Deployment>(`/admin/deployments/${id}/cancel`, { method: 'POST' }),
    activity: (limit = 80) => request<ActivityEvent[]>(`/admin/activity${query({ limit })}`),
    usage: (days = 14) => request<UsageStats>(`/admin/usage${query({ days })}`),
    system: () => request<SystemStatus>('/admin/system'),
    messages: () => request<ContactMessage[]>('/admin/messages'),
    updateMessage: (id: string, status: string) =>
      request<ContactMessage>(`/admin/messages/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  },
};
