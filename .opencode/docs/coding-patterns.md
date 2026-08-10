# Coding Patterns

Implementation reference for repositories, controllers, services, entities, and database configuration.

> **Module structure**: For complete modular architecture guidance (flat-by-aggregate layout, co-location, depth rules), see [`.agents/skills/modular-architecture/SKILL.md`](../.agents/skills/modular-architecture/SKILL.md).

---

## Repository Pattern & ORM Encapsulation

Repositories MUST encapsulate all ORM-specific logic and never expose internal TypeORM APIs to the domain layer.

**Rules:**
- ✅ Extend `DefaultTypeOrmRepository<Entity>` for all repositories
- ✅ Use `@InjectDataSource('moduleName')` for named data source injection
- ✅ Pass `dataSource.manager` to super constructor
- ✅ Add custom query methods with business-meaningful names
- ❌ Never extend TypeORM's `Repository` class directly
- ❌ Never expose query builder or raw methods to services
- ❌ Never use `dataSource.createEntityManager()` in constructors

`DefaultTypeOrmRepository` uses composition over inheritance — it wraps TypeORM's `Repository` as a private property and exposes only: `save`, `findOne`, `find`, `exists`. This prevents domain services from coupling to ORM internals and makes repositories easy to mock.

```typescript
// ✅ GOOD — package/billing/invoice/invoice.repository.ts
@Injectable()
export class InvoiceRepository extends DefaultTypeOrmRepository<Invoice> {
  constructor(
    @InjectDataSource('billing')
    dataSource: DataSource
  ) {
    super(Invoice, dataSource.manager);
  }

  async findByUserId(userId: string): Promise<Invoice[]> {
    return this.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async findByInvoiceNumber(invoiceNumber: string): Promise<Invoice | null> {
    return this.findOne({ where: { invoiceNumber }, relations: ['lineItems'] });
  }
}

// ❌ BAD: Extends TypeORM Repository directly — exposes 50+ methods
export class InvoiceRepository extends Repository<Invoice> {
  constructor(private dataSource: DataSource) {
    super(Invoice, dataSource.createEntityManager());
  }
}
```

---

## ORM Leakage Prevention

Services MUST NEVER use TypeORM syntax directly. All `where`, `relations`, and operators (`Between`, `IsNull`) MUST be encapsulated in repository methods with business-meaningful names.

**Rules:**
- ✅ Create repository methods with business-meaningful names
- ✅ Keep TypeORM imports ONLY in repositories
- ❌ Never use `where:` or `relations:` syntax in services
- ❌ Never import TypeORM operators in services (`Between`, `IsNull`, etc.)

```typescript
// ❌ BAD: Service coupled to TypeORM
const subscription = await this.subscriptionRepository.findOne({
  where: { id: subscriptionId, userId, status: SubscriptionStatus.Active },
  relations: ['plan', 'addOns'],
});
import { Between, IsNull } from 'typeorm'; // ❌ Never in services

// ✅ GOOD: Repository encapsulates TypeORM details — package/billing/subscription/subscription.repository.ts
@Injectable()
export class SubscriptionRepository extends DefaultTypeOrmRepository<Subscription> {
  async findActiveByIdAndUserIdWithDetails(
    subscriptionId: string,
    userId: string
  ): Promise<Subscription | null> {
    return this.findOne({
      where: { id: subscriptionId, userId, status: SubscriptionStatus.Active },
      relations: ['plan', 'addOns', 'addOns.addOn'],
    });
  }

  async findUnbilledBySubscriptionIdAndPeriod(
    subscriptionId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<UsageRecord[]> {
    return this.find({
      where: { subscriptionId, timestamp: Between(periodStart, periodEnd), billedInInvoiceId: IsNull() },
    });
  }
}

// ✅ Service uses clean domain methods — zero TypeORM imports
const subscription = await this.subscriptionRepository.findActiveByIdAndUserIdWithDetails(subscriptionId, userId);
```

**Method naming**: Express business intent, not technical implementation:
```typescript
// ✅ Good
findActiveByUserIdWithDetails(userId);
findUnbilledBySubscriptionIdAndPeriod(subId, start, end);

// ❌ Bad
findOneWithRelations(id, relations);
queryWithWhereClause(params);
```

---

## Lean Controller Pattern

Controllers MUST be lean and only handle HTTP concerns. All business logic, orchestration, and data access MUST live in services.

**Rules:**
- ✅ Keep controllers under 20 lines per method
- ✅ Only call services (never repositories)
- ✅ Only handle: request validation, service calls, response mapping
- ✅ Use DTOs for request/response transformation
- ❌ Never put business logic in controllers
- ❌ Never call repositories directly from controllers
- ❌ Never perform calculations or data aggregation in controllers

**Controller responsibilities (ONLY):**
1. Extract request data (params, body, query, headers)
2. Validate request (via DTOs and ValidationPipe)
3. Extract user context (from ClsService)
4. Call service method (single call, pass primitives/DTOs)
5. Transform response (entity → DTO using `plainToInstance`)
6. Handle HTTP errors (translate domain exceptions to HTTP)

```typescript
// ✅ GOOD: Lean controller — package/billing/invoice/invoice.controller.ts
@Controller('invoices')
@UseGuards(AuthGuard)
export class InvoiceController {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly clsService: ClsService
  ) {}

  @Get()
  async getUserInvoices(): Promise<InvoiceResponseDto[]> {
    const userId = this.clsService.get('userId');
    const invoices = await this.invoiceService.getUserInvoices(userId);
    return invoices.map((invoice) =>
      plainToInstance(InvoiceResponseDto, invoice, { excludeExtraneousValues: true })
    );
  }
}

// ❌ BAD: Fat controller with business logic, repository injection, and 50+ lines
@Controller('usage')
export class UsageController {
  constructor(
    private readonly usageRecordRepository: UsageRecordRepository, // ❌
    private readonly subscriptionRepository: SubscriptionRepository  // ❌
  ) {}

  @Get('subscription/:subscriptionId')
  async getUsageSummary(@Param('subscriptionId') subscriptionId: string) {
    const subscription = await this.subscriptionRepository.findOne({ where: { id: subscriptionId }, relations: ['plan'] }); // ❌
    // ... 50 more lines of business logic ❌
  }
}
```

**Service vs Controller responsibilities:**

| Responsibility | Service | Controller |
| --- | --- | --- |
| Business Logic | ✅ | ❌ |
| Repository Calls | ✅ | ❌ |
| Calculations | ✅ | ❌ |
| Orchestration | ✅ | ❌ |
| Request Validation (DTO) | ❌ | ✅ |
| HTTP Status Codes | ❌ | ✅ |
| Response Mapping (Entity→DTO) | ❌ | ✅ |
| User Context Extraction | ❌ | ✅ |

---

## Transaction Management & Named Connections

Services that perform write operations MUST use `@Transactional()` with explicit `connectionName`.

**Rules:**
- ✅ Use `@Transactional({ connectionName: 'moduleName' })` on all methods that perform write operations
- ✅ Apply to methods that orchestrate multiple writes
- ✅ Apply to methods that must maintain data consistency
- ❌ Never use `@Transactional()` without connectionName in multi-database apps
- ❌ Never nest `@Transactional()` methods
- ❌ Never add decorator to read-only methods

```typescript
// ❌ Ambiguous — which database?
@Transactional()
async createSubscription() { }

// ✅ Explicit
@Transactional({ connectionName: 'billing' })
async createSubscription() { }
```

**When to use:**
- Single write: ensures atomicity
- Multiple writes: all-or-nothing semantics
- Read-then-write: prevents race conditions
- Cross-entity operations: maintains referential integrity

```typescript
// ✅ Multiple writes — all succeed or all rollback
@Transactional({ connectionName: 'billing' })
async addAddOn(subscription: Subscription, addOnId: string) {
  const subscriptionAddOn = new SubscriptionAddOn({ subscriptionId: subscription.id, addOnId, startDate: new Date() });
  await this.subscriptionAddOnRepository.save(subscriptionAddOn);
  subscription.addOns.push(subscriptionAddOn);
  await this.subscriptionRepository.save(subscription);
  return subscriptionAddOn;
}

// ✅ Complex orchestration — all atomic
@Transactional({ connectionName: 'billing' })
async changePlan(userId: string, newPlanId: string) {
  const proration = await this.calculateProration(userId);
  const invoice = await this.invoiceRepository.save(new Invoice({ userId, amount: proration.amount }));
  const subscription = await this.subscriptionRepository.findByUserId(userId);
  subscription.planId = newPlanId;
  await this.subscriptionRepository.save(subscription);
  await this.creditRepository.save(new Credit({ userId, amount: proration.credit }));
  return { invoice, subscription };
}

// ❌ Read-only — no transaction needed
async getSubscription(id: string) {
  return this.subscriptionRepository.findById(id);
}
```

**Setup:** The persistence module must configure `dataSourceFactory`:
```typescript
TypeOrmPersistenceModule.forRoot({
  name: 'billing',
  // ...
  dataSourceFactory: async (options) => {
    return addTransactionalDataSource({ name: options.name, dataSource: new DataSource(options) });
  },
})
```

**Connection name mapping:**

| Module | Connection Name |
| --- | --- |
| `@billing/` | `'billing'` |
| `@content/` | `'content'` |
| `@identity/` | `'identity'` |

---

## Entity Naming and State Isolation

⚠️ **CRITICAL**: Entity names MUST be prefixed with module name. This is the most frequently violated principle.

**Rules:**
- ✅ Give each module its own database connection/schema
- ✅ Prefix ALL entity names with module name (e.g., `BillingPlan`, not `Plan`)
- ✅ Use events or APIs for cross-module data needs
- ❌ NEVER use duplicate `@Entity({ name: 'X' })` across modules — CRITICAL VIOLATION
- ❌ Never share database tables between modules
- ❌ Never access other modules' data directly
- ❌ Never use foreign keys across module boundaries

```typescript
// ❌ CRITICAL VIOLATION: Same entity name in different modules
// package/billing/plan/plan.entity.ts
@Entity({ name: 'Plan' }) // ❌
export class Plan extends DefaultEntity<Plan> { }

// package/content/management/content/content.entity.ts
@Entity({ name: 'Plan' }) // ❌ CONFLICT: both write to same table!
export class Plan extends DefaultEntity<Plan> { }

// ✅ CORRECT: Module-prefixed names
@Entity({ name: 'BillingPlan' })      // package/billing/plan/plan.entity.ts
@Entity({ name: 'ContentPlan' })      // package/content/management/content/content.entity.ts
@Entity({ name: 'BillingSubscription' })
@Entity({ name: 'BillingInvoice' })
@Entity({ name: 'ContentItem' })
@Entity({ name: 'ContentVideo' })
@Entity({ name: 'IdentityUser' })
@Entity({ name: 'IdentitySession' })
```

---

## DB Configuration Patterns

Each module must have its own named DataSource:

```typescript
// package/billing/shared/persistence/billing-persistence.module.ts
@Module({
  imports: [
    TypeOrmPersistenceModule.forRoot({
      name: 'billing',
      inject: [ConfigService],
      useFactory: (configService: ConfigService<BillingConfig>) => ({
        type: 'postgres',
        host: configService.get('billing.database.host'),
        database: configService.get('billing.database.database'),
        entities: [Plan, Subscription],
        migrations: ['dist/packages/billing/migrations/*.js'],
        migrationsTableName: 'billing_migrations',
      }),
      dataSourceFactory: async (options) => {
        return addTransactionalDataSource({ name: options.name, dataSource: new DataSource(options) });
      },
    }),
  ],
})
export class BillingPersistenceModule {}
```

**Same server, different databases is allowed:**
```bash
# ✅ GOOD: Same host, different DB
BILLING_DATABASE_HOST=postgres.prod.com
BILLING_DATABASE_NAME=billing_db

CONTENT_DATABASE_HOST=postgres.prod.com   # same host OK
CONTENT_DATABASE_NAME=content_db          # different DB required
```

---

## Cross-Module Data Access Patterns

Modules MUST communicate via APIs, not direct database access.

```typescript
// ❌ BAD: Direct cross-module DB access
@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(UserEntity, 'identity') // ❌ Wrong module!
    private userRepository: Repository<UserEntity>
  ) {}
}

// ✅ GOOD: Cross-module data via HTTP client
@Injectable()
export class BillingSubscriptionHttpClient implements BillingSubscriptionStatusApi {
  async isUserSubscriptionActive(userId: string): Promise<boolean> {
    const url = `${this.configService.get('billingApi').url}/subscription/user/${userId}/active`;
    const { isActive } = await this.httpClient.get<...>(url);
    return isActive;
  }
}

// ✅ GOOD: String references instead of foreign keys
@Entity({ name: 'BillingSubscription' })
export class Subscription {
  userId: string;        // String reference, not FK
  userEmail: string;     // Replicated data for billing needs
  userName: string;      // Replicated data for invoices
}
```

---

## File Naming Conventions

Co-locate by aggregate folder (`package/<module>/<aggregate>/`). Use file suffixes — not technical subfolders like `core/` or `http/`.

| Suffix / Category | Convention | Example |
| --- | --- | --- |
| `.entity.ts` | TypeORM entity | `package/identity/user/user.entity.ts` |
| `.repository.ts` | Data access | `package/billing/subscription/subscription.repository.ts` |
| `.service.ts` | Business logic | `package/billing/subscription/subscription.service.ts` |
| `.controller.ts` / `.resolver.ts` | REST / GraphQL | `subscription.controller.ts`, `user.resolver.ts` |
| `.dto.ts` / `.types.ts` | DTOs / types | `subscription.dto.ts`, `subscription.types.ts` |
| `.module.ts` / `.facade.ts` | Package root | `billing.module.ts`, `billing.facade.ts` |
| `.client.ts` | External API | `package/billing/payment/payment-gateway.client.ts` |
| Aggregate folders | kebab-case | `subscription/`, `user/`, `episode/` |
| Classes / Enums | PascalCase | `SubscriptionService`, `SubscriptionStatus` |
| Entity table names | ModulePrefix + Name | `BillingSubscription`, `IdentityUser` |
| DataSource name | camelCase module | `'billing'`, `'content'` |

---

## Enum Usage

Always use enum members instead of raw string or number literals for any value that belongs to a finite, named set of options (event types, content types, statuses, window types, etc.).

**Rules:**
- ✅ Always reference enum members (`AnalyticsContentType.MOVIE`, `SubscriptionStatus.Active`)
- ✅ Import the enum in every file that needs one of its values
- ✅ Use the enum as the field/parameter type — never `string` when an enum applies
- ❌ Never use raw string literals where an enum value exists (`'MOVIE'`, `'DAILY'`, `'ACTIVE'`)
- ❌ Never cast to an enum type to silence a compiler error caused by a raw string (`windowType as AnalyticsTrendingWindowType`)
- ❌ Never use `??` fallback string literals when an enum default is available

```typescript
// ❌ BAD: raw string literals
const windowType = query.windowType ?? 'DAILY';
const jobData = { contentType: 'MOVIE', eventType: 'COMPLETE' };

// ✅ GOOD: enum members everywhere
const windowType = query.windowType ?? AnalyticsTrendingWindowType.DAILY;
const jobData = {
  contentType: AnalyticsContentType.MOVIE,
  eventType: AnalyticsEventType.COMPLETE,
};
```

This applies equally to test files — factory helpers and seed inserts must use enum members, not string literals.

---

## Common Anti-Patterns

| Anti-Pattern | Fix |
| --- | --- |
| `extends Repository<T>` in repositories | `extends DefaultTypeOrmRepository<T>` |
| TypeORM operators (`Between`, `IsNull`) in services | Encapsulate in repository methods |
| Repository injected in controllers | Inject services only |
| Controller methods > 20 lines with business logic | Move logic to service |
| `@Transactional()` without connectionName | `@Transactional({ connectionName: 'moduleName' })` |
| `@Transactional()` on read-only methods | Remove decorator |
| Nested `@Transactional()` methods | Only outer method gets decorator |
| `@Entity({ name: 'Plan' })` in multiple modules | `@Entity({ name: 'BillingPlan' })`, `@Entity({ name: 'ContentPlan' })` |
| `@InjectRepository(UserEntity, 'identity')` in billing | Use HTTP client |
| Shared database tables between modules | Each module owns its own tables |
| Cross-module entity imports | Use string references or HTTP clients |
| Exporting services/repositories from module index | Export only facades and module class |
| Global shared mutable state | Module-specific cache/state |
| Raw string literals instead of enum members (`'MOVIE'`, `'DAILY'`) | Use enum members (`AnalyticsContentType.MOVIE`, `AnalyticsTrendingWindowType.DAILY`) |
| Casting to enum type to suppress a string mismatch (`x as MyEnum`) | Fix the source: assign an enum member, not a raw string |