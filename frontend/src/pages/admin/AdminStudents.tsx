import { useState } from 'react';
import { PageHead } from '../../components/AppLayout';
import { Icon } from '../../components/Icon';
import { Avatar, Badge, Button, EmptyState, ErrorState, Input, LoadingState, Select } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { colorFor, formatRelative } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

export function AdminStudents() {
  const { notify } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const state = useAsync(() => api.admin.students({ search, status }), [search, status]);

  async function setStudentStatus(id: string, next: 'active' | 'suspended') {
    setBusyId(id);
    try {
      await api.admin.updateStudent(id, { status: next });
      notify({ tone: 'success', message: `Student ${next === 'suspended' ? 'suspended' : 'reactivated'}.` });
      state.reload();
    } catch (error) {
      notify({
        tone: 'danger',
        title: 'Update failed',
        message: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setBusyId(null);
    }
  }

  const students = state.data ?? [];

  return (
    <div className="stack gap-4 fade-in">
      <PageHead eyebrow="Administration" title="Students" description="Search accounts, review activity and moderate access." />

      <div className="toolbar">
        <div className="toolbar-search">
          <Input
            type="search"
            placeholder="Search by name or email"
            aria-label="Search students"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </Select>
      </div>

      {state.loading && <LoadingState rows={5} label="Loading students" />}
      {state.error && !state.loading && <ErrorState message={state.error} onRetry={state.reload} />}

      {!state.loading && !state.error && students.length === 0 && (
        <EmptyState icon="users" title="No students match" description="Adjust the search term or status filter." />
      )}

      {!state.loading && !state.error && students.length > 0 && (
        <div className="table-wrap card">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">University</th>
                <th scope="col">Projects</th>
                <th scope="col">Deployments</th>
                <th scope="col">Status</th>
                <th scope="col">Last login</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td>
                    <div className="row gap-2" style={{ minWidth: 0 }}>
                      <Avatar name={student.name} color={colorFor(student)} size="sm" />
                      <div className="stack" style={{ minWidth: 0 }}>
                        <span className="text-sm truncate">{student.name}</span>
                        <span className="text-xs text-dim truncate">{student.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="text-sm text-muted">{student.university ?? '—'}</td>
                  <td className="text-sm">{student.project_count}</td>
                  <td className="text-sm">
                    {student.deployment_count}
                    {student.queued_count > 0 && <span className="text-xs text-dim"> · {student.queued_count} queued</span>}
                  </td>
                  <td>
                    <Badge tone={student.status === 'active' ? 'success' : 'danger'} dot>{student.status}</Badge>
                  </td>
                  <td className="text-xs text-dim">{formatRelative(student.last_login_at)}</td>
                  <td>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={busyId === student.id}
                      onClick={() => setStudentStatus(student.id, student.status === 'active' ? 'suspended' : 'active')}
                    >
                      <Icon name={student.status === 'active' ? 'pause' : 'play'} size={14} />
                      {student.status === 'active' ? 'Suspend' : 'Activate'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
