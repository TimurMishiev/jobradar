import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import type { JobFeedResponse, JobWithDetails } from '../lib/types';
import JobCard from '../components/JobCard';

type Tab = 'saved' | 'applied';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function sortByActionDate(jobs: JobWithDetails[]): JobWithDetails[] {
  return [...jobs].sort((a, b) => {
    const aDate = a.userActions[0]?.updatedAt ?? '';
    const bDate = b.userActions[0]?.updatedAt ?? '';
    return bDate.localeCompare(aDate);
  });
}

export default function SavedPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get('tab') === 'applied' ? 'applied' : 'saved';

  const setTab = (t: Tab) => setSearchParams(t === 'saved' ? {} : { tab: t });

  const { data: savedData, isLoading: savedLoading } = useQuery({
    queryKey: ['jobs', { action: 'SAVED' }],
    queryFn: () => apiFetch<JobFeedResponse>('/api/jobs?action=SAVED&limit=200&postedWithin=all'),
  });

  const { data: appliedData, isLoading: appliedLoading } = useQuery({
    queryKey: ['jobs', { action: 'APPLIED' }],
    queryFn: () => apiFetch<JobFeedResponse>('/api/jobs?action=APPLIED&limit=200&postedWithin=all'),
  });

  const savedJobs = sortByActionDate(savedData?.data ?? []);
  const appliedJobs = sortByActionDate(appliedData?.data ?? []);

  const jobs = tab === 'saved' ? savedJobs : appliedJobs;
  const isLoading = tab === 'saved' ? savedLoading : appliedLoading;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Tracker</h2>
        <div className="page-header-actions">
          {!savedLoading && (
            <span className="page-count">
              {savedJobs.length} saved · {appliedJobs.length} applied
            </span>
          )}
        </div>
      </div>

      <div className="tracker-tabs">
        <button
          className={`tracker-tab ${tab === 'saved' ? 'active' : ''}`}
          onClick={() => setTab('saved')}
        >
          Saved
          {savedJobs.length > 0 && (
            <span className="tracker-tab-count">{savedJobs.length}</span>
          )}
        </button>
        <button
          className={`tracker-tab ${tab === 'applied' ? 'active' : ''}`}
          onClick={() => setTab('applied')}
        >
          Applied
          {appliedJobs.length > 0 && (
            <span className="tracker-tab-count">{appliedJobs.length}</span>
          )}
        </button>
      </div>

      {isLoading && <p className="state-message">Loading...</p>}

      {!isLoading && jobs.length === 0 && (
        <div className="empty-state">
          {tab === 'saved' ? (
            <>
              <p>No saved jobs yet.</p>
              <p className="empty-state-sub">Click ☆ Save on any job in your feed.</p>
            </>
          ) : (
            <>
              <p>No applications tracked yet.</p>
              <p className="empty-state-sub">Mark jobs as Applied to track them here.</p>
            </>
          )}
        </div>
      )}

      {jobs.length > 0 && (
        <div className="job-list">
          {jobs.map((job) => {
            const action = job.userActions[0];
            return (
              <div key={job.id} className="tracker-card-wrapper">
                <JobCard job={job} />
                <div className="tracker-card-meta">
                  {action?.updatedAt && (
                    <span className="tracker-action-date">
                      {tab === 'saved' ? 'Saved' : 'Applied'} {timeAgo(action.updatedAt)}
                    </span>
                  )}
                  {action?.notes && (
                    <p className="tracker-notes">{action.notes}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
