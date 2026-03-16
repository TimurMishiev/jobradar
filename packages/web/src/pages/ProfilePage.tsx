import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { UserProfile } from '@jobradar/shared';
import type { Resume } from '../lib/types';
import TagInput from '../components/TagInput';

const REMOTE_OPTIONS: { value: UserProfile['remotePreference']; label: string }[] = [
  { value: 'ANY', label: 'Any (remote, hybrid, or onsite)' },
  { value: 'REMOTE_ONLY', label: 'Remote only' },
  { value: 'HYBRID', label: 'Hybrid' },
  { value: 'ONSITE', label: 'Onsite only' },
];

const SENIORITY_OPTIONS = ['Intern', 'Junior', 'Mid', 'Senior', 'Staff', 'Principal', 'Manager', 'Director'];

interface FormState {
  targetTitles: string[];
  targetSkills: string[];
  preferredCompanies: string[];
  targetLocations: string[];
  remotePreference: UserProfile['remotePreference'];
  seniorityPref: string[];
}

const DEFAULT_FORM: FormState = {
  targetTitles: [],
  targetSkills: [],
  preferredCompanies: [],
  targetLocations: [],
  remotePreference: 'ANY',
  seniorityPref: [],
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiFetch<UserProfile | null>('/api/profile'),
  });

  const { data: resumes = [] } = useQuery({
    queryKey: ['resumes'],
    queryFn: () => apiFetch<Resume[]>('/api/resumes'),
  });

  const uploadResume = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return fetch('/api/resumes', { method: 'POST', body: form }).then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Upload failed (${res.status})`);
        }
        return res.json() as Promise<Resume>;
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      setUploadError(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (err: Error) => setUploadError(err.message),
  });

  const setDefaultResume = useMutation({
    mutationFn: (id: string) => apiFetch<Resume>(`/api/resumes/${id}/default`, { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resumes'] }),
  });

  const deleteResume = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/resumes/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resumes'] }),
  });

  // Sync form when profile loads
  useEffect(() => {
    if (profile) {
      setForm({
        targetTitles: profile.targetTitles,
        targetSkills: profile.targetSkills,
        preferredCompanies: profile.preferredCompanies,
        targetLocations: profile.targetLocations,
        remotePreference: profile.remotePreference,
        seniorityPref: profile.seniorityPref,
      });
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: () =>
      apiFetch<UserProfile>('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
  };

  const toggleSeniority = (level: string) => {
    set(
      'seniorityPref',
      form.seniorityPref.includes(level)
        ? form.seniorityPref.filter((s) => s !== level)
        : [...form.seniorityPref, level],
    );
  };

  if (isLoading) return <p className="state-message">Loading profile...</p>;

  return (
    <div className="profile-form">
      <div className="page-header">
        <h2 className="page-title">Profile</h2>
        <p className="page-subtitle">
          Tell JobRadar what you're looking for. This will power job scoring in Phase 4.
        </p>
      </div>

      <section className="form-section">
        <h3 className="form-section-title">What I'm looking for</h3>

        <TagInput
          label="Target job titles"
          values={form.targetTitles}
          onChange={(v) => set('targetTitles', v)}
          placeholder="e.g. Frontend Engineer, Full Stack Engineer"
        />
        <TagInput
          label="Skills & technologies"
          values={form.targetSkills}
          onChange={(v) => set('targetSkills', v)}
          placeholder="e.g. React, TypeScript, Node.js"
        />
        <TagInput
          label="Preferred companies"
          values={form.preferredCompanies}
          onChange={(v) => set('preferredCompanies', v)}
          placeholder="e.g. Anthropic, OpenAI, Anduril"
        />
        <TagInput
          label="Target locations"
          values={form.targetLocations}
          onChange={(v) => set('targetLocations', v)}
          placeholder="e.g. San Francisco, New York, Remote"
        />
      </section>

      <section className="form-section">
        <h3 className="form-section-title">Preferences</h3>

        <div className="field">
          <label className="field-label">Remote preference</label>
          <select
            className="field-select"
            value={form.remotePreference}
            onChange={(e) => set('remotePreference', e.target.value as UserProfile['remotePreference'])}
          >
            {REMOTE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field-label">Seniority levels</label>
          <div className="seniority-grid">
            {SENIORITY_OPTIONS.map((level) => (
              <button
                key={level}
                type="button"
                className={`seniority-btn ${form.seniorityPref.includes(level) ? 'active' : ''}`}
                onClick={() => toggleSeniority(level)}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="form-actions">
        <button
          className="btn-primary"
          onClick={() => save.mutate()}
          disabled={save.isPending}
        >
          {save.isPending ? 'Saving...' : 'Save profile'}
        </button>
        {saved && <span className="save-confirmation">✓ Saved</span>}
        {save.isError && <span className="save-error">Failed to save — try again</span>}
      </div>

      <section className="form-section">
        <h3 className="form-section-title">Resume</h3>
        <p className="form-section-desc">
          Upload your resume as a PDF. The default resume is used for AI job scoring.
        </p>

        {resumes.length > 0 && (
          <ul className="resume-list">
            {resumes.map((r) => (
              <li key={r.id} className={`resume-item ${r.isDefault ? 'resume-item--default' : ''}`}>
                <div className="resume-item-info">
                  <span className="resume-item-name">{r.label}</span>
                  <span className="resume-item-meta">{formatBytes(r.sizeBytes)}</span>
                  {r.isDefault && <span className="resume-badge-default">Default</span>}
                </div>
                <div className="resume-item-actions">
                  {!r.isDefault && (
                    <button
                      className="resume-btn"
                      onClick={() => setDefaultResume.mutate(r.id)}
                      disabled={setDefaultResume.isPending}
                    >
                      Set default
                    </button>
                  )}
                  <button
                    className="resume-btn resume-btn--delete"
                    onClick={() => deleteResume.mutate(r.id)}
                    disabled={deleteResume.isPending}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="resume-upload">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="resume-file-input"
            id="resume-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadResume.mutate(file);
            }}
          />
          <label htmlFor="resume-file-input" className={`resume-upload-btn ${uploadResume.isPending ? 'loading' : ''}`}>
            {uploadResume.isPending ? 'Uploading...' : '+ Upload PDF'}
          </label>
          {uploadError && <p className="resume-upload-error">{uploadError}</p>}
        </div>
      </section>
    </div>
  );
}
