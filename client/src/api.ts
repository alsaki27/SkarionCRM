import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';

import type { AppRouter } from '@skarion/shared';
export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  if (typeof window === 'undefined') {
    return process.env.VITE_API_URL || 'http://localhost:8787';
  }
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:8787';
  }
  // Production: Cloudflare Workers (update this to your actual Workers URL)
  return import.meta.env.VITE_API_URL || 'https://skarion-crm-api.alsaki27.workers.dev';
};

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/trpc`,
      headers() {
        const token = localStorage.getItem('skarion_token');
        return {
          Authorization: token ? `Bearer ${token}` : '',
        };
      },
    }),
  ],
  transformer: superjson,
});
