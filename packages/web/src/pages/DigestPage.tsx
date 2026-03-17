import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { DigestResponse, JobWithDetails } from '../lib/types';
import JobCard from '../components/JobCard';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface SectionProps {
  title: string;
  subtitle: string;
  jobs: JobWithDetails[];
  emptyMessage: string;
}

function DigestSection({ title, subtitle, jobs, emptyMessage }: SectionProps) {
  return (
    <section className="digest-section">
      <div className="digest-section-header">
        <h2 className="digest-section-title">{title}</h2>
        <span className="digest-section-subtitle">{subtitle}</span>
      </div>
      {jobs.length === 0 ? (
        <p className="digest-empty">{emptyMessage}</p>
      ) : (
        <div className="job-list">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function DigestPage() {
  const { data, isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ['digest'],
    queryFn: () => apiFetch<DigestResponse>('/api/digest'),
    staleTime: 5 * 60_000, // 5 minutes
  });

  if (isLoading) return <p className="state-message">Loading digest...</p>;
  if (isError || !data) return <p className="state-message state-message--error">Failed to load digest.</p>;

  return (
    <div className="digest-page">
      <div className="page-header">
        <h1 className="page-title">Daily Digest</h1>
        <p className="page-subtitle">
          Updated {timeAgo(data.generatedAt)}
          {' · '}
          {data.newToday.length} new today
          {data.topScored.length > 0 && ` · ${data.topScored.length} strong matches`}
        </p>
      </div>

      {data.topScored.length > 0 && (
        <DigestSection
          title="Strong Matches"
          subtitle="Score ≥ 70 · last 7 days"
          jobs={data.topScored}
          emptyMessage=""
        />
      )}

      <DigestSection
        title="New Today"
        subtitle="Posted in the last 24 hours"
        jobs={data.newToday}
        emptyMessage="No new jobs posted in the last 24 hours."
      />

      <DigestSection
        title="Watchlist"
        subtitle="From your preferred companies · last 7 days"
        jobs={data.watchlist}
        emptyMessage="No recent jobs from your preferred companies. Add companies in your profile."
      />
    </div>
  );
}
