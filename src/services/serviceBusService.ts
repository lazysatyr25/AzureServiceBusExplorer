import { invoke } from '@tauri-apps/api/core';
import type {
  QueueProperties,
  TopicProperties,
  SubscriptionProperties,
  ServiceBusMessage,
  SendMessageOptions,
  MessageSource,
} from '../types';

// Response types from Rust — match serde(rename) camelCase fields
interface RustQueueProperties {
  name: string;
  activeMessageCount: number;
  deadLetterMessageCount: number;
  scheduledMessageCount: number;
  sizeInBytes: number;
  maxSizeInMegabytes: number;
  status: string;
  maxDeliveryCount: number;
  lockDuration: string;
  defaultMessageTimeToLive: string;
  requiresDuplicateDetection: boolean;
  requiresSession: boolean;
  deadLetteringOnMessageExpiration: boolean;
  enablePartitioning: boolean;
  enableBatchedOperations: boolean;
  createdAt: string;
  updatedAt: string;
  accessedAt: string;
}

interface RustTopicProperties {
  name: string;
  sizeInBytes: number;
  maxSizeInMegabytes: number;
  subscriptionCount: number;
  status: string;
  defaultMessageTimeToLive: string;
  requiresDuplicateDetection: boolean;
  enablePartitioning: boolean;
  enableBatchedOperations: boolean;
  createdAt: string;
  updatedAt: string;
  accessedAt: string;
}

interface RustSubscriptionProperties {
  subscriptionName: string;
  topicName: string;
  activeMessageCount: number;
  deadLetterMessageCount: number;
  status: string;
  maxDeliveryCount: number;
  lockDuration: string;
  defaultMessageTimeToLive: string;
  requiresSession: boolean;
  deadLetteringOnMessageExpiration: boolean;
  enableBatchedOperations: boolean;
  autoDeleteOnIdle: string;
  createdAt: string;
  updatedAt: string;
  accessedAt: string;
}

interface RustServiceBusMessage {
  messageId: string;
  body: string;
  contentType?: string;
  correlationId?: string;
  subject?: string;
  enqueuedTime?: string;
  sequenceNumber?: number;
  deliveryCount?: number;
}

function mapQueue(q: RustQueueProperties): QueueProperties {
  return {
    name: q.name,
    activeMessageCount: q.activeMessageCount,
    deadLetterMessageCount: q.deadLetterMessageCount,
    scheduledMessageCount: q.scheduledMessageCount,
    transferMessageCount: 0,
    transferDeadLetterMessageCount: 0,
    sizeInBytes: q.sizeInBytes,
    maxSizeInMegabytes: q.maxSizeInMegabytes,
    maxDeliveryCount: q.maxDeliveryCount,
    lockDuration: q.lockDuration,
    defaultMessageTimeToLive: q.defaultMessageTimeToLive,
    duplicateDetectionHistoryTimeWindow: '',
    requiresDuplicateDetection: q.requiresDuplicateDetection,
    requiresSession: q.requiresSession,
    deadLetteringOnMessageExpiration: q.deadLetteringOnMessageExpiration,
    enablePartitioning: q.enablePartitioning,
    enableBatchedOperations: q.enableBatchedOperations,
    status: q.status as QueueProperties['status'],
    createdAt: new Date(q.createdAt),
    updatedAt: new Date(q.updatedAt),
    accessedAt: new Date(q.accessedAt),
  };
}

function mapTopic(t: RustTopicProperties): TopicProperties {
  return {
    name: t.name,
    sizeInBytes: t.sizeInBytes,
    maxSizeInMegabytes: t.maxSizeInMegabytes,
    subscriptionCount: t.subscriptionCount,
    defaultMessageTimeToLive: t.defaultMessageTimeToLive,
    duplicateDetectionHistoryTimeWindow: '',
    requiresDuplicateDetection: t.requiresDuplicateDetection,
    enablePartitioning: t.enablePartitioning,
    enableBatchedOperations: t.enableBatchedOperations,
    status: t.status as TopicProperties['status'],
    createdAt: new Date(t.createdAt),
    updatedAt: new Date(t.updatedAt),
    accessedAt: new Date(t.accessedAt),
  };
}

function mapSubscription(s: RustSubscriptionProperties): SubscriptionProperties {
  return {
    subscriptionName: s.subscriptionName,
    topicName: s.topicName,
    activeMessageCount: s.activeMessageCount,
    deadLetterMessageCount: s.deadLetterMessageCount,
    transferMessageCount: 0,
    transferDeadLetterMessageCount: 0,
    maxDeliveryCount: s.maxDeliveryCount,
    lockDuration: s.lockDuration,
    defaultMessageTimeToLive: s.defaultMessageTimeToLive,
    requiresSession: s.requiresSession,
    deadLetteringOnMessageExpiration: s.deadLetteringOnMessageExpiration,
    deadLetteringOnFilterEvaluationExceptions: false,
    enableBatchedOperations: s.enableBatchedOperations,
    autoDeleteOnIdle: s.autoDeleteOnIdle,
    status: s.status as SubscriptionProperties['status'],
    createdAt: new Date(s.createdAt),
    updatedAt: new Date(s.updatedAt),
    accessedAt: new Date(s.accessedAt),
  };
}

function mapMessage(m: RustServiceBusMessage): ServiceBusMessage {
  return {
    messageId: m.messageId,
    body: m.body,
    contentType: m.contentType,
    correlationId: m.correlationId,
    subject: m.subject,
    enqueuedTimeUtc: m.enqueuedTime ? new Date(m.enqueuedTime) : undefined,
    sequenceNumber: m.sequenceNumber ? BigInt(m.sequenceNumber) : undefined,
    deliveryCount: m.deliveryCount,
  };
}

class ServiceBusService {
  private connected: boolean = false;

  async connect(connectionString: string): Promise<void> {
    await invoke('sb_connect', { connectionString });
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    await invoke('sb_disconnect');
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('Not connected to Service Bus. Please connect first.');
    }
  }

  async listQueues(): Promise<QueueProperties[]> {
    this.ensureConnected();
    const queues = await invoke<RustQueueProperties[]>('sb_list_queues');
    return queues.map(mapQueue);
  }

  async getQueue(queueName: string): Promise<QueueProperties> {
    this.ensureConnected();
    const q = await invoke<RustQueueProperties>('sb_get_queue', { queueName });
    return mapQueue(q);
  }

  async deleteQueue(queueName: string): Promise<void> {
    this.ensureConnected();
    await invoke('sb_delete_queue', { queueName });
  }

  async deleteTopic(topicName: string): Promise<void> {
    this.ensureConnected();
    await invoke('sb_delete_topic', { topicName });
  }

  async deleteSubscription(topicName: string, subscriptionName: string): Promise<void> {
    this.ensureConnected();
    await invoke('sb_delete_subscription', { topicName, subscriptionName });
  }

  async listTopics(): Promise<TopicProperties[]> {
    this.ensureConnected();
    const topics = await invoke<RustTopicProperties[]>('sb_list_topics');
    return topics.map(mapTopic);
  }

  async getTopic(topicName: string): Promise<TopicProperties> {
    this.ensureConnected();
    const t = await invoke<RustTopicProperties>('sb_get_topic', { topicName });
    return mapTopic(t);
  }

  async listSubscriptions(topicName: string): Promise<SubscriptionProperties[]> {
    this.ensureConnected();
    const subscriptions = await invoke<RustSubscriptionProperties[]>('sb_list_subscriptions', { topicName });
    return subscriptions.map(mapSubscription);
  }

  async peekQueueMessages(
    queueName: string,
    maxMessageCount: number = 100,
    source: MessageSource = 'active'
  ): Promise<ServiceBusMessage[]> {
    this.ensureConnected();
    const messages = await invoke<RustServiceBusMessage[]>('sb_peek_queue_messages', {
      queueName,
      maxCount: maxMessageCount,
      fromDeadLetter: source === 'deadletter',
    });
    return messages.map(mapMessage);
  }

  async peekSubscriptionMessages(
    topicName: string,
    subscriptionName: string,
    maxMessageCount: number = 100,
    source: MessageSource = 'active'
  ): Promise<ServiceBusMessage[]> {
    this.ensureConnected();
    const messages = await invoke<RustServiceBusMessage[]>('sb_peek_subscription_messages', {
      topicName,
      subscriptionName,
      maxCount: maxMessageCount,
      fromDeadLetter: source === 'deadletter',
    });
    return messages.map(mapMessage);
  }

  async sendMessageToQueue(queueName: string, options: SendMessageOptions): Promise<void> {
    this.ensureConnected();
    await invoke('sb_send_message', {
      entityPath: queueName,
      body: options.body,
      contentType: options.contentType,
      correlationId: options.correlationId,
      subject: options.subject,
    });
  }

  async sendMessageToTopic(topicName: string, options: SendMessageOptions): Promise<void> {
    this.ensureConnected();
    await invoke('sb_send_message', {
      entityPath: topicName,
      body: options.body,
      contentType: options.contentType,
      correlationId: options.correlationId,
      subject: options.subject,
    });
  }

  async deleteQueueMessage(queueName: string, source: MessageSource = 'active'): Promise<void> {
    this.ensureConnected();
    await invoke('sb_delete_queue_message', {
      queueName,
      fromDeadLetter: source === 'deadletter',
    });
  }

  async deleteSubscriptionMessage(
    topicName: string,
    subscriptionName: string,
    source: MessageSource = 'active'
  ): Promise<void> {
    this.ensureConnected();
    await invoke('sb_delete_subscription_message', {
      topicName,
      subscriptionName,
      fromDeadLetter: source === 'deadletter',
    });
  }

  async resubmitQueueMessage(queueName: string): Promise<void> {
    this.ensureConnected();
    await invoke('sb_resubmit_queue_message', { queueName });
  }

  async resubmitSubscriptionMessage(topicName: string, subscriptionName: string): Promise<void> {
    this.ensureConnected();
    await invoke('sb_resubmit_subscription_message', { topicName, subscriptionName });
  }
}

export const serviceBusService = new ServiceBusService();
