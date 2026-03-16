import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { JobScore } from '../lib/types';

export function useScoreJob(jobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiFetch<JobScore>(`/api/jobs/${jobId}/score`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}
