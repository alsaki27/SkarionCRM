import { trpc } from '../api';

export function useOrg() {
  const orgQuery = trpc.org.getCurrent.useQuery(undefined, {
    retry: false,
  });

  const updateMutation = trpc.org.update.useMutation();
  const inviteUserMutation = trpc.org.inviteUser.useMutation();
  const listUsersQuery = trpc.org.listUsers.useQuery();

  return {
    org: orgQuery.data,
    isLoading: orgQuery.isLoading,
    update: updateMutation.mutate,
    inviteUser: inviteUserMutation.mutate,
    users: listUsersQuery.data,
    isUsersLoading: listUsersQuery.isLoading,
  };
}
