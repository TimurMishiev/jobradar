import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import type { JobFeedResponse } from '../lib/types';
import JobCard from '../components/JobCard';

const REMOTE_OPTIONS = [
  { value: '', label: 'All locations' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'Onsite' },
];

const SENIORITY_OPTIONS = [
  { value: '', label: 'All levels' },
  { value: 'intern', label: 'Intern' },
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid' },
  { value: 'senior', label: 'Senior' },
  { value: 'staff', label: 'Staff' },
  { value: 'principal', label: 'Principal' },
];

const COMPANIES = ['Anthropic', 'OpenAI', 'Anduril', 'Palantir', 'Shield AI'];

export default function FeedPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const company = searchParams.get('company') ?? '';
  const remoteType = searchParams.get('remoteType') ?? '';
  const seniority = searchParams.get('seniority') ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.delete('page'); // reset to page 1 on filter change
    setSearchParams(next);
  };

  const setPage = (p: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(p));
    setSearchParams(next);
  };

  const hasFilters = company || remoteType || seniority;

  const clearFilters = () => setSearchParams(new URLSearchParams());

  const params = new URLSearchParams({
    page: String(page),
    limit: '25',
    hideIgnored: 'true',
    ...(company && { company }),
    ...(remoteType && { remoteType }),
    ...(seniority && { seniority }),
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['jobs', { company, remoteType, seniority, page }],
    queryFn: () => apiFetch<JobFeedResponse>(`/api/jobs?${params}`),
  });

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Job Feed</h2>
        {data && (
          <span className="page-count">{data.pagination.total.toLocaleString()} jobs</span>
        )}
      </div>

      <div className="filters">
        <select
          className="filter-select"
          value={company}
          onChange={(e) => setParam('company', e.target.value)}
        >
          <option value="">All companies</option>
          {COMPANIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          className="filter-select"
          value={remoteType}
          onChange={(e) => setParam('remoteType', e.target.value)}
        >
          {REMOTE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          className="filter-select"
          value={seniority}
          onChange={(e) => setParam('seniority', e.target.value)}
        >
          {SENIORITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {hasFilters && (
          <button className="filter-clear" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {isLoading && <p className="state-message">Loading jobs...</p>}
      {isError && <p className="state-message state-message--error">Failed to load jobs.</p>}

      {data && data.data.length === 0 && (
        <div className="empty-state">
          <p>No jobs match your filters.</p>
          {hasFilters && (
            <button className="btn-link" onClick={clearFilters}>Clear filters</button>
          )}
        </div>
      )}

      {data && data.data.length > 0 && (
        <>
          <div className="job-list">
            {data.data.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>

          {data.pagination.pages > 1 && (
            <div className="pagination">
              <button
                className="pagination-btn"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                ← Prev
              </button>
              <span className="pagination-info">
                Page {page} of {data.pagination.pages}
              </span>
              <button
                className="pagination-btn"
                disabled={page >= data.pagination.pages}
                onClick={() => setPage(page + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
