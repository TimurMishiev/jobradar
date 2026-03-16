import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { JobScore } from '../lib/types';

export function useScoreJob(jobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        return await apiFetch<JobScore>(`/api/jobs/${jobId}/score`, { method: 'POST' });
      } catch (err) {
        // 503 means the key isn't configured yet — treat as a no-op, not an error
        if (err instanceof Error && err.message.includes('503')) return null;
        throw err;
      }
    },
    onSuccess: (result) => {
      if (!result) return; // key not configured, nothing to invalidate
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}
