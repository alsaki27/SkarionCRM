// Type-only re-export to share tRPC AppRouter type between server and client
// This file is imported as a dev dependency; no server runtime code is bundled into the client
export type { AppRouter } from '../../../../server/src/routers/_app.js';
