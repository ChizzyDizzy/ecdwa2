import { EventType } from '@cloudretail/models';
import { logger } from '@cloudretail/middleware';
import { v4 as uuidv4 } from 'uuid';

/**
 * Event Publisher for User Service
 * Publishes events to the event bus for other microservices to consume
 */
export class EventPublisher {
  private eventBusUrl: string;

  constructor() {
    this.eventBusUrl = process.env.EVENT_BUS_URL || 'http://localhost:4000/events';
  }

  async publishEvent(event: {
    type: EventType;
    payload: any;
    correlationId?: string;
  }) {
    try {
      const eventMessage = {
        id: uuidv4(),
        type: event.type,
        payload: event.payload,
        timestamp: new Date(),
        metadata: {
          correlationId: event.correlationId || uuidv4(),
          service: 'user-service',
        },
      };

      // In production, this would publish to Kafka, AWS EventBridge, or similar
      // For now, we'll use HTTP POST to event bus
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      try {
        const response = await fetch(this.eventBusUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventMessage),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Event bus returned status ${response.status}`);
        }
      } finally {
        clearTimeout(timeout);
      }

      logger.info('Event published successfully', {
        eventId: eventMessage.id,
        eventType: event.type,
      });
    } catch (error) {
      // Events should be published asynchronously and failures should not block main flow
      logger.error('Failed to publish event', {
        eventType: event.type,
        error,
      });

      // In production, implement retry logic or dead letter queue
    }
  }
}
