import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { JobAction, JobWithDetails } from '../lib/types';

export function useJobAction(job: JobWithDetails) {
  const queryClient = useQueryClient();

  const currentAction = job.userActions[0]?.action ?? null;

  const invalidate = () => {
    // Invalidate all jobs queries (feed, saved, applied) and the job detail cache
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
    queryClient.invalidateQueries({ queryKey: ['job', job.id] });
  };

  const setAction = useMutation({
    mutationFn: (action: JobAction) =>
      apiFetch(`/api/jobs/${job.id}/action`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      }),
    onSuccess: invalidate,
    onError: (err) => console.error('[setAction] failed:', err),
  });

  const removeAction = useMutation({
    mutationFn: () =>
      apiFetch<void>(`/api/jobs/${job.id}/action`, { method: 'DELETE' }),
    onSuccess: invalidate,
    onError: (err) => console.error('[removeAction] failed:', err),
  });

  const isPending = setAction.isPending || removeAction.isPending;

  // Clicking the active action toggles it off; otherwise sets the new action
  const toggle = (action: JobAction) => {
    if (isPending) return;
    if (currentAction === action) {
      removeAction.mutate();
    } else {
      setAction.mutate(action);
    }
  };

  return { currentAction, toggle, isPending };
}
