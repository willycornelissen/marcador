# Module Scaffolding & Evaluation Reference

---

# Part 1: Flat Package Creation

## Requirements Gathering

Before generating code, gather:
1. **Module name** (kebab-case, e.g., "billing", "identity", "notifications")
2. **Architecture pattern**: flat (default) or subdomain-based
3. **Initial aggregates** (comma-separated, e.g., "Subscription, Invoice, Payment")
4. **External integrations** (any third-party services?)
5. **Async processing** (will it use queues?)

## Architecture Decision

```
Does the module have multiple distinct subdomains that could scale independently?
├─ YES → Subdomain-Based Pattern (Part 2)
│         Examples: Content (management, catalog), Analytics (ingestion, aggregation)
└─ NO → Flat Package Pattern (this section)
          Examples: Billing, Identity, Recommendations, Notifications
```

- **Flat Package**: Single cohesive domain, 3–8 entities/aggregates
- **Subdomain-Based**: 10+ entities or subdomains with independent scaling/failure needs

## Flat Package Structure

Real examples: `package/billing/`, `package/identity/`

```
package/<module>/
├── <aggregate>/                              # One business concept per folder
│   ├── <aggregate>.entity.ts
│   ├── <aggregate>.repository.ts
│   ├── <aggregate>.service.ts
│   ├── <aggregate>.controller.ts             # REST — or .resolver.ts for GraphQL
│   ├── <aggregate>.types.ts
│   ├── <aggregate>.dto.ts
│   ├── <aggregate>.client.ts                 # optional — external API client
│   └── __test__/                             # unit specs for this aggregate only
│       └── <file>.spec.ts                    # e.g. <aggregate>.service.spec.ts
├── shared/
│   └── persistence/
│       ├── migration/
│       ├── <module>-persistence.module.ts
│       ├── typeorm-datasource.ts
│       └── typeorm-datasource.factory.ts
├── __test__/
│   ├── e2e/<flow>.e2e-spec.ts
│   └── factory/
├── <module>.module.ts
├── <module>.facade.ts
├── config.ts
├── index.ts
├── package.json
├── tsconfig.json, tsconfig.lib.json, tsconfig.spec.json
├── jest.config.ts
└── eslint.config.mjs
```

### Real Billing Example

```
package/billing/
├── subscription/
│   ├── subscription.entity.ts
│   ├── subscription.repository.ts
│   ├── subscription.service.ts
│   ├── subscription.controller.ts
│   ├── subscription.types.ts
│   ├── subscription.dto.ts
│   └── __test__/
│       └── subscription.service.spec.ts
├── invoice/
├── payment/
├── plan/
├── credit/
├── shared/persistence/
├── billing.module.ts
├── billing.facade.ts
├── config.ts
└── index.ts
```

### Real Identity Example

```
package/identity/user/user.{entity,repository,management.service,resolver,types}.ts
package/identity/user/__test__/user-management.service.spec.ts
package/identity/auth/authentication.service.ts
package/identity/auth/__test__/authentication.service.spec.ts
package/identity/shared/persistence/
```

## Component Templates

### config.ts (Zod Schema)

```typescript
import { ConfigException, environmentSchema } from '@tlc/shared-module/config';
import { z } from 'zod';

const databaseSchema = z.object({
  host: z.string(),
  database: z.string(),
  password: z.string(),
  port: z.coerce.number(),
  url: z.string().startsWith('postgresql://'),
  username: z.string(),
});

const {moduleName} = z.object({ database: databaseSchema });
export const configSchema = z.object({ env: environmentSchema, {moduleName} });
export type {ModuleName}Config = z.infer<typeof configSchema>;

export const factory = (): z.infer<typeof configSchema> => {
  const result = configSchema.safeParse({
    env: process.env.NODE_ENV,
    {moduleName}: {
      database: {
        host: process.env.{MODULE_NAME}_DATABASE_HOST,
        database: process.env.{MODULE_NAME}_DATABASE_NAME,
        password: process.env.{MODULE_NAME}_DATABASE_PASSWORD,
        port: process.env.{MODULE_NAME}_DATABASE_PORT,
        url: `postgresql://${process.env.{MODULE_NAME}_DATABASE_USERNAME}:...@${process.env.{MODULE_NAME}_DATABASE_HOST}:${process.env.{MODULE_NAME}_DATABASE_PORT}/${process.env.{MODULE_NAME}_DATABASE_NAME}`,
        username: process.env.{MODULE_NAME}_DATABASE_USERNAME,
      },
    },
  });
  if (result.success) return result.data;
  throw new ConfigException(`Invalid configuration: ${result.error.message}`);
};
```

### Entity, Repository, Service, Controller

Production files co-located in `package/<module>/<aggregate>/`; unit specs in `package/<module>/<aggregate>/__test__/`. See `.opencode/docs/coding-patterns.md` for patterns.

```typescript
// package/billing/subscription/subscription.entity.ts — module-prefixed: BillingSubscription
// package/billing/subscription/subscription.repository.ts — @InjectDataSource('billing')
// package/billing/subscription/subscription.service.ts — @Transactional({ connectionName: 'billing' })
// package/billing/subscription/subscription.controller.ts — injects service only, lean methods
```

## Facade Rules

The pattern is always **Facade → Service → Repository**. Facades only delegate; services own the logic.

1. **A facade is pure delegation only** — no querying, mapping, or business logic
2. **Never export internal services** — only facade + module from `index.ts`
3. **Package-level facade composes aggregate services** — pure delegation

### Package Facade Example

```typescript
// package/billing/billing.facade.ts
@Injectable()
export class BillingFacade implements BillingApi {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  isUserSubscriptionActive(userId: string): Promise<boolean> {
    return this.subscriptionService.isUserSubscriptionActive(userId);
  }
}
```

### Main Module

```typescript
// package/billing/billing.module.ts
@Module({
  imports: [
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),
    BillingPersistenceModule,
    AuthModule,
    LoggerModule,
  ],
  providers: [SubscriptionService, SubscriptionRepository, BillingFacade, /* ... */],
  controllers: [SubscriptionController, /* ... */],
  exports: [BillingFacade],
})
export class BillingModule {}

export { factory as billingConfigFactory } from './config';
```

### index.ts (Public Exports Only)

```typescript
export * from './billing.module';
export * from './config';
// DO NOT export: services, repositories, controllers, entities
```

## Generation Order

1. Gather requirements
2. Confirm flat pattern (3–8 aggregates)
3. Create aggregate folders with co-located production files and `__test__/` for unit specs
4. Generate `config.ts` with Zod schema
5. Generate entities (module-prefixed names) in `<aggregate>/`
6. Generate repositories in `<aggregate>/`
7. Generate `shared/persistence/` (connection + datasource only)
8. Generate services with `@Transactional`
9. Generate controllers/resolvers (lean)
10. Generate DTOs and types (suffixes, not folders)
11. Generate unit specs in `<aggregate>/__test__/<file>.spec.ts` (imports use `../` to reach production files)
12. Generate `<module>.module.ts` and `<module>.facade.ts`
13. Generate `index.ts` (public exports only)
14. Generate NX config files
15. Run verification from `references/verification.md`

## Post-Generation Checklist (Flat)

- [ ] One aggregate = one folder (P11)
- [ ] Unit specs under `<aggregate>/__test__/` (not beside production `.service.ts` / `.entity.ts`)
- [ ] Suffixes used, no single-file folders (P12, P14) — except sanctioned `__test__/` per `principles.md` P14
- [ ] Depth ≤ 2 for business files (P13)
- [ ] No README inside aggregates (P17)
- [ ] No duplicate entity names across modules
- [ ] All repositories use `@InjectDataSource('<moduleName>')`
- [ ] Write services use `@Transactional({ connectionName: '<moduleName>' })`
- [ ] Controllers inject services only (never repositories)
- [ ] `index.ts` exports only facade and module class
- [ ] Facades contain only delegation
- [ ] `yarn lint:structure` passes
- [ ] `nx lint:check <moduleName>` passes

---

# Part 2: Subdomain-Based Package Creation

Use when 4+ of 6 evaluation criteria are met (Part 3). Real examples: `package/content/`, `package/analytics/`.

> **Important**: Each subdomain owns its entities and repositories co-located in aggregate folders.
> The shared layer holds only infrastructure (DB connection, migrations, enums, queue config).
> See `references/subdomain-persistence.md` for ownership patterns.

## Subdomain-Based Structure

```
package/<module>/
├── <subdomain>/                              # e.g., management/, catalog/, ingestion/
│   ├── <aggregate>/                          # e.g., episode/, video/
│   │   ├── <aggregate>.entity.ts
│   │   ├── <aggregate>.repository.ts
│   │   ├── <aggregate>.service.ts
│   │   ├── __test__/
│   │   │   └── <file>.spec.ts               # unit tests for this aggregate
│   │   └── ...
│   ├── <subdomain>.module.ts                 # Registers OWN repos + services
│   └── <subdomain>.facade.ts                 # Pure delegation — exported to siblings
├── shared/
│   ├── contract/                             # Queue/event payload types
│   ├── enum/                                 # Stable domain vocabulary
│   └── persistence/
│       ├── migration/
│       ├── persistence.module.ts             # TypeORM connection ONLY — zero repos
│       ├── typeorm-datasource.ts
│       └── typeorm-datasource.factory.ts
├── <module>.module.ts                        # Composes subdomains
├── <module>.facade.ts                        # Composes subdomain facades
├── config.ts
└── index.ts
```

### Real Content Example

```
package/content/
├── management/
│   ├── episode/
│   │   ├── episode.entity.ts
│   │   ├── episode.repository.ts
│   │   ├── episode-lifecycle.service.ts
│   │   └── __test__/
│   │       └── episode-lifecycle.service.spec.ts
│   ├── movie/
│   ├── tv-show/
│   ├── management.module.ts
│   └── management.facade.ts
├── catalog/
│   ├── video/
│   │   ├── video-streaming.service.ts
│   │   └── video.resolver.ts
│   ├── content/
│   ├── catalog.module.ts
│   └── catalog.facade.ts
├── shared/persistence/
├── content.module.ts
├── content.facade.ts
└── index.ts
```

### Real Analytics Example

```
package/analytics/ingestion/view-event/view-event.entity.ts
package/analytics/aggregation/watch-history/watch-history.repository.ts
package/analytics/shared/persistence/   # connection only
```

## Subdomain Module Registration

```typescript
// package/content/management/management.module.ts
@Module({
  imports: [SharedModule, LoggerModule],
  providers: [
    EpisodeRepository,
    EpisodeLifecycleService,
    ManagementFacade,
  ],
  exports: [ManagementFacade],  // facade only — not repos
})
export class ManagementModule {}
```

## Subdomain Facade

```typescript
// package/content/management/management.facade.ts
@Injectable()
export class ManagementFacade {
  constructor(private readonly episodeService: EpisodeLifecycleService) {}

  getEpisode(id: string): Promise<EpisodeEntity | null> {
    return this.episodeService.findById(id);  // pure delegation
  }
}
```

## Package-Level Facade

```typescript
// package/content/content.facade.ts
@Injectable()
export class ContentFacade implements ContentApi {
  constructor(
    private readonly managementFacade: ManagementFacade,
    private readonly catalogFacade: CatalogFacade,
  ) {}

  getEpisode(id: string): Promise<EpisodeEntity | null> {
    return this.managementFacade.getEpisode(id);
  }
}
```

## Datasource Factory (Subdomain Entities)

```typescript
// package/content/shared/persistence/typeorm-datasource.factory.ts
entities: [
  join(__dirname, '..', '..', 'management', '**', '*.entity.{ts,js}'),
  join(__dirname, '..', '..', 'catalog', '**', '*.entity.{ts,js}'),
],
```

## Cross-Subdomain Data Access

When subdomain B needs data from subdomain A:
- Import subdomain A's module and use its exported **facade** — never inject A's repositories
- See `references/subdomain-persistence.md` for Internal Facade and Event-Carried State Transfer patterns

## Post-Generation Checklist (Subdomain)

All flat checklist items, plus:
- [ ] Depth ≤ 3 for business files (P13)
- [ ] Each subdomain registers its own repos as providers
- [ ] Shared persistence module has zero repository providers/exports
- [ ] Cross-subdomain reads go through internal facades
- [ ] Queue/event contract types live in `shared/contract/`
- [ ] Datasource factory scans all subdomain aggregate entity paths
- [ ] No subdomain imports from another subdomain's aggregate folders directly

---

# Part 3: Evaluation — When to Split or Refactor

## When to Evaluate

Use when a flat package is growing and may need subdomain splitting, or when an aggregate exceeds ~15 files.

## Evaluation Process

### Step 1: Gather Module Information

```bash
# Services (flat)
find package/<module> -name "*.service.ts" -not -path "*/shared/*" -not -path "*/__test__/*"

# Entities
find package/<module> -name "*.entity.ts" -not -path "*/shared/*"

# Controllers / resolvers
find package/<module> \( -name "*.controller.ts" -o -name "*.resolver.ts" \) -not -path "*/__test__/*"

# Count aggregates (top-level folders excluding shared, __test__, config files)
ls -d package/<module>/*/  | grep -v shared | grep -v __test__
```

### Step 2: Identify Sub-Domain Signals

| Signal | Description |
|--------|-------------|
| **Different User Personas** | Admin vs customer; internal vs external |
| **Different Execution Models** | Sync REST vs async queues vs GraphQL |
| **Different Technical Characteristics** | Read-heavy vs write-heavy; CPU-bound vs I/O-bound |
| **Different Change Velocities** | Experimental vs stable; different team ownership |
| **Independent Deployment Potential** | Could this be a separate microservice? |

### Step 3: Measure Cohesion and Coupling

**Cohesion Score (1–5, higher is better):**
- 5: Single, clear responsibility
- 3: Some overlap but can work independently
- 1: Unrelated, grouped arbitrarily

**Coupling Score (1–5, lower is better):**
- 1: Groups never interact
- 3: Regular communication through well-defined interfaces
- 5: Tightly coupled, can't function independently

**Decision Matrix:**
```
High Cohesion (4-5) + Low Coupling (1-2)   → STRONG CANDIDATE for subdomains
High Cohesion (4-5) + High Coupling (4-5)  → KEEP TOGETHER (flat)
Low Cohesion (1-2)  + Any Coupling         → REFACTOR first, don't split
```

### Step 4: 6-Criteria Test

| # | Criterion | Question |
|---|-----------|----------|
| 1 | User Persona | Does this serve fundamentally different users? |
| 2 | Access Control | Does this need different authorization models? |
| 3 | Execution Model | Different protocols (REST vs Queue vs GraphQL)? |
| 4 | Scaling Needs | Different scaling characteristics? |
| 5 | Deployment | Could this be deployed independently? |
| 6 | Failure Isolation | Can this fail without affecting other parts? |

**Decision:**
- ✅ **4+ criteria met** → STRONG recommendation for subdomain-based layout
- ⚠️ **2–3 criteria met** → CONSIDER subdomains (evaluate trade-offs)
- ❌ **0–1 criteria met** → KEEP FLAT structure

### Step 5: Aggregate Split vs Subdomain Promotion

| Situation | Action |
|-----------|--------|
| Single aggregate > ~25 files | Split into sub-aggregates within same flat package |
| Flat package > ~8 aggregates with low coupling | Consider subdomain-based refactor |
| Flat package with high coupling between aggregates | Keep flat — coupling means they belong together |
| Subdomain with only 1–2 aggregates | Keep as subdomain section, don't over-nest |

## Fakeflix Examples

### Content — Subdomain-Based ✅

```
content/management/   # Admin users, sync REST, write path
content/catalog/      # Consumers, GraphQL, read path
```

Why: 4/6 criteria (different users, execution models, scaling, deployment potential)

### Analytics — Subdomain-Based with Owned Persistence ✅

```
analytics/ingestion/     # Write path — owns ViewEvent
analytics/aggregation/   # Processing — owns WatchHistory, Trending
analytics/reporting/     # Read-only dashboard
analytics/shared/        # Connection only — zero repos
```

Why: 4/6 criteria (CQRS write/read separation, different scaling, could deploy independently)

### Billing — Flat ✅

```
billing/subscription/  billing/invoice/  billing/payment/  billing/plan/
```

Why flat is correct: 0/6 criteria (same users, same REST model, tightly coupled — subscriptions create invoices)

## Red Flags: When NOT to Split

- ❌ "The package feels big" — size alone is not a reason
- ❌ "To make code easier to find" — use aggregate naming, not layer folders
- ❌ "Features are tightly coupled" — high coupling means they belong together
- ❌ "To match team structure" — don't let org chart drive architecture

## Green Lights: When TO Split

- ✅ Different user types (admin vs customer)
- ✅ Different failure modes (background can fail without affecting API)
- ✅ Different scaling (CPU-intensive vs simple CRUD)
- ✅ Could logically be separate microservices
- ✅ Different change velocities

## Output Format for Evaluation

Report: pattern (flat/subdomain), aggregate count, 6-criteria score, cohesion/coupling, recommendation with rationale and proposed structure if splitting.
