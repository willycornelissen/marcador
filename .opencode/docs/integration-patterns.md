# Integration Patterns

Patterns for integrating external services and building resilient, observable systems.

> **Module structure**: For module layout and cross-boundary communication rules, see [`.agents/skills/modular-architecture/SKILL.md`](../.agents/skills/modular-architecture/SKILL.md).

---

## External API Client Encapsulation

**Core principle**: Client owns ALL HTTP/API details. Services only know business operations.

**Client owns:**
- ✅ URLs and endpoints
- ✅ Authentication (headers, tokens)
- ✅ Request/response mapping
- ✅ Error handling
- ✅ Timeouts and retries

**Service knows:**
- ✅ Business operations only
- ❌ No HTTP details, no URLs, no authentication

### Pattern 1: Mock Client (development/testing)

```typescript
@Injectable()
export class PaymentGatewayClient {
  async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));
    if (Math.random() < 0.1) return { success: false, failureReason: 'Card declined' };
    return { success: true, transactionId: `PAY-${Date.now()}`, processedAt: new Date() };
  }
}
```

### Pattern 2: HTTP Client (production REST APIs)

```typescript
@Injectable()
export class ExternalRatingClient {
  constructor(
    private readonly configService: ConfigService,
    private readonly httpClient: HttpClient
  ) {}

  async getRating(title: string): Promise<number | undefined> {
    try {
      const response = await this.httpClient.get(
        `${this.configService.get('api.url')}/rating/${title}`,
        { headers: { Authorization: `Bearer ${this.configService.get('api.token')}` }, timeout: 5000 }
      );
      return response.rating;
    } catch (error) {
      throw new HttpClientException(`Rating API error: ${error}`);
    }
  }
}
```

### Pattern 3: SDK Client (vendor SDKs)

```typescript
@Injectable()
export class GeminiClient implements VideoSummaryAdapter {
  constructor(private readonly configService: ConfigService) {}

  async generateSummary(videoUrl: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: this.configService.get('gemini.apiKey') });
    const result = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: [/* ... */] });
    return result.text || '';
  }
}
```

### Client encapsulation example

```typescript
// ✅ GOOD: Client encapsulates everything — service never sees HTTP details
// package/billing/payment/payment-gateway.client.ts
@Injectable()
export class PaymentGatewayClient {
  async processPayment(data: PaymentRequest): Promise<PaymentResponse> {
    const url = `${this.baseUrl}/v1/charges`;
    const headers = { Authorization: `Bearer ${this.apiKey}` };
    const response = await this.httpClient.post(url, this.mapToApiFormat(data), { headers });
    return this.mapFromApiFormat(response);
  }
}

@Injectable()
export class PaymentService {
  constructor(private readonly paymentClient: PaymentGatewayClient) {}

  async processPayment(invoice: Invoice): Promise<Payment> {
    const response = await this.paymentClient.processPayment({ amount: invoice.totalAmount, invoiceId: invoice.id });
    return this.paymentRepository.save(new Payment({ transactionId: response.transactionId, amount: invoice.totalAmount }));
  }
}
```

**HttpClient setup:**
```typescript
@Module({ imports: [HttpClientModule] })
export class BillingModule {}

// Error handling
import { HttpClientException } from '@tlc/shared-module/http-client';
try {
  const response = await this.httpClient.get(url, options);
} catch (error) {
  if (error instanceof HttpClientException) this.logger.error('HTTP client error', error);
  throw error;
}
```

---

## Injection Patterns

### Default: Direct Injection (most common)

Use when: single provider, no plans to replace.

```typescript
@Injectable()
export class TaxService {
  constructor(private readonly easyTaxClient: EasyTaxClient) {}
}
```

### Interface Pattern: only when replaceability is needed

Use when: multiple providers possible (e.g., Gemini vs OpenAI).

```typescript
// Interface
export interface VideoSummaryAdapter {
  generateSummary(videoUrl: string): Promise<string>;
}
export const VideoSummaryAdapter = Symbol('VideoSummaryAdapter');

// Module provides implementation
@Module({
  providers: [{ provide: VideoSummaryAdapter, useClass: GeminiClient }],
})
export class VideoProcessorModule {}

// Or factory-based selection
{
  provide: VideoSummaryGenerationAdapter,
  useFactory: (config: ConfigService): VideoSummaryGenerationAdapter => {
    switch (config.get('VIDEO_PROCESSING_PROVIDER')) {
      case 'gemini': return new GeminiTextExtractorClient();
      case 'openai': return new OpenAITextExtractorClient();
      default: throw new Error('Unknown provider');
    }
  },
  inject: [ConfigService],
}

// Service uses interface — never knows the concrete implementation
@Injectable()
export class SummaryUseCase {
  constructor(
    @Inject(VideoSummaryAdapter)
    private readonly adapter: VideoSummaryAdapter
  ) {}
}
```

---

## Structured Logging

Each module provides individual visibility with module-specific identifiers.

**Rules:**
- ✅ Use consistent log formats with module identifiers
- ✅ Include correlation IDs for request tracing
- ✅ Log at appropriate levels (debug, info, warn, error)
- ❌ Never log API keys, tokens, or sensitive PII

```typescript
@Injectable()
export class ContentManagementService {
  // package/content/management/content/content-lifecycle.service.ts
  private readonly logger = new Logger('ContentManagementService');

  async publishContent(contentId: string, publishedBy: string) {
    this.logger.log(`Publishing content ${contentId}`, {
      module: 'content',
      operation: 'content_publish',
      contentId,
      publishedBy,
      timestamp: new Date().toISOString(),
    });

    try {
      await this.repository.publishContent(contentId, publishedBy);
      this.logger.log(`Content published: ${contentId}`, { module: 'content', operation: 'content_publish_success', contentId });
    } catch (error) {
      this.logger.error(`Failed to publish content ${contentId}`, error, {
        module: 'content',
        operation: 'content_publish_error',
        contentId,
        error: error.message,
      });
      throw error;
    }
  }
}
```

**What to log:**
- ✅ All API requests (method, path, status, duration)
- ✅ External API calls (endpoint, status, duration)
- ✅ Business events (resource created, payment processed)
- ✅ Errors and exceptions (stack trace, context)

**What NOT to log:**
- ❌ Passwords, API keys, secrets
- ❌ Full credit card numbers
- ❌ Sensitive PII (redact or hash)

---

## Metrics and Health Checks

### Module-Specific Metrics

```typescript
@Injectable()
export class SubscriptionService {
  // package/billing/subscription/subscription.service.ts
  private subscriptionCreateCounter = new Counter({
    name: 'billing_subscription_creates_total',
    help: 'Total number of subscription creates',
    labelNames: ['plan_type', 'status'],
  });

  private subscriptionCreateDuration = new Histogram({
    name: 'billing_subscription_create_duration_seconds',
    help: 'Duration of subscription create operations',
    buckets: [0.1, 0.5, 1, 2, 5],
  });

  async createSubscription({ planId }: { planId: string }): Promise<Subscription> {
    const endTimer = this.subscriptionCreateDuration.startTimer();
    try {
      const subscription = await this.repository.createSubscription(planId);
      this.subscriptionCreateCounter.labels({ plan_type: 'premium', status: 'active' }).inc();
      return subscription;
    } finally {
      endTimer();
    }
  }
}
```

### Module-Specific Health Check

```typescript
@Injectable()
export class ContentHealthIndicator extends HealthIndicator {
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkExternalDependencies(),
      this.checkBusinessLogic(),
    ]);

    const dbStatus = checks[0].status === 'fulfilled';
    const externalStatus = checks[1].status === 'fulfilled';
    const businessStatus = checks[2].status === 'fulfilled';

    // Module is healthy if core functionality works
    // External dependencies can be degraded without affecting health
    return this.getStatus(key, dbStatus && businessStatus, {
      database: dbStatus ? 'ok' : 'failed',
      external: externalStatus ? 'ok' : 'degraded',
      canOperate: dbStatus && businessStatus,
    });
  }
}
```

---

## Circuit Breakers and Graceful Degradation

**Rules:**
- ✅ Implement circuit breakers for external service calls
- ✅ Design graceful degradation when dependencies fail
- ❌ Never let one module's failure bring down others
- ❌ Never create synchronous dependencies that can cascade failures

```typescript
import CircuitBreaker from 'opossum';

@Injectable()
export class ExternalMovieRatingClient {
  // package/content/catalog/rating/external-movie-rating.client.ts
  private circuitBreaker: CircuitBreaker;

  constructor() {
    this.circuitBreaker = new CircuitBreaker(this.callMovieRatingService.bind(this), {
      timeout: 3000,                 // 3 second timeout
      errorThresholdPercentage: 50,  // Open after 50% failure rate
      resetTimeout: 30000,           // Try again after 30 seconds
    });

    this.circuitBreaker.fallback(() => ({
      rating: null,
      message: 'Movie rating service temporarily unavailable',
    }));
  }

  async getMovieRating(movieTitle: string): Promise<ExternalMovieRating> {
    try {
      return await this.circuitBreaker.fire(movieTitle);
    } catch (error) {
      return { rating: null, source: 'fallback', message: 'Unable to fetch movie rating' };
    }
  }

  private async callMovieRatingService(movieTitle: string): Promise<ExternalMovieRating> {
    // Actual HTTP call
  }
}
```

### Graceful degradation for non-critical operations

```typescript
@Injectable()
export class VideoProcessingJobProducer {
  async processVideo(videoId: string, url: string) {
    // Core operation always proceeds
    await this.videoRepository.markAsProcessing(videoId);

    // Non-critical — failure doesn't break main flow
    try {
      await this.queueService.addJob(QUEUES.VIDEO_PROCESSING, { videoId, url, timestamp: new Date() });
    } catch (error) {
      this.logger.warn('Failed to queue video processing job', error);
    }

    // Optional enrichment — gracefully skip on failure
    try {
      const movieRating = await this.movieRatingClient.getMovieRating(videoTitle);
      if (movieRating.rating) await this.updateMovieRating(videoId, movieRating.rating);
    } catch (error) {
      this.logger.warn('Movie rating fetch failed, continuing without rating', error);
    }
  }
}
```

---

## Timeouts, Retries, and Backoff

```typescript
@Injectable()
export class PaymentGatewayProvider {
  async processPayment(paymentData: any): Promise<any> {
    const retryConfig = {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) =>
        axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status >= 500,
    };

    try {
      const response = await this.httpService.axiosRef.request({
        url: '/payment-gateway/process',
        method: 'POST',
        data: paymentData,
        timeout: 5000,  // 5 second timeout
        ...retryConfig,
      });
      return response.data;
    } catch (error) {
      this.logger.error('External service call failed after retries', error);
      return this.getFallbackData();
    }
  }
}
```

**Resilience checklist per external call:**
- [ ] Timeout configured (5-30 seconds depending on operation)
- [ ] Retry logic (3 retries, exponential backoff)
- [ ] Circuit breaker (recommend `opossum`)
- [ ] Graceful degradation (fallback value or degraded mode)
- [ ] Error handling that doesn't cascade

---

## Event System Patterns

For inter-module async communication, prefer proven message queue systems over Node.js EventEmitter in production.

### Choosing the right implementation

| Implementation | Best For | Pros | Cons |
| --- | --- | --- | --- |
| **Kafka** | High-throughput, event sourcing | Durable, scalable, event log | Complex setup |
| **SQS** | AWS ecosystem, simple queuing | Easy, managed, reliable | AWS-specific |
| **Redis** | Real-time, low latency | Very fast, simple | No persistence |
| **In-memory** | Local development/testing | Zero infrastructure | Not for production |

### Explicit payload contracts

```typescript
// Always define typed interfaces for queue payloads
export interface VideoProcessingJobData {
  videoId: string;
  url: string;
  contentId: string;
  processingType: 'transcription' | 'summary' | 'age-rating';
  timestamp: Date;
}

// Producer
export class VideoProcessingJobProducer {
  async processVideo(videoId: string, url: string, contentId: string) {
    await this.queueProducer.addJob<VideoProcessingJobData>(QUEUES.VIDEO_PROCESSING, {
      videoId, url, contentId, processingType: 'transcription', timestamp: new Date(),
    });
  }
}

// Consumer
export class VideoTranscriptionConsumer {
  async process(job: Job<VideoProcessingJobData>) {
    const { videoId, url } = job.data;  // Type-safe
    const video = await this.videoRepository.findOneById(videoId);
    if (video) await this.transcribeVideoUseCase.generateTranscript(video);
  }
}
```

### Kafka implementation

```typescript
@Injectable()
export class KafkaEventPublisher implements EventPublisher {
  constructor(private kafkaProducer: Producer) {}

  async publish<T>(eventName: string, payload: T): Promise<void> {
    await this.kafkaProducer.send({
      topic: `events.${eventName.replace('.', '-')}`,
      messages: [{ key: eventName, value: JSON.stringify(payload), headers: { eventType: eventName, timestamp: new Date().toISOString() } }],
    });
  }
}
```

### SQS implementation

```typescript
@Injectable()
export class SQSEventPublisher implements EventPublisher {
  constructor(private sqsClient: SQSClient) {}

  async publish<T>(eventName: string, payload: T): Promise<void> {
    await this.sqsClient.sendMessage({
      QueueUrl: this.getQueueUrl(eventName),
      MessageBody: JSON.stringify(payload),
      MessageAttributes: { eventType: { StringValue: eventName, DataType: 'String' } },
    });
  }
}
```

---

## Security

### Never hardcode API keys

```typescript
// ❌ BAD
private readonly apiKey = 'sk_live_1234567890';

// ✅ GOOD
constructor(private readonly configService: ConfigService) {}
private getApiKey() { return this.configService.get('api.key'); }
```

### Never share clients across modules

```typescript
// ❌ BAD: Import client from another module's internals
import { EasyTaxClient } from '@billing/tax/easytax.client'; // ❌

// ✅ GOOD: Use module facade
import { BillingFacade } from '@billing/billing.facade';
```

### Sanitize logs — never log sensitive data

```typescript
// ❌ BAD
this.logger.log('API call', { apiKey: this.apiKey, cardNumber: payment.cardNumber });

// ✅ GOOD
this.logger.log('API call', { invoiceId: payment.invoiceId, amount: payment.amount });
```

### Validate webhook signatures

```typescript
// Always validate incoming webhooks from external services
const signature = request.headers['stripe-signature'];
try {
  const event = stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
  // Process event
} catch (error) {
  this.logger.warn('Invalid webhook signature', { error: error.message });
  throw new BadRequestException('Invalid signature');
}
```

**Security checklist per integration:**
- [ ] API keys stored in environment variables (never hardcoded)
- [ ] ConfigService used for all credentials
- [ ] Sensitive data not logged
- [ ] SSL certificates validated
- [ ] Webhook signatures verified
- [ ] Rate limiting on webhook endpoints
- [ ] Clients never exported across module boundaries