# Chunk 3 Execution Plan

## Stage 1 — Foundation (3.1, 3.2, 3.3)
- Set up Tailwind + shadcn/ui base in packages/ui
- Configure apps/crm/web with react-router-dom, TanStack Query, Zustand
- Build AppShell: sidebar (role-conditional), top bar, main content area
- Wire auth (already have api.ts — extend with hooks)
- Command palette (cmd-K) placeholder
- Mobile responsive layout

## Stage 2 — Core Pages (3.4, 3.5, 3.8)
- Dashboard (role-aware widgets)
- Leads: list view (DataTable), detail view, activity timeline
- Companies: list + detail
- Contacts: list + detail
- Opportunities: list + detail
- Activities: inline logging on detail pages

## Stage 3 — Advanced Views (3.6, 3.7, 3.9)
- Pipeline Kanban (drag-drop with optimistic updates)
- Tasks: list view, "My Day", quick-add
- Charts via recharts on dashboard

## Stage 4 — Settings & Polish (3.10, 3.11, 3.12)
- Settings pages (team, pipelines, tags, custom fields, integrations)
- Onboarding flow
- Mobile responsiveness pass

## Deliverables
- All routes work end-to-end
- TypeScript strict, lint clean
- Mobile usable
