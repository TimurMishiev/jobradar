import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { JobFeedResponse } from '../lib/types';
import JobCard from '../components/JobCard';

export default function SavedPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['jobs', { action: 'SAVED' }],
    queryFn: () => apiFetch<JobFeedResponse>('/api/jobs?action=SAVED&limit=100'),
  });

  const jobs = data?.data ?? [];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Saved Jobs</h2>
        {data && <span className="page-count">{jobs.length} saved</span>}
      </div>

      {isLoading && <p className="state-message">Loading...</p>}
      {isError && <p className="state-message state-message--error">Failed to load saved jobs.</p>}

      {!isLoading && jobs.length === 0 && (
        <div className="empty-state">
          <p>No saved jobs yet.</p>
          <p className="empty-state-sub">
            Click ☆ Save on any job in your feed to save it here.
          </p>
        </div>
      )}

      {jobs.length > 0 && (
        <div className="job-list">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
