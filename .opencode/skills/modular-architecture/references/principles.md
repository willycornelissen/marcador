# Modular Architecture Principles Reference

All 19 principles with rules and key code examples.

## Summary

| # | Principle | Type | Criticality |
|---|-----------|------|-------------|
| 1 | Well-Defined Boundaries | Modular | High |
| 2 | Composability | Modular | Medium |
| 3 | Independence | Modular | High |
| 4 | Individual Scale | Modular | Medium |
| 5 | Explicit Communication | Modular | High |
| 6 | Replaceability | Modular | Medium |
| 7 | Deployment Independence | Modular | Medium |
| 8 | State Isolation | Modular | 🔴 CRITICAL |
| 9 | Observability | Modular | High |
| 10 | Fail Independence | Modular | High |
| 11 | Co-location by Aggregate | Structural | High |
| 12 | Suffixes > Folders | Structural | Medium |
| 13 | Depth ≤ 2–3 | Structural | High |
| 14 | Folder Only if ≥ 2–3 Files | Structural | Medium |
| 15 | Aggregate Limits | Structural | Medium |
| 16 | AI-Flat Optimization | Structural | Medium |
| 17 | No README in Aggregate | Structural | Low |
| 18 | Service as Default Unit | Structural | Medium |
| 19 | Intentional Shared Kernel is Legitimate | Structural | Medium |

---

## P1: Well-Defined Boundaries

Each module has clear responsibilities and doesn't expose internal details to other modules.

**Rules:**
- ✅ Keep all domain logic within module boundaries
- ✅ Export only public facades and modules from `index.ts`
- ❌ Never import internal classes from other modules
- ❌ Never share database entities between modules

```typescript
// ✅ GOOD: package/billing/index.ts
export { BillingModule } from './billing.module';
export { billingConfigFactory } from './config';
// Services, repositories, entities stay internal

// ❌ BAD: Exposing internals
export { SubscriptionService } from './subscription/subscription.service';
export { Subscription } from './subscription/subscription.entity';
```

---

## P2: Composability

Modules are building blocks that combine flexibly to create different applications.

**Rules:**
- ✅ Design modules to work independently or together
- ✅ Create multiple apps with different module combinations
- ✅ Use dependency injection for loose coupling
- ❌ Never create tight coupling between modules

```typescript
// ✅ GOOD: Same modules, different app compositions
@Module({ imports: [ContentModule, IdentityModule] })  // Monolith
export class MonolithModule {}

@Module({ imports: [BillingModule] })  // Microservice
export class BillingApiModule {}
```

---

## P3: Independence

Modules operate autonomously without tight coupling in code or infrastructure.

**Rules:**
- ✅ Modules can be built, tested, and deployed independently
- ✅ Use interfaces and events for inter-module communication
- ✅ Each module's tests run in isolation
- ❌ Never create shared mutable state between modules
- ❌ Never use direct method calls between modules

```typescript
// ✅ GOOD: Communication via interface, not direct dependency
export interface BillingSubscriptionStatusApi {
  isUserSubscriptionActive(userId: string): Promise<boolean>;
}

@Injectable()
export class BillingFacade implements BillingSubscriptionStatusApi {
  constructor(private readonly subscriptionService: SubscriptionService) {}
  async isUserSubscriptionActive(userId: string): Promise<boolean> {
    return this.subscriptionService.isUserSubscriptionActive(userId);
  }
}

// ❌ BAD: Direct coupling to another module's service
@Injectable()
export class SubscriptionService {
  constructor(private identityService: IdentityService) {} // ❌
}
```

---

## P4: Individual Scale

Each module can scale based on its specific resource needs without affecting others.

**Rules:**
- ✅ Design modules to scale independently (multiple app instances)
- ✅ Use resource-specific configurations per module
- ❌ Never create shared resource bottlenecks between modules

```typescript
// ✅ GOOD: Module-specific scaling configuration
BullModule.registerQueue({
  name: QUEUES.VIDEO_PROCESSING,
  processors: [{ name: 'video-transcription', concurrency: 5 }], // Content-specific
})
```

---

## P5: Explicit Communication

All inter-module communication happens through well-defined contracts.

**Rules:**
- ✅ Define clear interfaces for all module interactions
- ✅ Use DTOs for data transfer between modules
- ❌ Never access other modules' internal data structures
- ❌ Never make assumptions about other modules' implementations

```typescript
// ✅ GOOD: Explicit interface contract in shared package
export interface BillingSubscriptionStatusApi {
  isUserSubscriptionActive(userId: string): Promise<boolean>;
  getSubscriptionPlan(userId: string): Promise<SubscriptionPlan | null>;
}

// ✅ GOOD: HTTP client implements the contract
@Injectable()
export class BillingSubscriptionHttpClient implements BillingSubscriptionStatusApi {
  async isUserSubscriptionActive(userId: string): Promise<boolean> {
    const { isActive } = await this.httpClient.get<...>(
      `${this.configService.get('billingApi').url}/subscription/user/${userId}/active`
    );
    return isActive;
  }
}
```

---

## P6: Replaceability

Modules can be substituted without affecting other parts of the architecture.

**Rules:**
- ✅ Design modules to be swappable behind interfaces
- ✅ Use dependency injection for all module dependencies
- ❌ Never create hard dependencies on specific implementations
- ❌ Never export concrete classes as module APIs

```typescript
// ✅ GOOD: Swappable implementations
@Module({
  providers: [{
    provide: VideoSummaryGenerationAdapter,
    useFactory: (config: ConfigService) => {
      switch (config.get('VIDEO_PROCESSING_PROVIDER')) {
        case 'gemini': return new GeminiTextExtractorClient();
        case 'openai': return new OpenAITextExtractorClient();
      }
    },
    inject: [ConfigService],
  }],
})
export class ContentVideoProcessorModule {}
```

---

## P7: Deployment Independence

Modules don't dictate how they're deployed — they can run as monolith or distributed services.

**Rules:**
- ✅ Design modules to work in any deployment configuration
- ✅ Use environment variables for deployment-specific config
- ✅ Keep deployment logic in apps, not modules
- ❌ Never hard-code deployment assumptions in modules

```typescript
// ✅ GOOD: Deployment-agnostic module
@Module({
  imports: [TypeOrmModule.forRootAsync({
    useFactory: (config: ConfigService) => ({
      host: config.get('CONTENT_DB_HOST'),
      port: config.get('CONTENT_DB_PORT'),
      database: config.get('CONTENT_DB_NAME'),
    }),
  })],
})
export class ContentModule {}
```

---

## P8: State Isolation ⚠️ CRITICAL

Each module owns and manages its own state without sharing databases with other modules.

**Rules:**
- ✅ Give each module its own named database connection
- ✅ Prefix ALL entity names with module name (e.g., `BillingPlan`, not `Plan`)
- ✅ Use events or APIs for cross-module data needs
- ✅ Replicate minimal data per module (string references, not foreign keys)
- ❌ NEVER create duplicate `@Entity({ name: 'X' })` across modules — most critical violation
- ❌ Never share database tables between modules
- ❌ Never access other modules' repositories
- ❌ Never use foreign keys across module boundaries

_See `.opencode/docs/coding-patterns.md` — Entity Naming, DB Configuration, Cross-Module Data Access sections._

---

## P9: Observability

Each module provides individual visibility into its health, performance, and behavior.

**Rules:**
- ✅ Add module-specific logging with module identifier
- ✅ Track business and technical metrics (counters, histograms)
- ✅ Implement module health check endpoint
- ✅ Include correlation IDs for request tracing
- ❌ Never mix module concerns in logging/monitoring

_See `.opencode/docs/integration-patterns.md` — Structured Logging, Metrics and Health Checks sections._

---

## P10: Fail Independence

Failures in one module don't cascade to other modules.

**Rules:**
- ✅ Implement circuit breakers for external/inter-module calls
- ✅ Design graceful degradation for non-critical features
- ✅ Use timeouts and retries with exponential backoff
- ❌ Never let one module's failure bring down others
- ❌ Never create synchronous dependencies that cascade failures

_See `.opencode/docs/integration-patterns.md` — Circuit Breakers, Timeouts and Retries sections._

---

## P11: Co-location by Aggregate

One business concept = one folder. **Production** code for that concept lives together in the aggregate folder (entity, repository, service, controller or resolver, DTO, types, clients). **Unit tests** live in a dedicated `__test__/` subfolder inside the same aggregate (`<aggregate>/__test__/<file>.spec.ts`) so production API files stay visually separate from test infrastructure.

**AI rule:** Create `package/<module>/<aggregate>/` — never split by technical layer.

**Example:** `package/billing/subscription/subscription.{entity,repository,service,controller,types}.ts` and `package/billing/subscription/__test__/subscription.service.spec.ts`
**Violation:** `package/billing/persistence/entity/` + `package/billing/core/service/` (legacy layers)

---

## P12: Suffixes > Folders

Use `.types.ts`, `.dto.ts`, `.constants.ts` suffixes — not technical subfolders.

**Example:** `package/identity/user/user.types.ts` ✅
**Violation:** `package/billing/wallet/types/wallet.types.ts` ❌ (single-file folder)

---

## P13: Depth ≤ 2–3

Flat: depth 2 (`package/billing/<aggregate>/<file>`). Subdomain: depth 3 (`package/content/<subdomain>/<aggregate>/<file>`). `shared/` exempt.

**Example:** `package/content/management/episode/episode.entity.ts` (depth 3) ✅
**Violation:** depth 4+ business files ❌

---

## P14: Folder Only if ≥ 2–3 Cohesive Files

No folder for a single file — use suffix in aggregate folder.

**Example:** `package/billing/tax/tax.types.ts` ✅
**Violation:** `wallet/constants/wallet.constants.ts` in its own folder ❌

**Exception — `__test__/`:** P14 does not apply to `<aggregate>/__test__/`. That folder is the standard place for unit specs even when it contains only one file; it is a semantic category (test harness), not an arbitrary single-file technical subfolder.

---

## P15: Aggregate Limits

~15 files = review signal. ~25+ files = strong split candidate.

**Example:** `package/billing/subscription/` (16 files) — monitor. `package/content/management/` — many aggregates, subdomain split ✅
**Violation:** 30+ files in one aggregate folder without split ❌

---

## P16: AI-Flat Optimization

Flat structure minimizes discovery cost — `ls package/billing/` reveals domain.

**Example:** `subscription/ invoice/ payment/ plan/` ✅ screaming architecture
**Violation:** navigating `core/service/` to find domain logic ❌

---

## P17: No README in Aggregate

No README inside aggregate or subdomain business folders. Package root README only.

**Example:** `package/billing/README.md` ✅, no README in `subscription/` ✅
**Violation:** `package/billing/subscription/README.md` ❌

---

## P18: Service as Default Unit

Services group related actions for an aggregate. Sub-types (state machine, validator, calculator) use suffixes (`X.state-machine.service.ts`), not folders. A distinct use-case construct is unnecessary — co-location by aggregate already provides equivalent focus.

**Rationale:** 4 of 5 packages already adopted this pattern naturally. The use-case vs service distinction is theoretical (Clean Architecture) without practical effect in NestJS without strict layer separation.

Ver: spec `content-use-case-to-service-migration` (applied).

---

## P19: Intentional Shared Kernel is Legitimate

For objects without behavior (ORM entities), intentional shared kernel is an accepted DDD pattern when:

1. Sharing is justified by cross-subdomain reads
2. Schema ownership is documented and centralized
3. The entity has no behavior of its own (pure state holder)

Document via JSDoc on the entity file. The anti-pattern is **accidental** shared kernel (entities without clear ownership), not intentional.

Ref: V. Vernon, *Implementing DDD* (2013), ch. 3. E. Evans, *DDD* (2003), ch. 14.

Ver: spec `content-shared-kernel-refinement` (applied).
Example: `package/content/shared/persistence/entity/content.entity.ts`.

---

## Hierarchy in Conflict

**Modular principles (P1–P10) prevail over structural principles (P11–P19).**

When structural convenience would violate modular boundaries, modular wins.

| Conflict | Resolution |
|----------|------------|
| Co-locating files (P11) requires cross-package entity import | Use facade + DTO (P1, P5) — do not import entities |
| Splitting aggregate (P15) would break transactional boundary | Keep aggregate together (P8) — split by subdomain instead |
| Flat depth (P13) vs subdomain isolation (P3) | Subdomain layout is allowed at depth 3 when P3/P4 justify it |
| Suffix preference (P12) vs shared test helpers | `__test__/` folders are exempt from suffix rules |
| P14 vs unit test layout | `__test__/` inside an aggregate is allowed per the P14 exception above |

**Rule of thumb:** If obeying P11–P19 would break P1, P5, or P8, stop and use the modular pattern instead.
