import { useQuery } from '@tanstack/react-query';

export const useConnections = () => {
  const connectionsQuery = useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      const response = await fetch('/api/connections');
      return response.json();
    },
    staleTime: 1000 * 60 * 60,
  });
  return connectionsQuery;
};

export const useActiveConnection = () => {
  const connectionsQuery = useQuery({
    queryKey: ['active-connection'],
    queryFn: async () => {
      const response = await fetch('/api/connections/active');
      return response.json();
    },
    staleTime: 1000 * 60 * 60,
  });
  return connectionsQuery;
};
