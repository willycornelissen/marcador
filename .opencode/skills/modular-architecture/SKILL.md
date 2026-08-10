---
name: modular-architecture
description: >
  Fakeflix modular architecture expert. ALWAYS read this skill BEFORE proposing any fix or plan
  that involves: module imports, NestJS providers/exports, repository ownership, cross-package
  dependencies, facade design, or any structural change to a package or subdomain. The patterns
  here are Fakeflix-specific and differ from generic NestJS conventions — reasoning from first
  principles without reading this skill will produce incorrect plans (e.g. exporting repositories
  directly instead of facades). Triggers: creating modules, "scaffold a module", assessing
  architecture compliance, evaluating whether to split modules, understanding modular principles,
  fixing cross-submodule imports, reviewing module boundaries, PR review of architecture comments,
  or any mention of "architecture assessment", "module boundaries", "modularity", "compliance
  check", "maturity assessment", "create a module", "cross-boundary", "DI token", "providers",
  "exports", "repository ownership", "flat", "co-location", "depth", "suffix", "aggregate".
---

# Modular Architecture Expert

You are an expert in Fakeflix's modular architecture. This skill provides everything needed for architecture design, module creation, evaluation, and compliance assessment.

## Core Philosophy

- **Apps = Bootstraps**: Applications (`apps/`) only orchestrate modules — minimal logic
- **Packages = Logic**: All business logic lives in packages (`package/`) for maximum reusability
- **Modules = Independent, Composable Domains**: Each module is a bounded context with its own database, state, and lifecycle

## Theoretical Foundations

| Pattern | Source | What Fakeflix adopts |
|---------|--------|----------------------|
| Modular Monolith | K. Grzybek, O. Drotbohm (Spring Modulith) | Package = module = bounded context with facade |
| Bounded Context | E. Evans (DDD, 2003); V. Vernon (IDDD, 2013) | Each package owns model, vocabulary, persistence |
| Screaming Architecture | R. Martin (Clean Architecture, 2017, ch. 21) | `ls package/X/` reveals domain, not layers |
| Vertical Slice | J. Bogard (jimmybogard.com) | Aggregate = vertical slice (entity + repo + service + endpoint) |
| Package by Feature | R. Martin; P. Webb (Spring) | Organize by what (aggregate), not how (layer) |

## Module Structure (Aggregate-Based)

**Default: flat-by-aggregate** — one business concept per folder; production files co-located in the aggregate; unit tests in `__test__/` inside that aggregate.

```
package/<module>/                     # Flat (billing, identity, recommendations)
├── <aggregate>/                      # e.g., subscription/, user/, credit/
│   ├── <aggregate>.entity.ts
│   ├── <aggregate>.repository.ts
│   ├── <aggregate>.service.ts
│   ├── <aggregate>.controller.ts     # or .resolver.ts for GraphQL
│   ├── <aggregate>.types.ts
│   ├── <aggregate>.dto.ts
│   └── __test__/                     # unit specs for this aggregate
│       └── <file>.spec.ts
├── shared/persistence/               # DB connection, migrations, datasource only
├── <module>.module.ts
├── <module>.facade.ts
├── config.ts
└── index.ts                          # facade + module exports only
```

**Subdomain-based** — when subdomains have distinct scaling, execution, or ownership needs (`content`, `analytics`):

```
package/<module>/
├── <subdomain>/                      # e.g., management/, catalog/, ingestion/
│   ├── <aggregate>/                  # e.g., episode/, video/
│   │   ├── episode.entity.ts
│   │   ├── episode.repository.ts
│   │   ├── __test__/
│   │   │   └── *.spec.ts
│   │   └── ...
│   ├── <subdomain>.module.ts
│   └── <subdomain>.facade.ts
├── shared/persistence/               # Connection only — zero repos
├── <module>.module.ts
├── <module>.facade.ts
└── index.ts
```

### When to Subdomain

Use subdomain-based layout only when **4+ of 6 criteria** are met (see `references/module-scaffolding.md` Part 3): different user personas, access control, execution model, scaling, deployment independence, failure isolation. **Flat is the default** — split only when subdomains prove themselves through real usage.

### Migration from Legacy Layout

Packages previously used `core/`, `http/`, `persistence/` layer folders. All 5 packages are migrated. For migration rationale and before/after examples, see `specification/features/*-flat-restructure/`. **Never scaffold new code using the legacy layout.**

## The 10 Principles

| #   | Principle                   | Criticality | Key Rule                                          |
| --- | --------------------------- | ----------- | ------------------------------------------------- |
| 1   | **Well-Defined Boundaries** | High        | Export only facades/modules from `index.ts`       |
| 2   | **Composability**           | Medium      | Modules work independently or together            |
| 3   | **Independence**            | High        | No shared mutable state; test in isolation        |
| 4   | **Individual Scale**        | Medium      | Module-specific resource configurations           |
| 5   | **Explicit Communication**  | High        | All inter-module contracts via interfaces/DTOs    |
| 6   | **Replaceability**          | Medium      | Interface-based dependencies where needed         |
| 7   | **Deployment Independence** | Medium      | No deployment assumptions in modules              |
| 8   | **State Isolation**         | 🔴 CRITICAL | Module-prefixed entity names; no shared DB tables |
| 9   | **Observability**           | High        | Module-specific logging, metrics, health checks   |
| 10  | **Fail Independence**       | High        | Circuit breakers; failures don't cascade          |

Structural principles P11–P19 (co-location, depth, suffixes, services, shared kernel) are in `references/principles.md`.

## Top 8 Critical Violations

1. 🔴 **Duplicate entity names** — `@Entity({ name: 'Plan' })` in multiple modules → use `BillingPlan`, `ContentPlan`
2. 🔴 **Cross-module database access** — `@InjectRepository(UserEntity, 'identity')` in billing module
3. 🔴 **Monolithic shared persistence in subdomain modules** — shared module registering ALL repos for ALL subdomains → each subdomain owns its repos
4. 🟠 **Fat controllers** — business logic in controllers instead of services
5. 🟠 **Repository injection in controllers** — controllers must only inject services
6. 🟠 **Missing `@Transactional({ connectionName })` on writes** — always name the connection
7. 🟠 **Exporting internal services** — subdomains must expose only facades, never services or repositories
8. 🟠 **Facade containing logic** — facades must be pure delegation to services; all querying and mapping belongs in services

## Decision Tree: Which Reference to Load

```
TASK TYPE                              → LOAD REFERENCE
─────────────────────────────────────────────────────────
Creating a new flat package            → references/module-scaffolding.md (Part 1)
Creating a subdomain-based package     → references/module-scaffolding.md (Part 2)
Evaluating whether to split a module   → references/module-scaffolding.md (Part 3)
Assessing architecture compliance      → references/verification.md
Structural compliance (depth, suffix)  → references/verification.md (Section 2)
Understanding a specific principle     → references/principles.md
Running detection commands             → references/verification.md
Maturity scoring                       → references/verification.md (Section 3)
Managing persistence in subdomain      → references/subdomain-persistence.md
  modules (ownership, facades,
  cross-subdomain data access)
Co-location / depth / suffix rules     → references/principles.md (P11–P19)
```

## Use Case Instructions

### Creating a New Module

Load `references/module-scaffolding.md` — Part 1 (flat) or Part 2 (subdomain-based).

Follow this process:

1. Gather requirements (module name, pattern, entities, external integrations)
2. Decide architecture pattern: **flat** (single domain, 3–8 entities) vs **subdomain-based** (10+ entities or independent scaling needs)
3. If subdomain-based, load `references/subdomain-persistence.md` for persistence ownership patterns
4. Generate structure → config → entities → repositories → persistence module → services → controllers → DTOs → unit specs in `<aggregate>/__test__/` → main module → index.ts → NX config files
5. Run verification commands from `references/verification.md`

### Evaluating Whether to Split a Module

Load `references/module-scaffolding.md` — Part 3: Module Evaluation.

Apply the 6-criteria test and cohesion/coupling scoring. Key principle: **flat is often better** — split only when sub-domains prove themselves through real usage.

### Managing Persistence in Subdomain Modules

Load `references/subdomain-persistence.md`.

Use when a subdomain-based module needs to assign entity/repository ownership to individual subdomains. Key patterns:

- **Subdomain-owned persistence**: each subdomain registers its own repos (not shared)
- **Internal facades**: cross-subdomain reads go through explicit facades
- **Event-carried state transfer**: enrich queue payloads to avoid cross-subdomain queries
- **Shared kernel anti-pattern**: detect and refactor monolithic shared persistence

### Assessing Architecture Compliance

Load `references/verification.md`.

Run all detection commands (modular + structural), then score each principle. Produce a prioritized report with P0 (critical), P1 (high), P2 (medium) recommendations.

### Understanding a Specific Principle

Load `references/principles.md`.

Each principle includes: definition, rules for AI agents, and one key code example.

## Quick Anti-Pattern Check

Before generating any code, verify:

**Modular (P1–P10):**
- [ ] Entity names use module prefix (`BillingPlan`, not `Plan`)
- [ ] No duplicate `@Entity` names across modules
- [ ] Controllers only inject services (not repositories)
- [ ] Write operations use `@Transactional({ connectionName: 'moduleName' })`
- [ ] `index.ts` exports only facades and module class
- [ ] Cross-module communication via HTTP/events (never direct DB access)
- [ ] In subdomain modules: each subdomain registers its own repos (shared module has zero repos)
- [ ] In subdomain modules: cross-subdomain reads use internal facades, not shared repo injection

**Structural (P11–P19):**
- [ ] One aggregate = one folder (`billing/subscription/`, not `billing/core/service/`)
- [ ] File suffixes over technical folders (`.types.ts`, not `types/`)
- [ ] Depth ≤2 (flat) or ≤3 (subdomain-based) for business files
- [ ] No single-file folders (use suffix instead, e.g., `wallet.constants.ts`) — `__test__/` in an aggregate is the sanctioned exception (see `references/principles.md` P11, P14)
- [ ] Aggregate ≤~15 files (signal to split); ≥~25 files (strong split candidate)
- [ ] No README inside aggregate folders
