# Source layout and naming

```
src/
  auth/            sign-in, staff-ID -> role map, session reset
  components/
    primitives/    design-system controls (Button, Input, Select, Modal ...); no business logic
    domain/        controls that know about VFQ data (MsisdnPicker, QidInput, EligibilityGateStep ...)
    patterns/      multi-step building blocks; patterns/wizard/ is the guided-journey shell and shared steps
  data/            synthetic values + reference catalogues (see data/README.md)
  engines/         non-UI logic and data access (mockDataEngine, configEngine, activityEngine ...)
  hooks/           app-wide hooks
  lib/             tiny pure helpers (values.ts)
  modules/         one folder per product line / journey; screens/index.tsx registers its screens
    new-connection/  the New Postpaid Activation journey: wizard at the root, steps/ and hooks/ beside it
  navigation/      sidebar, breadcrumbs, global search, persona switcher
  stores/          zustand stores (customerContextStore holds the viewed customer and the journey customer)
  types/           shared types
  workspace/       pages that are not product-line journeys (customer360/, tickets, tasks, orders ...)
    customer360/     layout + header; sections/ (Retail tab pages, topic sections); telesales/ (Telesales layout)
```

## Naming

- **Components**: `PascalCase.tsx`, one main component per file (`CustomerTypeStep.tsx`).
- **Everything else** (models, helpers, hooks, step-list builders): `camelCase.ts(x)` - `customerTypeModel.ts`,
  `useJourneyCustomerLock.ts`, `buildMnpSteps` in `mnpSteps.tsx`.
- A file that exports components should not also export constants or functions (fast refresh); put those in a
  `*Model.ts` / `*Shared.ts` next to it.
- Tokens: colours, sizes and field state colours come from `tokens.css`; no hex values in components.
- Synthetic content is marked with `SYNTHETIC_CLASS` / `Synthetic<T>` (`data/synthetic/syntheticMarker.ts`).
