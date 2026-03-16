import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { UserProfile } from '@signalhire/shared';
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

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [saved, setSaved] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiFetch<UserProfile | null>('/api/profile'),
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
          Tell SignalHire what you're looking for. This will power job scoring in Phase 4.
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
    </div>
  );
}
