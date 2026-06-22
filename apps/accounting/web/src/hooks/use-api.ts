import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { booksFetch, redirectToLogin, type Account, type Transaction, type Invoice } from '../api.js';

function useBooksQuery<T>(key: string[], fetcher: () => Promise<T>) {
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      try {
        return await fetcher();
      } catch (err) {
        if (err instanceof Error && 'status' in err && err.status === 401) {
          redirectToLogin();
        }
        throw err;
      }
    },
  });
}

export function useAccounts() {
  return useBooksQuery(['accounts'], () => booksFetch<{ accounts: Account[] }>('/api/accounts'));
}

export function useTransactions() {
  return useBooksQuery(['transactions'], () => booksFetch<{ transactions: Transaction[] }>('/api/transactions'));
}

export function useInvoices() {
  return useBooksQuery(['invoices'], () => booksFetch<{ invoices: Invoice[] }>('/api/invoices'));
}

export function useDeleteEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      await booksFetch(`/api/${type}/${id}`, { method: 'DELETE' });
      return { type, id };
    },
    onSuccess: ({ type }) => {
      qc.invalidateQueries({ queryKey: [type] });
    },
  });
}

export function useCreateEntity<T extends Record<string, unknown>>(type: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: T) => {
      return booksFetch<{ [key: string]: unknown }>(`/api/${type}`, { method: 'POST', body: JSON.stringify(data) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [type] });
    },
  });
}

export function useUpdateEntity<T extends Record<string, unknown>>(type: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: T }) => {
      return booksFetch<{ [key: string]: unknown }>(`/api/${type}/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [type] });
      qc.invalidateQueries({ queryKey: [type, vars.id] });
    },
  });
}
