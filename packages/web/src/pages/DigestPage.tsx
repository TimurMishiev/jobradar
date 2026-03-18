import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../lib/api';
import { STALE } from '../lib/queryConfig';
import type {
  DigestResponse,
  JobWithDetails,
  BriefingInsightResponse,
  GapAnalysisInsightResponse,
  CompanySignalsInsightResponse,
  CompanySignal,
  InsightTimelineResponse,
  DailyBriefingPayload,
  GapAnalysisPayload,
  CompanySignalsPayload,
} from '../lib/types';
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

function BriefingPanel() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['briefing'],
    queryFn: () =>
      apiFetch<BriefingInsightResponse>('/api/insights/daily-briefing').catch((err) => {
        // 404 means no briefing yet — return null rather than throw
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }),
    staleTime: STALE.briefing,
    retry: false,
  });

  const generate = useMutation({
    mutationFn: () => apiFetch<BriefingInsightResponse>('/api/insights/daily-briefing', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['briefing'] }),
  });

  if (isLoading) {
    return <div className="briefing-panel briefing-panel--loading">Loading briefing…</div>;
  }

  if (isError) {
    return null; // silently skip — don't break the digest page if briefing fails
  }

  // No briefing yet — show CTA
  if (!data) {
    return (
      <div className="briefing-panel briefing-panel--empty">
        <div className="briefing-empty-text">
          <span className="briefing-label">AI Briefing</span>
          <p>No briefing generated yet. Generate one to get a personalized summary of today's opportunities.</p>
        </div>
        <button
          className="briefing-generate-btn"
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
        >
          {generate.isPending ? 'Generating…' : 'Generate Briefing'}
        </button>
        {generate.isError && (
          <p className="briefing-error">
            {generate.error instanceof ApiError && generate.error.status === 429
              ? generate.error.message
              : 'Failed to generate briefing. Check that your OpenAI key is configured.'}
          </p>
        )}
      </div>
    );
  }

  const { payload, generatedAt } = data;

  return (
    <div className="briefing-panel">
      <div className="briefing-header">
        <span className="briefing-label">AI Briefing</span>
        <div className="briefing-header-right">
          <span className="briefing-age">Generated {timeAgo(generatedAt)}</span>
          <button
            className="briefing-refresh-btn"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            {generate.isPending ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {generate.isError && (
        <p className="briefing-error">
          {generate.error instanceof ApiError && generate.error.status === 429
            ? generate.error.message
            : 'Failed to refresh briefing.'}
        </p>
      )}

      <p className="briefing-headline">{payload.headline}</p>

      {payload.appliedNudge && (
        <p className="briefing-nudge">{payload.appliedNudge}</p>
      )}

      {payload.topPicks.length > 0 && (
        <div className="briefing-picks">
          <span className="briefing-picks-label">Top picks</span>
          <div className="briefing-picks-list">
            {payload.topPicks.map((pick) => (
              <Link key={pick.jobId} to={`/jobs/${pick.jobId}`} className="briefing-pick">
                <div className="briefing-pick-left">
                  <span className="briefing-pick-title">{pick.title}</span>
                  <span className="briefing-pick-company">{pick.company}</span>
                  <span className="briefing-pick-reason">{pick.reason}</span>
                </div>
                <span className={`briefing-pick-score briefing-pick-score--${pick.score >= 85 ? 'high' : pick.score >= 70 ? 'medium' : 'low'}`}>
                  {pick.score}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {payload.watchlistHighlights.length > 0 && (
        <div className="briefing-watchlist">
          <span className="briefing-picks-label">Watchlist activity</span>
          <div className="briefing-watchlist-list">
            {payload.watchlistHighlights.map((w) => (
              <span key={w.company} className="briefing-watchlist-item">
                <span className="briefing-watchlist-company">{w.company}</span>
                <span className="briefing-watchlist-count">{w.newRoles} new {w.newRoles === 1 ? 'role' : 'roles'}</span>
                {w.topRole && <span className="briefing-watchlist-top">— {w.topRole}</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GapAnalysisPanel() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['gap-analysis'],
    queryFn: () =>
      apiFetch<GapAnalysisInsightResponse>('/api/insights/gap-analysis').catch((err) => {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }),
    staleTime: STALE.gapAnalysis,
    retry: false,
  });

  const generate = useMutation({
    mutationFn: () =>
      apiFetch<GapAnalysisInsightResponse>('/api/insights/gap-analysis', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gap-analysis'] }),
  });

  if (isLoading) return null;
  if (isError) return null;

  if (!data) {
    return (
      <div className="gap-panel gap-panel--empty">
        <div className="gap-panel-empty-text">
          <span className="gap-panel-label">Resume Gap Analysis</span>
          <p>Analyze recurring missing skills across your top-matched jobs.</p>
        </div>
        <button
          className="briefing-generate-btn"
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
        >
          {generate.isPending ? 'Analyzing…' : 'Run Analysis'}
        </button>
        {generate.isError && (
          <p className="briefing-error">
            {generate.error instanceof ApiError && generate.error.status === 429
              ? generate.error.message
              : 'Failed to run analysis. Check that your OpenAI key is configured.'}
          </p>
        )}
      </div>
    );
  }

  const { payload, generatedAt } = data;
  const hasGaps = payload.topGaps.length > 0;

  return (
    <div className="gap-panel">
      <div className="briefing-header">
        <span className="gap-panel-label">Resume Gap Analysis</span>
        <div className="briefing-header-right">
          <span className="briefing-age">
            {payload.basedOnJobCount} jobs · Generated {timeAgo(generatedAt)}
          </span>
          <button
            className="briefing-refresh-btn"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            {generate.isPending ? 'Analyzing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {generate.isError && (
        <p className="briefing-error">
          {generate.error instanceof ApiError && generate.error.status === 429
            ? generate.error.message
            : 'Failed to refresh analysis.'}
        </p>
      )}

      <p className="gap-panel-summary">{payload.summary}</p>

      {hasGaps && (
        <div className="gap-list">
          {payload.topGaps.map((gap) => (
            <div key={gap.skill} className="gap-item">
              <div className="gap-item-left">
                <span className="gap-item-skill">{gap.skill}</span>
                <span className="gap-item-context">{gap.context}</span>
              </div>
              <span className="gap-item-count">
                {gap.count} {gap.count === 1 ? 'job' : 'jobs'}
              </span>
            </div>
          ))}
        </div>
      )}

      {payload.recommendation && (
        <p className="gap-recommendation">{payload.recommendation}</p>
      )}
    </div>
  );
}

const SIGNAL_ICON: Record<string, string> = {
  HIRING_CLUSTER:     '📈',
  SKILL_MATCH_CLUSTER: '🎯',
};

function CompanySignalsPanel() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['company-signals'],
    queryFn: () =>
      apiFetch<CompanySignalsInsightResponse>('/api/insights/company-signals').catch((err) => {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }),
    staleTime: STALE.companySignals,
    retry: false,
  });

  const generate = useMutation({
    mutationFn: () =>
      apiFetch<CompanySignalsInsightResponse>('/api/insights/company-signals', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company-signals'] }),
  });

  if (isLoading) return null;
  if (isError) return null;

  if (!data) {
    return (
      <div className="company-signals-panel company-signals-panel--empty">
        <div className="company-signals-empty-text">
          <span className="company-signals-label">Company Intelligence</span>
          <p>Detect hiring clusters and skill-match patterns across companies.</p>
        </div>
        <button
          className="briefing-generate-btn"
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
        >
          {generate.isPending ? 'Analyzing…' : 'Run Analysis'}
        </button>
        {generate.isError && (
          <p className="briefing-error">
            {generate.error instanceof ApiError && generate.error.status === 429
              ? generate.error.message
              : 'Failed to run analysis.'}
          </p>
        )}
      </div>
    );
  }

  const { payload, generatedAt } = data;
  const signals: CompanySignal[] = payload.signals ?? [];

  return (
    <div className="company-signals-panel">
      <div className="briefing-header">
        <span className="company-signals-label">Company Intelligence</span>
        <div className="briefing-header-right">
          <span className="briefing-age">
            {signals.length} signal{signals.length !== 1 ? 's' : ''} · Generated {timeAgo(generatedAt)}
          </span>
          <button
            className="briefing-refresh-btn"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            {generate.isPending ? 'Analyzing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {generate.isError && (
        <p className="briefing-error">
          {generate.error instanceof ApiError && generate.error.status === 429
            ? generate.error.message
            : 'Failed to refresh.'}
        </p>
      )}

      {signals.length === 0 ? (
        <p className="digest-empty">No notable patterns detected this week.</p>
      ) : (
        <div className="company-signal-list">
          {signals.map((s, i) => (
            <div key={`${s.company}-${s.kind}-${i}`} className={`company-signal-item company-signal-item--${s.kind.toLowerCase()}`}>
              <span className="company-signal-icon">{SIGNAL_ICON[s.kind] ?? '•'}</span>
              <div className="company-signal-body">
                <span className="company-signal-desc">{s.description}</span>
                {s.topRole && (
                  <span className="company-signal-top">Top role: {s.topRole}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Timeline helpers ─────────────────────────────────────────────────────────

const TIMELINE_TYPE_LABEL: Record<string, string> = {
  daily_briefing:  'Daily Briefing',
  gap_analysis:    'Gap Analysis',
  company_signals: 'Company Intelligence',
};

function timelineEntryDescription(type: string, payload: unknown): string {
  try {
    if (type === 'daily_briefing') {
      const p = payload as DailyBriefingPayload;
      return p.headline ?? 'Briefing generated';
    }
    if (type === 'gap_analysis') {
      const p = payload as GapAnalysisPayload;
      return p.summary ? p.summary.slice(0, 120) : 'Gap analysis completed';
    }
    if (type === 'company_signals') {
      const p = payload as CompanySignalsPayload;
      const count = p.signals?.length ?? 0;
      return count > 0
        ? `${count} signal${count !== 1 ? 's' : ''} detected — ${p.signals[0].description}`
        : 'No notable patterns detected';
    }
  } catch {
    // fall through
  }
  return 'Insight generated';
}

function InsightTimeline() {
  const { data, isLoading } = useQuery({
    queryKey: ['insight-timeline'],
    queryFn: () => apiFetch<InsightTimelineResponse>('/api/insights?limit=15'),
    staleTime: STALE.insightTimeline,
  });

  if (isLoading) return null;
  const entries = data?.data ?? [];
  if (entries.length === 0) return null;

  // Group by date
  const grouped = new Map<string, typeof entries>();
  for (const entry of entries) {
    const day = new Date(entry.generatedAt).toLocaleDateString('en-US', {
      weekday: 'long', month: 'short', day: 'numeric',
    });
    const list = grouped.get(day) ?? [];
    list.push(entry);
    grouped.set(day, list);
  }

  return (
    <section className="insight-timeline">
      <div className="digest-section-header">
        <h2 className="digest-section-title">Recent Activity</h2>
        <span className="digest-section-subtitle">Intelligence history</span>
      </div>
      <div className="timeline-groups">
        {[...grouped.entries()].map(([day, dayEntries]) => (
          <div key={day} className="timeline-group">
            <span className="timeline-day">{day}</span>
            <div className="timeline-entries">
              {dayEntries.map((entry) => (
                <div key={entry.id} className="timeline-entry">
                  <span className="timeline-entry-type">
                    {TIMELINE_TYPE_LABEL[entry.type] ?? entry.type}
                  </span>
                  <span className="timeline-entry-desc">
                    {timelineEntryDescription(entry.type, entry.payload)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function DigestPage() {
  const { data, isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ['digest'],
    queryFn: () => apiFetch<DigestResponse>('/api/digest'),
    staleTime: STALE.digest,
  });

  if (isLoading) return <p className="state-message">Loading digest...</p>;
  if (isError || !data) return <p className="state-message state-message--error">Failed to load digest.</p>;

  return (
    <div className="digest-page">
      <div className="page-header">
        <h1 className="page-title">Daily Digest</h1>
        <p className="page-subtitle">
          Updated {timeAgo(new Date(dataUpdatedAt).toISOString())}
          {' · '}
          {data.newToday.length} new today
          {data.topScored.length > 0 && ` · ${data.topScored.length} strong matches`}
        </p>
      </div>

      <BriefingPanel />
      <GapAnalysisPanel />
      <CompanySignalsPanel />

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

      <InsightTimeline />
    </div>
  );
}
