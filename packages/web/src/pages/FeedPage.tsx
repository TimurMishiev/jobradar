import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import type { JobFeedResponse, JobScore } from '../lib/types';
import JobCard from '../components/JobCard';
import Select from '../components/Select';

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

const POSTED_WITHIN_OPTIONS = [
  { value: '1', label: 'Last 24 hours' },
  { value: '3', label: 'Last 3 days' },
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 2 weeks' },
  { value: '30', label: 'Last 30 days' },
  { value: 'all', label: 'All time' },
];

interface ParsedFilters {
  title?: string;
  location?: string;
  company?: string;
  seniority?: string;
  remoteType?: string;
}

export default function FeedPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [nlQuery, setNlQuery] = useState(searchParams.get('search') ?? '');
  const [isParsing, setIsParsing] = useState(false);

  const { data: companiesData } = useQuery({
    queryKey: ['companies'],
    queryFn: () => apiFetch<Array<{ name: string; slug: string }>>('/api/ingest/companies'),
    staleTime: Infinity,
  });
  const companies = companiesData?.map((c) => c.name).sort() ?? [];

  const company = searchParams.get('company') ?? '';
  const remoteType = searchParams.get('remoteType') ?? '';
  const seniority = searchParams.get('seniority') ?? '';
  const postedWithin = searchParams.get('postedWithin') ?? '7';
  const location = searchParams.get('location') ?? '';
  const title = searchParams.get('title') ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.delete('page');
    setSearchParams(next);
  };

  const setPage = (p: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(p));
    setSearchParams(next);
  };

  const hasFilters = company || remoteType || seniority || postedWithin !== '7' || location || title;

  const clearFilters = () => {
    setNlQuery('');
    setSearchParams(new URLSearchParams({ postedWithin: '7' }));
  };

  const handleNlSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = nlQuery.trim();
    if (!q) return;

    setIsParsing(true);
    try {
      const parsed = await apiFetch<ParsedFilters>('/api/search/parse', {
        method: 'POST',
        body: JSON.stringify({ query: q }),
      });

      const hasAnyFilter = parsed.title || parsed.location || parsed.company || parsed.seniority || parsed.remoteType;
      if (!hasAnyFilter) {
        // GPT extracted nothing — treat the raw query as a title keyword search
        const next = new URLSearchParams({ postedWithin: '7', search: q, title: q });
        setSearchParams(next);
      } else {
        const next = new URLSearchParams({ postedWithin: '7', search: q });
        if (parsed.title) next.set('title', parsed.title);
        if (parsed.location) next.set('location', parsed.location);
        if (parsed.company) next.set('company', parsed.company);
        if (parsed.seniority) next.set('seniority', parsed.seniority);
        if (parsed.remoteType) next.set('remoteType', parsed.remoteType);
        setSearchParams(next);
      }
    } catch {
      // Fallback: treat the query as a title keyword search
      const next = new URLSearchParams(searchParams);
      next.set('title', q);
      next.set('search', q);
      next.delete('page');
      setSearchParams(next);
    } finally {
      setIsParsing(false);
    }
  };

  const params = new URLSearchParams({
    page: String(page),
    limit: '25',
    hideIgnored: 'true',
    postedWithin,
    ...(company && { company }),
    ...(remoteType && { remoteType }),
    ...(seniority && { seniority }),
    ...(location && { location }),
    ...(title && { title }),
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['jobs', { company, remoteType, seniority, postedWithin, page, location, title }],
    queryFn: () => apiFetch<JobFeedResponse>(`/api/jobs?${params}`),
  });

  const queryClient = useQueryClient();
  const [isScoring, setIsScoring] = useState(false);
  const [scoredCount, setScoredCount] = useState(0);

  const scoreVisibleJobs = async () => {
    if (!data) return;
    const unscored = data.data.filter((j) => j.scores.length === 0);
    if (unscored.length === 0) return;

    setIsScoring(true);
    setScoredCount(0);

    for (const job of unscored) {
      try {
        await apiFetch<JobScore>(`/api/jobs/${job.id}/score`, { method: 'POST' });
        setScoredCount((n) => n + 1);
      } catch {
        // Skip failed jobs silently — one bad job shouldn't stop the rest
      }
    }

    setIsScoring(false);
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
  };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Job Feed</h2>
        <div className="page-header-actions">
          {data && (
            <span className="page-count">{data.pagination.total.toLocaleString()} jobs</span>
          )}
          {data && data.data.some((j) => j.scores.length === 0) && (
            <button
              className="btn-score"
              onClick={scoreVisibleJobs}
              disabled={isScoring}
            >
              {isScoring ? `Scoring... ${scoredCount}/${data.data.filter((j) => j.scores.length === 0).length}` : 'Score visible jobs'}
            </button>
          )}
        </div>
      </div>

      <form className="nl-search" onSubmit={handleNlSearch}>
        <input
          className="nl-search-input"
          type="text"
          placeholder='e.g. "Frontend roles in defense tech, remote"'
          value={nlQuery}
          onChange={(e) => setNlQuery(e.target.value)}
        />
        <button className="nl-search-btn" type="submit" disabled={isParsing || !nlQuery.trim()}>
          {isParsing ? 'Searching...' : 'Search'}
        </button>
      </form>

      <div className="filters">
        <Select
          value={company}
          onChange={(v) => setParam('company', v)}
          options={[{ value: '', label: 'All companies' }, ...companies.map((c) => ({ value: c, label: c }))]
          }
        />

        <Select
          value={remoteType}
          onChange={(v) => setParam('remoteType', v)}
          options={REMOTE_OPTIONS}
        />

        <Select
          value={seniority}
          onChange={(v) => setParam('seniority', v)}
          options={SENIORITY_OPTIONS}
        />

        <Select
          value={postedWithin}
          onChange={(v) => setParam('postedWithin', v)}
          options={POSTED_WITHIN_OPTIONS}
        />

        <input
          className="filter-text-input"
          type="text"
          placeholder="Role / title"
          value={title}
          onChange={(e) => setParam('title', e.target.value)}
        />

        <input
          className="filter-text-input"
          type="text"
          placeholder="Location (e.g. US, New York)"
          value={location}
          onChange={(e) => setParam('location', e.target.value)}
        />

        {hasFilters && (
          <button className="filter-clear" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {isLoading && <p className="state-message">Loading jobs...</p>}
      {isError && <p className="state-message state-message--error">Failed to load jobs.</p>}

      {data && data.data.length > 0 && (() => {
        const newCount = data.data.filter((j) => {
          if (!j.postedAt) return false;
          return Date.now() - new Date(j.postedAt).getTime() < 24 * 60 * 60 * 1000;
        }).length;
        return newCount > 0 ? (
          <div className="feed-stats">
            <span className="feed-stat-new">
              <span className="feed-stat-dot" />
              {newCount} new in the last 24h
            </span>
            <span>{data.pagination.total.toLocaleString()} total</span>
          </div>
        ) : null;
      })()}

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
