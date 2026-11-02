import { useState } from 'react';
import { PageHead } from '../../components/AppLayout';
import { Card, CardHeader, EmptyState, ErrorState, LoadingState, Select } from '../../components/ui';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';

const RANGES = [7, 14, 30];

export function AdminUsage() {
  const [days, setDays] = useState(14);
  const state = useAsync(() => api.admin.usage(days), [days]);

  if (state.loading) return <LoadingState rows={4} label="Loading usage statistics" />;
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;
  if (!state.data) return <EmptyState icon="chart" title="No usage data" description="The usage endpoint returned no data." />;

  const data = state.data;
  const peak = Math.max(1, ...data.deployments_by_day.map((point) => point.count));
  const total = data.deployments_by_day.reduce((sum, point) => sum + point.count, 0);
  const sources = Object.entries(data.projects_by_source);

  return (
    <div className="stack gap-4 fade-in">
      <PageHead
        eyebrow="Administration"
        title="Usage"
        description="Aggregated from stored records — no live telemetry or estimated numbers."
        actions={
          <Select aria-label="Range" value={String(days)} onChange={(event) => setDays(Number(event.target.value))}>
            {RANGES.map((value) => (
              <option key={value} value={value}>Last {value} days</option>
            ))}
          </Select>
        }
      />

      <div className="stat-grid">
        <div className="stat">
          <span className="stat-label">Deployments requested</span>
          <span className="stat-value">{total}</span>
          <span className="stat-foot">In the last {data.range_days} days</span>
        </div>
        <div className="stat">
          <span className="stat-label">Busiest day</span>
          <span className="stat-value">{peak}</span>
          <span className="stat-foot">Single-day maximum</span>
        </div>
        <div className="stat">
          <span className="stat-label">Preview lifetime</span>
          <span className="stat-value">{data.limits?.preview_ttl_hours ?? 24}h</span>
          <span className="stat-foot">Deployments expire after this window</span>
        </div>
        <div className="stat">
          <span className="stat-label">Max upload</span>
          <span className="stat-value">{data.limits?.max_upload_mb ?? 20} MB</span>
          <span className="stat-foot">ZIP submissions</span>
        </div>
      </div>

      <Card>
        <CardHeader title="Deployments per day" subtitle={`${data.range_days}-day window`} />
        <div className="card-body">
          <div className="chart" role="img" aria-label={`Deployments per day for the last ${data.range_days} days`}>
            {data.deployments_by_day.map((point) => (
              <div
                key={point.date}
                className="chart-bar"
                style={{ height: `${Math.max(4, Math.round((point.count / peak) * 100))}%` }}
                title={`${point.date}: ${point.count} deployment${point.count === 1 ? '' : 's'}`}
              />
            ))}
          </div>
          <div className="chart-labels">
            {data.deployments_by_day.map((point) => (
              <span key={point.date} className="text-xs text-dim">{point.date.slice(5)}</span>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid-2">
        <Card>
          <CardHeader title="Projects by source" subtitle="GitHub URL vs ZIP upload." />
          <div className="card-body stack gap-2">
            {sources.length === 0 ? (
              <p className="text-muted text-sm">No projects have been submitted yet.</p>
            ) : (
              sources.map(([key, count]) => (
                <div key={key} className="legend-row">
                  <span className="text-sm">{key}</span>
                  <span className="legend-value">{count}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Most active students" subtitle="Ranked by deployment count." />
          <div className="card-body stack gap-2">
            {data.top_students.length === 0 ? (
              <p className="text-muted text-sm">No student activity recorded.</p>
            ) : (
              data.top_students.map((student) => (
                <div key={student.id} className="legend-row">
                  <div className="stack" style={{ minWidth: 0 }}>
                    <span className="text-sm truncate">{student.name}</span>
                    <span className="text-xs text-dim truncate">{student.email}</span>
                  </div>
                  <span className="text-xs text-dim">{student.projects}p · {student.deployments}d</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
