import { Kafka, Producer, Consumer, Admin } from 'kafkajs';
import { Event } from '@cloudretail/models';
import { logger } from '@cloudretail/middleware';
import { createClient, RedisClientType } from 'redis';

/**
 * Event Bus Service
 * Implements event-driven architecture using Kafka for production
 * Falls back to in-memory event store for development
 */
export class EventBus {
  private kafka?: Kafka;
  private producer?: Producer;
  private consumer?: Consumer;
  private admin?: Admin;
  private redis?: RedisClientType;
  private connected: boolean = false;
  private useKafka: boolean;
  private inMemoryEvents: Event[] = [];
  private eventSubscribers: Map<string, Set<(event: Event) => void>> = new Map();

  constructor() {
    this.useKafka = process.env.USE_KAFKA === 'true';

    if (this.useKafka) {
      this.kafka = new Kafka({
        clientId: 'cloudretail-event-bus',
        brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
        retry: {
          initialRetryTime: 100,
          retries: 8,
        },
      });

      this.producer = this.kafka.producer();
      this.consumer = this.kafka.consumer({ groupId: 'event-bus-group' });
      this.admin = this.kafka.admin();
    }

    // Initialize Redis for event caching and statistics
    if (process.env.REDIS_URL) {
      this.redis = createClient({ url: process.env.REDIS_URL });
      this.redis.on('error', (err) => logger.error('Redis error', { error: err }));
    }
  }

  /**
   * Connect to Kafka and Redis
   */
  async connect(): Promise<void> {
    try {
      if (this.useKafka && this.producer && this.consumer && this.admin) {
        await this.producer.connect();
        await this.consumer.connect();
        await this.admin.connect();

        // Create topics if they don't exist
        await this.createTopics();

        // Start consuming events
        await this.startConsuming();

        logger.info('Connected to Kafka');
      }

      if (this.redis) {
        await this.redis.connect();
        logger.info('Connected to Redis');
      }

      this.connected = true;
      logger.info(`Event Bus initialized (mode: ${this.useKafka ? 'Kafka' : 'In-Memory'})`);
    } catch (error) {
      logger.error('Failed to connect Event Bus', { error });
      throw error;
    }
  }

  /**
   * Disconnect from Kafka and Redis
   */
  async disconnect(): Promise<void> {
    try {
      if (this.producer) await this.producer.disconnect();
      if (this.consumer) await this.consumer.disconnect();
      if (this.admin) await this.admin.disconnect();
      if (this.redis) await this.redis.disconnect();

      this.connected = false;
      logger.info('Event Bus disconnected');
    } catch (error) {
      logger.error('Error disconnecting Event Bus', { error });
    }
  }

  /**
   * Create Kafka topics
   */
  private async createTopics(): Promise<void> {
    if (!this.admin) return;

    const topics = [
      'user-events',
      'product-events',
      'inventory-events',
      'order-events',
      'payment-events',
    ];

    try {
      await this.admin.createTopics({
        topics: topics.map((topic) => ({
          topic,
          numPartitions: 3,
          replicationFactor: 1,
        })),
      });

      logger.info('Kafka topics created', { topics });
    } catch (error) {
      // Topics might already exist
      logger.debug('Topics creation skipped', { error });
    }
  }

  /**
   * Start consuming events
   */
  private async startConsuming(): Promise<void> {
    if (!this.consumer) return;

    await this.consumer.subscribe({
      topics: [
        'user-events',
        'product-events',
        'inventory-events',
        'order-events',
        'payment-events',
      ],
      fromBeginning: false,
    });

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const event: Event = JSON.parse(message.value?.toString() || '{}');
          logger.info('Event consumed', {
            topic,
            partition,
            eventId: event.id,
            eventType: event.type,
          });

          // Store in Redis for caching
          if (this.redis) {
            await this.redis.setEx(
              `event:${event.id}`,
              3600, // 1 hour TTL
              JSON.stringify(event)
            );
          }

          // Notify subscribers
          this.notifySubscribers(event);
        } catch (error) {
          logger.error('Error processing event', { error, topic, partition });
        }
      },
    });
  }

  /**
   * Publish an event
   */
  async publishEvent(event: Event): Promise<void> {
    try {
      if (this.useKafka && this.producer) {
        // Determine topic based on event type
        const topic = this.getTopicForEventType(event.type);

        await this.producer.send({
          topic,
          messages: [
            {
              key: event.id,
              value: JSON.stringify(event),
              headers: {
                correlationId: event.metadata.correlationId,
                service: event.metadata.service,
              },
            },
          ],
        });

        logger.info('Event published to Kafka', {
          eventId: event.id,
          eventType: event.type,
          topic,
        });
      } else {
        // In-memory fallback
        this.inMemoryEvents.push(event);

        // Keep only last 1000 events
        if (this.inMemoryEvents.length > 1000) {
          this.inMemoryEvents.shift();
        }

        logger.info('Event stored in memory', {
          eventId: event.id,
          eventType: event.type,
        });

        // Notify subscribers immediately in memory mode
        this.notifySubscribers(event);
      }

      // Update statistics in Redis
      if (this.redis) {
        await this.redis.incr('events:total');
        await this.redis.incr(`events:type:${event.type}`);
      }
    } catch (error) {
      logger.error('Failed to publish event', { error, event });
      throw error;
    }
  }

  /**
   * Subscribe to events
   */
  subscribe(eventType: string, callback: (event: Event) => void): void {
    if (!this.eventSubscribers.has(eventType)) {
      this.eventSubscribers.set(eventType, new Set());
    }

    this.eventSubscribers.get(eventType)!.add(callback);
    logger.debug('Subscriber added', { eventType });
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(eventType: string, callback: (event: Event) => void): void {
    const subscribers = this.eventSubscribers.get(eventType);
    if (subscribers) {
      subscribers.delete(callback);
      logger.debug('Subscriber removed', { eventType });
    }
  }

  /**
   * Notify subscribers of a new event
   */
  private notifySubscribers(event: Event): void {
    const subscribers = this.eventSubscribers.get(event.type);
    if (subscribers) {
      subscribers.forEach((callback) => {
        try {
          callback(event);
        } catch (error) {
          logger.error('Error in event subscriber', { error, eventType: event.type });
        }
      });
    }
  }

  /**
   * Get topic name for event type
   */
  private getTopicForEventType(eventType: string): string {
    if (eventType.startsWith('user.')) return 'user-events';
    if (eventType.startsWith('product.')) return 'product-events';
    if (eventType.startsWith('inventory.')) return 'inventory-events';
    if (eventType.startsWith('order.')) return 'order-events';
    if (eventType.startsWith('payment.')) return 'payment-events';
    return 'general-events';
  }

  /**
   * Get event statistics
   */
  async getStats(): Promise<any> {
    const stats: any = {
      connected: this.connected,
      mode: this.useKafka ? 'Kafka' : 'In-Memory',
      eventsInMemory: this.inMemoryEvents.length,
      subscribers: this.eventSubscribers.size,
    };

    if (this.redis) {
      try {
        stats.totalEvents = await this.redis.get('events:total');
        stats.eventsByType = {};

        const eventTypes = [
          'user.created',
          'user.updated',
          'product.created',
          'product.updated',
          'inventory.updated',
          'order.created',
          'payment.completed',
        ];

        for (const type of eventTypes) {
          const count = await this.redis.get(`events:type:${type}`);
          if (count) {
            stats.eventsByType[type] = count;
          }
        }
      } catch (error) {
        logger.error('Error fetching stats from Redis', { error });
      }
    }

    return stats;
  }

  /**
   * Check if Event Bus is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get recent events (from in-memory store)
   */
  getRecentEvents(limit: number = 100): Event[] {
    return this.inMemoryEvents.slice(-limit);
  }
}
