# Subdomain Persistence Patterns Reference

> For detailed structure, see `principles.md` (P11, P15) and `module-scaffolding.md` (Part 2).

When a module uses the **subdomain-based** pattern (e.g., analytics with ingestion/aggregation/reporting), persistence ownership becomes a critical architectural decision. This reference covers the patterns for managing entities, repositories, and cross-subdomain data access within a single package.

> **Note (content package):** The shared kernel anti-pattern may still exist in `package/content/shared/` from legacy layout. Refactoring is deferred — see `specification/features/content-flat-restructure/`. New code must follow subdomain-owned persistence in aggregate folders.

---

## The Shared Kernel Anti-Pattern

### What Goes Wrong

Putting all entities and repositories in `shared/persistence/` creates a **monolithic shared kernel**:

```
shared/persistence/
├── entity/          # ALL entities from ALL subdomains
├── repository/      # ALL repositories from ALL subdomains
└── persistence.module.ts  # Registers + exports EVERYTHING
```

### Why It's a Problem

| Issue | Impact |
|-------|--------|
| **No ownership** | Any subdomain can read/write anything |
| **Hidden coupling** | Dependencies invisible in module graph |
| **No structural enforcement** | Write-model repo injectable into read-only subdomain |
| **Violates CQRS intent** | Write/read persistence indistinguishable |

### How to Detect

```bash
rg "exports:.*Repository" package/*/shared/persistence/*.module.ts
rg "from.*shared/persistence/repository" package/*/*/
rg "from.*\.\./\.\./(?!shared)" package/*/*/*.service.ts
```

### When Shared Persistence IS Appropriate

- **Flat modules** (billing, identity) — `shared/persistence/` holds connection only
- **Truly shared entities** — rare; entity two subdomains equally co-own

### When Shared Persistence IS Wrong

- Each subdomain has clear entity ownership
- Entities map to distinct write/read models (CQRS)
- Subdomains have different change velocity

---

## Pattern: Subdomain-Owned Persistence

Each subdomain owns entities and repositories co-located in `<subdomain>/<aggregate>/` folders. Shared layer provides only infrastructure.

### Structure

```
package/<module>/
├── <subdomain-1>/
│   ├── <aggregate>/
│   │   ├── foo.entity.ts
│   │   ├── foo.repository.ts
│   │   ├── foo.service.ts
│   │   └── __test__/
│   │       └── foo.service.spec.ts       # unit tests — same aggregate, not package-root e2e
│   ├── <subdomain-1>.module.ts         # Registers OWN repos as providers
│   └── <subdomain-1>.facade.ts
├── <subdomain-2>/
│   ├── <aggregate>/
│   │   └── bar.entity.ts
│   └── <subdomain-2>.module.ts
├── shared/
│   ├── persistence/
│   │   ├── persistence.module.ts       # TypeORM connection ONLY — zero repos
│   │   ├── typeorm-datasource.ts
│   │   ├── typeorm-datasource.factory.ts
│   │   └── migration/
│   ├── contract/
│   └── enum/
```

### Real Content Example

```
package/content/management/episode/episode.entity.ts
package/content/management/episode/episode.repository.ts
package/content/catalog/video/video-streaming.service.ts
package/content/shared/persistence/   # connection only
```

### Key Rules

1. **Entities live in `<subdomain>/<aggregate>/`** (path: `package/<module>/<subdomain>/<aggregate>/`), not in shared
2. **Repositories registered as providers in owning subdomain module**
3. **Shared persistence provides ONLY TypeORM connection**
4. **Cross-subdomain access via internal facades**, never direct repo injection
5. **Queue contracts in `shared/contract/`**, not inside subdomains
6. **Migrations stay in shared** — one database

### Datasource Factory Update

```typescript
export const dataSourceOptionsFactory = (
  configService: ConfigService<ModuleConfig>
): PostgresConnectionOptions => ({
  type: 'postgres',
  name: 'moduleName',
  entities: [
    join(__dirname, '..', '..', 'ingestion', '**', '*.entity.{ts,js}'),
    join(__dirname, '..', '..', 'aggregation', '**', '*.entity.{ts,js}'),
  ],
  migrations: [join(__dirname, 'migration', '*-migration.{ts,js}')],
});
```

### Subdomain Module Registration

```typescript
// package/analytics/ingestion/ingestion.module.ts
@Module({
  imports: [SharedModule, LoggerModule],
  providers: [ViewEventRepository, ViewEventService, IngestionFacade],
  exports: [IngestionFacade],  // facade only — not repos
})
export class IngestionModule {}
```

### Shared Persistence Module (Infrastructure Only)

```typescript
@Module({
  imports: [TypeOrmPersistenceModule.forRoot({ /* connection config */ })],
  // NO providers, NO exports — just the connection
})
export class SharedPersistenceModule {}
```

---

## Pattern: Internal Facade for Cross-Subdomain Reads

When subdomain B needs data owned by subdomain A, use an **internal facade** — not A's repositories.

### Implementation

```typescript
// package/content/management/management.facade.ts
@Injectable()
export class ManagementFacade {
  constructor(private readonly episodeRepository: EpisodeRepository) {}

  async findEpisode(id: string): Promise<EpisodeEntity | null> {
    return this.episodeRepository.findById(id);
  }
}
```

```typescript
// package/content/catalog/video/video-streaming.service.ts
@Injectable()
export class VideoStreamingService {
  constructor(private readonly managementFacade: ManagementFacade) {}

  async stream(videoId: string): Promise<StreamUrl> {
    const episode = await this.managementFacade.findEpisode(videoId);
    // ...
  }
}
```

### Module Wiring

```typescript
// management.module.ts — exports facade only
@Module({ providers: [EpisodeRepository, ManagementFacade], exports: [ManagementFacade] })
export class ManagementModule {}

// catalog.module.ts — explicit dependency
@Module({ imports: [SharedModule, ManagementModule], providers: [VideoStreamingService] })
export class CatalogModule {}
```

### Key Constraints

- Facade exposes **only needed methods** — not full repository API
- Facade is **pure delegation** — no business logic
- Dependency **visible in module graph**: B imports A
- Consumer **cannot bypass** facade — repository not exported

---

## Pattern: Event-Carried State Transfer

Enrich queue/event payloads so consumers never query the producer's data store.

### When to Use

- Consumer processes events one at a time
- Event carries all data the consumer needs
- Zero runtime coupling between data stores desired

### When NOT to Use

- Batch computations needing historical data
- Payload would carry unreasonable data volume

### Implementation

```typescript
// package/analytics/shared/contract/enriched-event.contract.ts
export interface EnrichedEventPayload {
  userId: string;
  contentId: string;
  contentType: ContentType;
  genres: string[];          // enriched — no lookup needed
  occurredAt: string;
}
```

### Combining with Internal Facades

Most subdomain modules use **both**:
- **Event-Carried State Transfer** for queue consumers
- **Internal Facades** for batch computations (trending, affinity scoring)

---

## Decision Tree: Which Pattern to Use

```
Does subdomain B need data from subdomain A?
├─ NO → No cross-subdomain coupling
├─ YES, one event at a time
│   └─ Can payload carry all data?
│       ├─ YES → Event-Carried State Transfer
│       └─ NO  → Internal Facade
├─ YES, batch queries
│   └─ Read-only downstream? → Import A's module, use facade
└─ YES, stable shared vocabulary → shared/enum/ (small, stable kernel)
```

---

## Verification Checklist

```
□ Each subdomain registers its own repos (not from shared)
□ Shared persistence module has zero repository providers/exports
□ Cross-subdomain reads go through internal facades
□ Queue contracts in shared/contract/
□ No subdomain imports from another subdomain's <aggregate>/ folders
□ Datasource factory scans all subdomain aggregate entity paths
□ Entity files in `<subdomain>/<aggregate>/` — not in shared layer
□ Unit specs for an aggregate live in `<subdomain>/<aggregate>/__test__/` (not package-root `__test__/e2e/`)
□ Module graph shows explicit subdomain dependencies
```
