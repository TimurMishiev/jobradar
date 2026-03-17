import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { JobFeedResponse, JobWithDetails, TrackerStage } from '../lib/types';
import ScoreBadge from '../components/ScoreBadge';

const STAGES: TrackerStage[] = ['SAVED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'];

const STAGE_LABEL: Record<TrackerStage, string> = {
  SAVED:     'Saved',
  APPLIED:   'Applied',
  INTERVIEW: 'Interview',
  OFFER:     'Offer',
  REJECTED:  'Rejected',
};

const STALE_STAGES = new Set<TrackerStage>(['APPLIED', 'INTERVIEW']);
const STALE_DAYS = 14;

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function timeAgo(dateStr: string): string {
  const days = daysAgo(dateStr);
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

function exportCSV(columns: { stage: TrackerStage; jobs: JobWithDetails[] }[]) {
  const rows: string[][] = [
    ['Company', 'Title', 'Stage', 'Score', 'Location', 'Remote', 'Notes', 'Stage Date'],
  ];
  for (const { stage, jobs } of columns) {
    for (const job of jobs) {
      const action = job.userActions[0];
      rows.push([
        `"${job.company.replace(/"/g, '""')}"`,
        `"${job.title.replace(/"/g, '""')}"`,
        STAGE_LABEL[stage],
        String(job.scores[0]?.score ?? ''),
        `"${(job.location ?? '').replace(/"/g, '""')}"`,
        job.remoteType ?? '',
        `"${(action?.notes ?? '').replace(/"/g, '""')}"`,
        action?.updatedAt ? new Date(action.updatedAt).toISOString().slice(0, 10) : '',
      ]);
    }
  }
  const csv = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `job-tracker-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Kanban card ──────────────────────────────────────────────────────────────

interface KanbanCardProps {
  job: JobWithDetails;
  stage: TrackerStage;
}

function KanbanCard({ job, stage }: KanbanCardProps) {
  const queryClient = useQueryClient();
  const action = job.userActions[0];
  const score = job.scores[0] ?? null;
  const stageIdx = STAGES.indexOf(stage);
  const isStale = STALE_STAGES.has(stage) && action?.updatedAt && daysAgo(action.updatedAt) >= STALE_DAYS;

  const [editingNote, setEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(action?.notes ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
    queryClient.invalidateQueries({ queryKey: ['digest'] });
  };

  const moveStage = useMutation({
    mutationFn: (newStage: TrackerStage) =>
      apiFetch(`/api/jobs/${job.id}/action`, {
        method: 'POST',
        body: JSON.stringify({ action: newStage }),
      }),
    onSuccess: invalidate,
  });

  const removeAction = useMutation({
    mutationFn: () => apiFetch<void>(`/api/jobs/${job.id}/action`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  const saveNote = useMutation({
    mutationFn: (notes: string) =>
      apiFetch(`/api/jobs/${job.id}/notes`, {
        method: 'PATCH',
        body: JSON.stringify({ notes }),
      }),
  });

  const handleNoteBlur = () => {
    setEditingNote(false);
    if (noteValue !== (action?.notes ?? '')) {
      saveNote.mutate(noteValue);
    }
  };

  const startEditNote = () => {
    setEditingNote(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const prevStage = stageIdx > 0 ? STAGES[stageIdx - 1] : null;
  const nextStage = stageIdx < STAGES.length - 1 ? STAGES[stageIdx + 1] : null;

  return (
    <div className={`kanban-card ${isStale ? 'kanban-card--stale' : ''}`}>
      <div className="kanban-card-header">
        <div className="kanban-card-info">
          <span className="kanban-card-company">{job.company}</span>
          <Link to={`/jobs/${job.id}`} className="kanban-card-title">{job.title}</Link>
          <div className="kanban-card-meta">
            {job.location && <span>{job.location}</span>}
            {job.remoteType && job.remoteType !== 'unknown' && (
              <span className={`badge badge--remote badge--${job.remoteType}`} style={{ fontSize: 10, padding: '1px 5px' }}>
                {job.remoteType}
              </span>
            )}
          </div>
        </div>
        <div className="kanban-card-right">
          {score && <ScoreBadge score={score} />}
          <button
            className="kanban-card-remove"
            onClick={() => removeAction.mutate()}
            disabled={removeAction.isPending}
            title="Remove from tracker"
          >
            ×
          </button>
        </div>
      </div>

      <div className="kanban-card-age">
        {action?.updatedAt && (
          <>
            <span>{timeAgo(action.updatedAt)}</span>
            {isStale && (
              <span className="kanban-stale-badge">⏱ {daysAgo(action.updatedAt)}d here</span>
            )}
          </>
        )}
      </div>

      <div className="kanban-card-note" onClick={!editingNote ? startEditNote : undefined}>
        {editingNote ? (
          <textarea
            ref={textareaRef}
            className="kanban-note-input"
            value={noteValue}
            onChange={(e) => setNoteValue(e.target.value)}
            onBlur={handleNoteBlur}
            placeholder="Add a note…"
            rows={2}
          />
        ) : (
          <span className={noteValue ? 'kanban-note-text' : 'kanban-note-placeholder'}>
            {noteValue || 'Add a note…'}
          </span>
        )}
      </div>

      <div className="kanban-card-actions">
        {prevStage && (
          <button
            className="kanban-stage-btn kanban-stage-btn--prev"
            onClick={() => moveStage.mutate(prevStage)}
            disabled={moveStage.isPending}
          >
            ← {STAGE_LABEL[prevStage]}
          </button>
        )}
        {nextStage && (
          <button
            className="kanban-stage-btn kanban-stage-btn--next"
            onClick={() => moveStage.mutate(nextStage)}
            disabled={moveStage.isPending}
          >
            {STAGE_LABEL[nextStage]} →
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SavedPage() {
  const queries = useQueries({
    queries: STAGES.map((stage) => ({
      queryKey: ['jobs', { action: stage }],
      queryFn: () =>
        apiFetch<JobFeedResponse>(`/api/jobs?action=${stage}&limit=200&postedWithin=all`),
      staleTime: 60_000,
    })),
  });

  const columns = STAGES.map((stage, i) => ({
    stage,
    jobs: queries[i].data?.data ?? [],
    isLoading: queries[i].isLoading,
  }));

  const totalTracked = columns
    .filter((c) => c.stage !== 'REJECTED')
    .reduce((sum, c) => sum + c.jobs.length, 0);

  const allJobs = columns.flatMap(({ stage, jobs }) => jobs.map((job) => ({ stage, job })));

  return (
    <div className="tracker-page">
      <div className="page-header">
        <h2 className="page-title">Tracker</h2>
        <div className="page-header-actions">
          <span className="page-count">{totalTracked} active</span>
          {allJobs.length > 0 && (
            <button
              className="btn-secondary"
              onClick={() => exportCSV(columns)}
            >
              Export CSV
            </button>
          )}
        </div>
      </div>

      <div className="kanban-board">
        {columns.map(({ stage, jobs, isLoading }) => (
          <div key={stage} className="kanban-column">
            <div className="kanban-column-header">
              <span className="kanban-column-title">{STAGE_LABEL[stage]}</span>
              {jobs.length > 0 && (
                <span className="kanban-column-count">{jobs.length}</span>
              )}
            </div>

            <div className="kanban-column-body">
              {isLoading && <p className="kanban-loading">Loading…</p>}
              {!isLoading && jobs.length === 0 && (
                <p className="kanban-empty">
                  {stage === 'SAVED' ? 'Save jobs from the feed' : '—'}
                </p>
              )}
              {jobs
                .slice()
                .sort((a, b) => {
                  const aDate = a.userActions[0]?.updatedAt ?? '';
                  const bDate = b.userActions[0]?.updatedAt ?? '';
                  return bDate.localeCompare(aDate);
                })
                .map((job) => (
                  <KanbanCard key={job.id} job={job} stage={stage} />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
