import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crmFetch, redirectToLogin, type Company, type Contact, type Lead, type Opportunity, type Task } from '../api.js';

function useCrmQuery<T>(key: string[], fetcher: () => Promise<T>) {
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

export function useCompanies() {
  return useCrmQuery(['companies'], () => crmFetch<{ companies: Company[] }>('/api/companies'));
}

export function useContacts() {
  return useCrmQuery(['contacts'], () => crmFetch<{ contacts: Contact[] }>('/api/contacts'));
}

export function useLeads() {
  return useCrmQuery(['leads'], () => crmFetch<{ leads: Lead[] }>('/api/leads'));
}

export function useOpportunities() {
  return useCrmQuery(['opportunities'], () => crmFetch<{ opportunities: Opportunity[] }>('/api/opportunities'));
}

export function useTasks() {
  return useCrmQuery(['tasks'], () => crmFetch<{ tasks: Task[] }>('/api/tasks'));
}

export function useLead(id: string) {
  return useCrmQuery(['leads', id], () => crmFetch<{ lead: Lead }>(`/api/leads/${id}`));
}

export function useCompany(id: string) {
  return useCrmQuery(['companies', id], () => crmFetch<{ company: Company }>(`/api/companies/${id}`));
}

export function useContact(id: string) {
  return useCrmQuery(['contacts', id], () => crmFetch<{ contact: Contact }>(`/api/contacts/${id}`));
}

export function useOpportunity(id: string) {
  return useCrmQuery(['opportunities', id], () => crmFetch<{ opportunity: Opportunity }>(`/api/opportunities/${id}`));
}

export function useDeleteEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      await crmFetch(`/api/${type}/${id}`, { method: 'DELETE' });
      return { type, id };
    },
    onSuccess: ({ type }) => {
      qc.invalidateQueries({ queryKey: [type] });
    },
  });
}
