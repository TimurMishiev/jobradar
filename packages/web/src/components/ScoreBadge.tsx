import React from 'react';
import type { JobScore } from '../lib/types';

interface Props {
  score: JobScore | null;
  isScoring?: boolean;
}

export default function ScoreBadge({ score, isScoring }: Props) {
  if (isScoring && !score) {
    return <span className="score-badge score-badge--pending">...</span>;
  }

  if (!score) {
    return <span className="score-badge score-badge--pending">–</span>;
  }

  const cls =
    score.fitCategory === 'high'
      ? 'score-badge--high'
      : score.fitCategory === 'medium'
        ? 'score-badge--medium'
        : 'score-badge--low';

  return (
    <span className={`score-badge ${cls}`} title={score.summary ?? undefined}>
      {score.score}
    </span>
  );
}
