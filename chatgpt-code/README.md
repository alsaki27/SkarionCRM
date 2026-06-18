# Skarion CRM

This repository contains a **work‑in‑progress** implementation of the Skarion CRM as defined in the project planning document.  The goal of this codebase is to provide a starting point for a modern CRM tailored for a career‑bootcamp focusing on outside plant (OSP) engineering roles.  The architecture follows the blueprint closely and can be deployed on **Supabase** for the database, **Railway** for the backend and **Vercel** for the frontend.  The entire stack is written in **TypeScript** for end‑to‑end type safety.

> **Important:**
>
> This is not yet a production‑ready CRM.  It contains a skeleton for the database schema, API routes, and a minimal frontend that demonstrates how the pieces fit together.  Many features such as the AI integration, full pipeline automation, Teams bot, and extensive UI views still need to be fleshed out.  However, the repository shows how to map the blueprint to actual code and is ready for local development against a Supabase project.

## Getting Started

1. **Install the Supabase CLI** (if you haven’t already):
   ```sh
   npm install -g supabase
   ```

2. **Create a new Supabase project** from the Supabase dashboard and note the database connection string.

3. **Initialize the database** using the SQL in `supabase/migrations/202406181530_init.sql`:
   ```sh
   supabase db remote commit -m "Initial migration" -f supabase/migrations/202406181530_init.sql
   ```

4. **Copy `.env.example` to `.env`** and fill in the environment variables for your Supabase project and Clerk keys.

5. **Install dependencies** for both the backend and frontend:
   ```sh
   cd backend && npm install
   cd ../frontend && npm install
   ```

6. **Run the development servers**:
   - In one terminal, start the API server:
     ```sh
     cd backend && npm run dev
     ```
   - In another terminal, start the frontend:
     ```sh
     cd frontend && npm run dev
     ```

7. Open your browser at `http://localhost:5173` to explore the minimal dashboard.

## Repository Structure

```
answer/
├── backend/         # tRPC/Express API server
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts              # Express server entrypoint
│   │   ├── trpc.ts               # tRPC router and context setup
│   │   ├── db/
│   │   │   ├── schema.ts         # Drizzle schema definitions
│   │   │   └── client.ts         # Database connection using Supabase
│   │   ├── routers/
│   │   │   ├── app.ts            # Aggregates all routers
│   │   │   └── lead.ts           # Example lead router implementation
│   │   └── services/             # Placeholder services (AI, assignment, etc.)
│   └── .env.example
├── frontend/       # React/Vite frontend
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api.ts               # Client for calling the tRPC API
│       ├── pages/
│       │   ├── Home.tsx
│       │   └── Leads.tsx        # Minimal leads list
│       └── components/
│           └── LeadTable.tsx    # Simple lead table component
└── supabase/
    ├── migrations/
    │   └── 202406181530_init.sql # Database schema for Supabase
    └── seed.sql                  # Placeholder seed file

```

## Notes

* **Supabase as PostgreSQL:**  Supabase uses PostgreSQL under the hood.  The schema defined in `202406181530_init.sql` follows the planning document exactly and can be applied directly to a Supabase project.  You can edit the file to add custom constraints or seed data.
* **Clerk Authentication:**  The blueprint suggests using Clerk for authentication.  A `.env.example` is provided with placeholders for your Clerk keys.  The backend doesn’t yet include actual authentication logic; you will need to integrate Clerk middleware and verify JWTs in production.
* **AI and Teams Integration:**  The AI router and Teams bot are not implemented in this skeleton.  Services such as `leadScoringService` or `aiService` are stubbed out for future work.

Feel free to build upon this foundation, extend the routers, and add more pages and functionality according to the blueprint.