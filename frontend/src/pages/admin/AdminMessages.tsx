import { useState } from 'react';
import { PageHead } from '../../components/AppLayout';
import { Icon } from '../../components/Icon';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, LoadingState, Select } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { api } from '../../lib/api';
import { formatDate, formatRelative } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

export function AdminMessages() {
  const { notify } = useToast();
  const [filter, setFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const state = useAsync(() => api.admin.messages(), []);

  async function setStatus(id: string, status: 'new' | 'resolved') {
    setBusyId(id);
    try {
      await api.admin.updateMessage(id, status);
      notify({ tone: 'success', message: status === 'resolved' ? 'Message resolved.' : 'Message reopened.' });
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

  if (state.loading) return <LoadingState rows={4} label="Loading messages" />;
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;

  const all = state.data ?? [];
  const messages = filter ? all.filter((message) => message.status === filter) : all;

  return (
    <div className="stack gap-4 fade-in">
      <PageHead
        eyebrow="Administration"
        title="Contact messages"
        description="Support requests submitted through the public contact form."
        actions={
          <Select aria-label="Filter messages" value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="">All messages</option>
            <option value="new">New</option>
            <option value="resolved">Resolved</option>
          </Select>
        }
      />

      {messages.length === 0 ? (
        <EmptyState
          icon="mail"
          title={all.length === 0 ? 'No messages yet' : 'No messages match the filter'}
          description={all.length === 0 ? 'Messages sent from the contact page appear here.' : 'Try a different filter.'}
        />
      ) : (
        <div className="stack gap-3">
          {messages.map((message) => (
            <Card key={message.id}>
              <CardHeader
                title={`${message.name} · ${message.topic}`}
                subtitle={`${message.email} · ${formatDate(message.created_at)}`}
                action={
                  <Badge tone={message.status === 'new' ? 'warn' : 'success'} dot>
                    {message.status}
                  </Badge>
                }
              />
              <div className="card-body stack gap-3">
                <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>{message.message}</p>
                <div className="row gap-2">
                  <span className="text-xs text-dim">{formatRelative(message.created_at)}</span>
                  <span className="spacer" />
                  {message.status === 'new' ? (
                    <Button variant="secondary" size="sm" loading={busyId === message.id} onClick={() => setStatus(message.id, 'resolved')}>
                      <Icon name="check" size={14} /> Mark resolved
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" loading={busyId === message.id} onClick={() => setStatus(message.id, 'new')}>
                      <Icon name="refresh" size={14} /> Reopen
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
