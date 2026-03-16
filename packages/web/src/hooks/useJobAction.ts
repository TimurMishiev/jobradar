import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { JobAction, JobWithDetails } from '../lib/types';

export function useJobAction(job: JobWithDetails) {
  const queryClient = useQueryClient();

  const currentAction = job.userActions[0]?.action ?? null;

  const invalidate = () => {
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
  });

  const removeAction = useMutation({
    mutationFn: () =>
      apiFetch(`/api/jobs/${job.id}/action`, { method: 'DELETE' }),
    onSuccess: invalidate,
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
