import React from 'react';
import { Link } from 'react-router-dom';
import type { JobWithDetails } from '../lib/types';
import ScoreBadge from './ScoreBadge';
import ActionButtons from './ActionButtons';

interface Props {
  job: JobWithDetails;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function isNew(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() < 24 * 60 * 60 * 1000;
}

const REMOTE_LABEL: Record<string, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'Onsite',
  unknown: '',
};

const SENIORITY_LABEL: Record<string, string> = {
  intern: 'Intern',
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
  staff: 'Staff',
  principal: 'Principal',
  manager: 'Manager',
  director: 'Director',
  unknown: '',
};

function priorityTier(score: number): 'high' | 'medium' | null {
  if (score >= 85) return 'high';
  if (score >= 70) return 'medium';
  return null;
}

export default function JobCard({ job }: Props) {
  const score = job.scores[0] ?? null;
  const remoteLabel = REMOTE_LABEL[job.remoteType ?? 'unknown'] ?? '';
  const seniorityLabel = SENIORITY_LABEL[job.seniorityGuess ?? 'unknown'] ?? '';
  const currentAction = job.userActions[0]?.action ?? null;
  const fresh = isNew(job.postedAt);
  const tier = score ? priorityTier(score.score) : null;

  const topReasons = score?.matchReasons?.slice(0, 2) ?? [];
  const topGap = score?.missingSignals?.[0] ?? null;
  const hasSignals = topReasons.length > 0 || topGap !== null;

  return (
    <article className={`job-card ${currentAction === 'IGNORED' ? 'job-card--ignored' : ''}`}>
      <div className="job-card-top">
        <div className="job-card-left">
          <div className="job-card-meta">
            <span className="job-company">{job.company}</span>
            {fresh && <span className="badge--new">New</span>}
          </div>

          <Link to={`/jobs/${job.id}`} className="job-title-link">
            <h3 className="job-title">{job.title}</h3>
          </Link>
        </div>

        {score && (
          <div className="job-card-right">
            {tier === 'high' && <span className="priority-badge priority-badge--high">HIGH</span>}
            {tier === 'medium' && <span className="priority-badge priority-badge--medium">MED</span>}
            <ScoreBadge score={score} />
          </div>
        )}
      </div>

      <div className="job-details">
        {job.location && <span>{job.location}</span>}
        {remoteLabel && (
          <span className={`badge badge--remote badge--${job.remoteType}`}>
            {remoteLabel}
          </span>
        )}
        {seniorityLabel && seniorityLabel !== 'Mid' && (
          <span className="badge badge--seniority">{seniorityLabel}</span>
        )}
        {job.postedAt && (
          <span className="job-age">{timeAgo(job.postedAt)}</span>
        )}
      </div>

      {hasSignals && (
        <div className="card-signals">
          {topReasons.map((reason, i) => (
            <span key={i} className="card-signal card-signal--match">
              <span className="card-signal-icon">✓</span>
              {reason}
            </span>
          ))}
          {topGap && (
            <span className="card-signal card-signal--gap">
              <span className="card-signal-icon">⚠</span>
              {topGap}
            </span>
          )}
        </div>
      )}

      {!hasSignals && job.tags.length > 0 && (
        <div className="job-tags">
          {[...new Set(job.tags)].slice(0, 5).map((tag) => (
            <span key={tag} className="job-tag">{tag}</span>
          ))}
        </div>
      )}

      <ActionButtons job={job} />
    </article>
  );
}
