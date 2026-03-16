import React from 'react';
import type { JobAction, JobWithDetails } from '../lib/types';
import { useJobAction } from '../hooks/useJobAction';

interface Props {
  job: JobWithDetails;
}

export default function ActionButtons({ job }: Props) {
  const { currentAction, toggle, isPending } = useJobAction(job);

  return (
    <div className="action-buttons">
      <button
        className={`action-btn action-btn--save ${currentAction === 'SAVED' ? 'active' : ''}`}
        onClick={(e) => { e.preventDefault(); toggle('SAVED'); }}
        disabled={isPending}
        title="Save"
      >
        {currentAction === 'SAVED' ? '★ Saved' : '☆ Save'}
      </button>
      <button
        className={`action-btn action-btn--apply ${currentAction === 'APPLIED' ? 'active' : ''}`}
        onClick={(e) => { e.preventDefault(); toggle('APPLIED'); }}
        disabled={isPending}
        title="Mark as applied"
      >
        {currentAction === 'APPLIED' ? '✓ Applied' : 'Applied'}
      </button>
      <button
        className={`action-btn action-btn--ignore ${currentAction === 'IGNORED' ? 'active' : ''}`}
        onClick={(e) => { e.preventDefault(); toggle('IGNORED'); }}
        disabled={isPending}
        title="Ignore"
      >
        {currentAction === 'IGNORED' ? '✕ Ignored' : 'Ignore'}
      </button>
    </div>
  );
}
