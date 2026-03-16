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
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
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

export default function JobCard({ job }: Props) {
  const score = job.scores[0] ?? null;
  const remoteLabel = REMOTE_LABEL[job.remoteType ?? 'unknown'] ?? '';
  const seniorityLabel = SENIORITY_LABEL[job.seniorityGuess ?? 'unknown'] ?? '';
  const currentAction = job.userActions[0]?.action ?? null;

  return (
    <article className={`job-card ${currentAction === 'IGNORED' ? 'job-card--ignored' : ''}`}>
      <div className="job-card-header">
        <div className="job-card-meta">
          <span className="job-company">{job.company}</span>
          <span className="job-meta-sep">·</span>
          <span className="job-source">{job.sourceName}</span>
        </div>
        <ScoreBadge score={score} />
      </div>

      <Link to={`/jobs/${job.id}`} className="job-title-link">
        <h3 className="job-title">{job.title}</h3>
      </Link>

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

      {job.tags.length > 0 && (
        <div className="job-tags">
          {job.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="job-tag">{tag}</span>
          ))}
        </div>
      )}

      <ActionButtons job={job} />
    </article>
  );
}
