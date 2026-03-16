import React, { useState } from 'react';
import type { JobAction, JobWithDetails } from '../lib/types';
import { useJobAction } from '../hooks/useJobAction';

interface Props {
  job: JobWithDetails;
}

export default function ActionButtons({ job }: Props) {
  const { currentAction, toggle, isPending } = useJobAction(job);
  const [hovered, setHovered] = useState<JobAction | null>(null);

  const label = (action: JobAction, defaultLabel: string, activeLabel: string, removeLabel: string) => {
    if (currentAction === action) {
      return hovered === action ? removeLabel : activeLabel;
    }
    return defaultLabel;
  };

  return (
    <div className="action-buttons">
      <button
        className={`action-btn action-btn--save ${currentAction === 'SAVED' ? 'active' : ''} ${currentAction === 'SAVED' && hovered === 'SAVED' ? 'active--remove' : ''}`}
        onClick={(e) => { e.preventDefault(); toggle('SAVED'); }}
        onMouseEnter={() => setHovered('SAVED')}
        onMouseLeave={() => setHovered(null)}
        disabled={isPending}
        title={currentAction === 'SAVED' ? 'Click to unsave' : 'Save this job'}
      >
        {label('SAVED', '☆ Save', '★ Saved', '✕ Unsave')}
      </button>

      <button
        className={`action-btn action-btn--apply ${currentAction === 'APPLIED' ? 'active' : ''} ${currentAction === 'APPLIED' && hovered === 'APPLIED' ? 'active--remove' : ''}`}
        onClick={(e) => { e.preventDefault(); toggle('APPLIED'); }}
        onMouseEnter={() => setHovered('APPLIED')}
        onMouseLeave={() => setHovered(null)}
        disabled={isPending}
        title={currentAction === 'APPLIED' ? 'Click to remove' : 'Mark as applied'}
      >
        {label('APPLIED', 'Applied', '✓ Applied', '✕ Remove')}
      </button>

      <button
        className={`action-btn action-btn--ignore ${currentAction === 'IGNORED' ? 'active' : ''} ${currentAction === 'IGNORED' && hovered === 'IGNORED' ? 'active--remove' : ''}`}
        onClick={(e) => { e.preventDefault(); toggle('IGNORED'); }}
        onMouseEnter={() => setHovered('IGNORED')}
        onMouseLeave={() => setHovered(null)}
        disabled={isPending}
        title={currentAction === 'IGNORED' ? 'Click to restore to feed' : 'Hide this job from your feed'}
      >
        {label('IGNORED', 'Ignore', '✕ Ignored', '↩ Restore')}
      </button>
    </div>
  );
}
