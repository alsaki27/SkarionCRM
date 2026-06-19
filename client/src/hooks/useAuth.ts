import { trpc } from '../api';

export function useAuth() {
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const loginMutation = trpc.auth.login.useMutation();
  const registerMutation = trpc.auth.register.useMutation();

  return {
    user: meQuery.data,
    isLoading: meQuery.isLoading,
    isError: meQuery.isError,
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    isLoginLoading: loginMutation.isPending,
    isRegisterLoading: registerMutation.isPending,
  };
}
