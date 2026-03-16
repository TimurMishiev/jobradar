import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { JobWithDetails } from '../lib/types';
import ActionButtons from '../components/ActionButtons';
import ScoreBadge from '../components/ScoreBadge';

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: job, isLoading, isError } = useQuery({
    queryKey: ['job', id],
    queryFn: () => apiFetch<JobWithDetails>(`/api/jobs/${id}`),
    enabled: Boolean(id),
  });

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
        <ScoreBadge score={score} />
      </div>

      {score?.explanation && (
        <div className="score-explanation">
          <p className="score-explanation-label">Why this matches</p>
          <p>{score.explanation}</p>
          {score.skillsMatch && (
            <div className="skills-match">
              {score.skillsMatch.matched.length > 0 && (
                <div>
                  <span className="skills-label skills-label--matched">Matched:</span>
                  {score.skillsMatch.matched.map((s) => (
                    <span key={s} className="skill-tag skill-tag--matched">{s}</span>
                  ))}
                </div>
              )}
              {score.skillsMatch.missing.length > 0 && (
                <div>
                  <span className="skills-label skills-label--missing">Missing:</span>
                  {score.skillsMatch.missing.map((s) => (
                    <span key={s} className="skill-tag skill-tag--missing">{s}</span>
                  ))}
                </div>
              )}
            </div>
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
          {job.descriptionNormalized ?? 'No description available.'}
        </div>
        <a
          className="job-apply-link"
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Apply on {job.sourceName} →
        </a>
      </div>
    </div>
  );
}
