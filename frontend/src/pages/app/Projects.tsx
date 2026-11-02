import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHead } from '../../components/AppLayout';
import {
  Badge,
  Button,
  Card,
  DemoTag,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Modal,
  SearchInput,
  StatusPill,
  Textarea,
} from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import type { Project } from '../../lib/api';
import { formatRelative, githubRepoName } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

type SourceFilter = 'all' | 'github' | 'zip';
type Mode = 'github' | 'zip';

interface FormErrors {
  name?: string;
  repo_url?: string;
  branch?: string;
  file?: string;
}

const BRANCH_RE = /^[A-Za-z0-9._\-/]{1,80}$/;

export function StudentProjects() {
  const { notify } = useToast();
  const state = useAsync(() => api.projects(), []);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<SourceFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('github');

  const [name, setName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  const projects: Project[] = state.data ?? [];
  const term = search.trim().toLowerCase();
  const visible = projects.filter((project) => {
    if (source !== 'all' && project.source_type !== source) return false;
    if (!term) return true;
    return (
      project.name.toLowerCase().includes(term) ||
      project.description.toLowerCase().includes(term) ||
      (project.repo_url ?? '').toLowerCase().includes(term)
    );
  });

  function resetForm() {
    setName('');
    setRepoUrl('');
    setBranch('main');
    setDescription('');
    setFile(null);
    setErrors({});
  }

  function closeModal() {
    setModalOpen(false);
    resetForm();
  }

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (name.trim().length < 2) next.name = 'Give the project a name of at least 2 characters.';
    if (mode === 'github') {
      const trimmed = repoUrl.trim();
      if (!trimmed) next.repo_url = 'A GitHub repository URL is required.';
      else if (!/^https?:\/\/(www\.)?github\.com\/[^/\s]+\/[^/\s]+\/?$/i.test(trimmed)) {
        next.repo_url = 'Use a repository URL such as https://github.com/user/repo.';
      }
      if (!BRANCH_RE.test(branch.trim())) next.branch = 'Branch names may only contain letters, numbers, dot, dash, underscore or slash.';
    } else if (!file) {
      next.file = 'Select a .zip archive to upload.';
    } else if (!file.name.toLowerCase().endsWith('.zip')) {
      next.file = 'Only .zip archives are supported.';
    } else if (file.size > 25 * 1024 * 1024) {
      next.file = 'Archives must be 25 MB or smaller.';
    }
    return next;
  }

  async function submit() {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const project =
        mode === 'github'
          ? await api.createGithubProject({
              name: name.trim(),
              repo_url: repoUrl.trim(),
              branch: branch.trim() || 'main',
              description: description.trim(),
            })
          : await (async () => {
              const form = new FormData();
              form.set('name', name.trim());
              form.set('description', description.trim());
              form.set('file', file as File);
              return api.createZipProject(form);
            })();

      notify({
        tone: 'success',
        title: 'Project submitted',
        message:
          mode === 'github'
            ? 'The repository was validated and added to your workspace.'
            : 'The archive was inspected and added to your workspace.',
      });
      closeModal();
      state.reload();
      return project;
    } catch (error) {
      notify({
        tone: 'danger',
        title: 'Submission rejected',
        message: error instanceof Error ? error.message : 'The project could not be created.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function remove(project: Project) {
    if (!window.confirm(`Delete "${project.name}"? This also removes its deployments.`)) return;
    try {
      await api.deleteProject(project.id);
      notify({ tone: 'success', title: 'Project deleted', message: `${project.name} was removed.` });
      state.reload();
    } catch (error) {
      notify({
        tone: 'danger',
        title: 'Delete failed',
        message: error instanceof Error ? error.message : 'The project could not be deleted.',
      });
    }
  }

  return (
    <div className="page">
      <PageHead
        eyebrow="Workspace"
        title="My Projects"
        description="Every project you submit is validated before it can be queued for deployment."
        actions={
          <Button variant="primary" icon="plus" onClick={() => setModalOpen(true)}>
            New project
          </Button>
        }
      />

      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search projects…" ariaLabel="Search projects" />
        <div className="filter-tabs" role="group" aria-label="Filter by source">
          {(['all', 'github', 'zip'] as SourceFilter[]).map((option) => (
            <button
              key={option}
              type="button"
              className={`filter-tab ${source === option ? 'is-active' : ''}`}
              aria-pressed={source === option}
              onClick={() => setSource(option)}
            >
              {option === 'all' ? 'All sources' : option === 'github' ? 'GitHub' : 'ZIP archive'}
            </button>
          ))}
        </div>
      </div>

      {state.loading && <LoadingState rows={5} label="Loading projects" />}

      {!state.loading && state.error && (
        <ErrorState title="Projects unavailable" message={state.error} onRetry={state.reload} />
      )}

      {!state.loading && !state.error && projects.length === 0 && (
        <EmptyState
          icon="box"
          title="No projects yet"
          description="Submit a GitHub repository URL or upload a ZIP archive to create your first project."
          action={
            <Button variant="primary" icon="plus" onClick={() => setModalOpen(true)}>
              Submit a project
            </Button>
          }
        />
      )}

      {!state.loading && !state.error && projects.length > 0 && visible.length === 0 && (
        <EmptyState
          icon="search"
          title="No matching projects"
          description="Adjust your search or source filter to see more results."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setSearch('');
                setSource('all');
              }}
            >
              Clear filters
            </Button>
          }
        />
      )}

      {!state.loading && !state.error && visible.length > 0 && (
        <Card className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Source</th>
                <th>Deployments</th>
                <th>Last status</th>
                <th>Updated</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {visible.map((project) => {
                const repo = project.repo_url ? githubRepoName(project.repo_url) : null;
                return (
                  <tr key={project.id}>
                    <td>
                      <div className="cell-stack">
                        <Link className="cell-title" to={`/app/projects/${project.id}`}>
                          {project.name}
                        </Link>
                        <span className="cell-sub">
                          {project.source_type === 'github'
                            ? repo ?? project.repo_url
                            : project.zip_filename ?? 'ZIP archive'}
                          {project.is_demo && <DemoTag />}
                        </span>
                      </div>
                    </td>
                    <td>
                      <Badge tone={project.source_type === 'github' ? 'info' : 'accent'} dot>
                        {project.source_type === 'github' ? 'GitHub' : 'ZIP'}
                      </Badge>
                    </td>
                    <td className="num">{project.deployment_count}</td>
                    <td>
                      {project.last_deployment_status ? (
                        <StatusPill status={project.last_deployment_status} compact />
                      ) : (
                        <span className="text-xs text-muted">Never queued</span>
                      )}
                    </td>
                    <td className="text-sm text-muted">{formatRelative(project.updated_at)}</td>
                    <td>
                      <div className="row-actions">
                        <Link className="btn btn-ghost btn-sm" to={`/app/projects/${project.id}/settings`}>
                          <Icon name="settings" />
                          Settings
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon="trash"
                          aria-label={`Delete ${project.name}`}
                          onClick={() => remove(project)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <Modal
        open={modalOpen}
        title="Submit a project"
        description="KOVA validates the source before anything is queued. Deployments stay in a pending state until the Cloudflare provider is connected."
        onClose={closeModal}
        width={560}
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} icon={mode === 'github' ? 'github' : 'upload'} onClick={submit}>
              {mode === 'github' ? 'Validate repository' : 'Upload archive'}
            </Button>
          </>
        }
      >
        <div className="filter-tabs" role="tablist" aria-label="Submission source">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'github'}
            className={`filter-tab ${mode === 'github' ? 'is-active' : ''}`}
            onClick={() => {
              setMode('github');
              setErrors({});
            }}
          >
            GitHub repository
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'zip'}
            className={`filter-tab ${mode === 'zip' ? 'is-active' : ''}`}
            onClick={() => {
              setMode('zip');
              setErrors({});
            }}
          >
            ZIP upload
          </button>
        </div>

        <Field label="Project name" required htmlFor="project-name" error={errors.name}>
          <Input
            id="project-name"
            value={name}
            invalid={Boolean(errors.name)}
            placeholder="Campus timetable"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        {mode === 'github' ? (
          <>
            <Field
              label="GitHub repository URL"
              required
              htmlFor="project-repo"
              error={errors.repo_url}
              hint="Public repository in the form https://github.com/owner/repository"
            >
              <Input
                id="project-repo"
                value={repoUrl}
                invalid={Boolean(errors.repo_url)}
                placeholder="https://github.com/ada/timetable"
                onChange={(event) => setRepoUrl(event.target.value)}
              />
            </Field>
            <Field label="Branch" required htmlFor="project-branch" error={errors.branch} hint="Defaults to main.">
              <Input
                id="project-branch"
                value={branch}
                invalid={Boolean(errors.branch)}
                placeholder="main"
                onChange={(event) => setBranch(event.target.value)}
              />
            </Field>
          </>
        ) : (
          <Field
            label="ZIP archive"
            required
            htmlFor="project-file"
            error={errors.file}
            hint="Up to 25 MB. Archives are inspected for index.html, package.json or requirements.txt."
          >
            <input
              id="project-file"
              className={`input ${errors.file ? 'is-invalid' : ''}`}
              type="file"
              accept=".zip,application/zip"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </Field>
        )}

        <Field label="Description" htmlFor="project-desc" hint="Optional — helps you recognise the project later.">
          <Textarea
            id="project-desc"
            rows={3}
            maxLength={400}
            value={description}
            placeholder="What does this project do?"
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
      </Modal>
    </div>
  );
}
