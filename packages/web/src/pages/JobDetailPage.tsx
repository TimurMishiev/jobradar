import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { JobWithDetails } from '../lib/types';
import ActionButtons from '../components/ActionButtons';
import ScoreBadge from '../components/ScoreBadge';
import { useScoreJob } from '../hooks/useScoreJob';

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: job, isLoading, isError } = useQuery({
    queryKey: ['job', id],
    queryFn: () => apiFetch<JobWithDetails>(`/api/jobs/${id}`),
    enabled: Boolean(id),
  });

  const { mutate: scoreJob, isPending: isScoring } = useScoreJob(id!);

  // Auto-score when the job loads and has no score yet
  useEffect(() => {
    if (job && job.scores.length === 0) {
      scoreJob();
    }
  }, [job?.id]);

  if (isLoading) return <p className="state-message">Loading...</p>;
  if (isError || !job) return <p className="state-message state-message--error">Job not found.</p>;

  const score = job.scores[0] ?? null;

  return (
    <div className="job-detail">
      <button className="back-btn" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div className="job-detail-header">
        <div>
          <div className="job-detail-meta">
            <span className="job-company">{job.company}</span>
            <span className="job-meta-sep">·</span>
            <span className="job-source">{job.sourceName}</span>
            {job.location && (
              <>
                <span className="job-meta-sep">·</span>
                <span>{job.location}</span>
              </>
            )}
            {job.remoteType && job.remoteType !== 'unknown' && (
              <span className={`badge badge--remote badge--${job.remoteType}`}>
                {job.remoteType}
              </span>
            )}
          </div>
          <h1 className="job-detail-title">{job.title}</h1>
        </div>
        <ScoreBadge score={score} isScoring={isScoring} />
      </div>

      {score && (score.summary || score.matchReasons.length > 0) && (
        <div className="score-explanation">
          {score.summary && (
            <p className="score-summary">{score.summary}</p>
          )}
          {score.matchReasons.length > 0 && (
            <ul className="match-reasons">
              {score.matchReasons.map((r, i) => (
                <li key={i} className="match-reason match-reason--positive">
                  <span className="match-reason-icon">✓</span>{r}
                </li>
              ))}
            </ul>
          )}
          {score.missingSignals.length > 0 && (
            <ul className="match-reasons">
              {score.missingSignals.map((r, i) => (
                <li key={i} className="match-reason match-reason--gap">
                  <span className="match-reason-icon">✗</span>{r}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ActionButtons job={job} />

      {job.tags.length > 0 && (
        <div className="job-tags" style={{ marginTop: 20 }}>
          {job.tags.map((tag) => (
            <span key={tag} className="job-tag">{tag}</span>
          ))}
        </div>
      )}

      <div className="job-description">
        <h3 className="job-description-label">Job Description</h3>
        <div className="job-description-body">
          {job.descriptionNormalized
            ? job.descriptionNormalized
                .split(/\n{2,}/)
                .map((para, i) => <p key={i}>{para.trim()}</p>)
            : <p>No description available.</p>
          }
        </div>
        <a
          className="job-apply-link"
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Apply on {job.sourceName}
        </a>
      </div>
    </div>
  );
}
