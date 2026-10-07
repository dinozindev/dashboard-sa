<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Load freight dashboard data through paginated, smaller Data API queries instead of one database JSON aggregation, because thousands of geometries can exceed query time limits.
- Operational capacity lives in `capacity_settings`, `capacity_policies` and `capacity_consumption`, keyed by `stores.id`, with a trigger seeding the mandatory `Ecommerce` policy and `getCapacityOverview` self-healing any store missing it (`DEFAULT_LIMITS`: 10/day, Sunday 0), because every store must always have a primary commercial policy.
- Capacity projection math lives in `src/lib/freight/capacity-model.ts`, separate from the server functions, so the D+3 overflow rules stay testable and UI-independent.

- Access control uses Google sign-in (corporate Google federates to PingID) plus `public.user_roles` (consultor/editor/auditor); a signup trigger rejects non-corporate domains and auditors manage roles in-app, because governance stays with the app team without IdP metadata.
