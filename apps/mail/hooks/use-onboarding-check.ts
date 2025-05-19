import { useTRPC } from '@/providers/query-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useOnboardingCheck() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  
  const { data: hasCompletedOnboarding, isLoading } = useQuery(
    trpc.onboardingCheck.check.queryOptions(void 0, {
      // Ensure we always get fresh data when checking onboarding status
      staleTime: 0,
      // Don't refetch in the background
      refetchOnWindowFocus: false,
    })
  );

  const { mutate: markOnboardingCompleted } = useMutation(
    trpc.onboardingCheck.markCompleted.mutationOptions({
      onSuccess: () => {
        // Invalidate the check query to update the UI
        queryClient.invalidateQueries({ queryKey: trpc.onboardingCheck.check.queryKey() });
      },
    })
  );

  return {
    // Only return false if we explicitly get false from the server
    // If we get null or undefined (which might happen during loading), treat as true to avoid showing onboarding unnecessarily
    hasCompletedOnboarding: hasCompletedOnboarding === false ? false : true,
    isLoading,
    markOnboardingCompleted,
  };
}
