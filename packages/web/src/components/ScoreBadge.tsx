import React from 'react';
import type { JobScore } from '../lib/types';

interface Props {
  score: JobScore | null;
}

export default function ScoreBadge({ score }: Props) {
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
    <span className={`score-badge ${cls}`} title={score.explanation ?? undefined}>
      {score.score}
    </span>
  );
}
