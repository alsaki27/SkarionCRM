import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import superjson from 'superjson';

// NOTE: In a real setup you would import the `AppRouter` type from the
// backend package to get full type safety.  Because this project is
// structured as two separate packages the type cannot be imported
// directly; instead we use `any` here.  To enable end‑to‑end types you
// could extract the AppRouter type into a shared package.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppRouter = any;

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = createTRPCProxyClient<AppRouter>({
  transformer: superjson,
  links: [
    httpBatchLink({
      url: '/trpc',
    }),
  ],
});