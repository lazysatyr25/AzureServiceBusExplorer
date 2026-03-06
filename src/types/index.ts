// Connection types
export interface ServiceBusConnection {
  id: string;
  name: string;
  connectionString: string;
  createdAt: Date;
}

// Queue types
export interface QueueProperties {
  name: string;
  activeMessageCount: number;
  deadLetterMessageCount: number;
  scheduledMessageCount: number;
  transferMessageCount: number;
  transferDeadLetterMessageCount: number;
  sizeInBytes: number;
  maxSizeInMegabytes: number;
  maxDeliveryCount: number;
  lockDuration: string;
  defaultMessageTimeToLive: string;
  duplicateDetectionHistoryTimeWindow: string;
  requiresDuplicateDetection: boolean;
  requiresSession: boolean;
  deadLetteringOnMessageExpiration: boolean;
  enablePartitioning: boolean;
  enableBatchedOperations: boolean;
  status: EntityStatus;
  createdAt: Date;
  updatedAt: Date;
  accessedAt: Date;
}

// Topic types
export interface TopicProperties {
  name: string;
  sizeInBytes: number;
  maxSizeInMegabytes: number;
  subscriptionCount: number;
  defaultMessageTimeToLive: string;
  duplicateDetectionHistoryTimeWindow: string;
  requiresDuplicateDetection: boolean;
  enablePartitioning: boolean;
  enableBatchedOperations: boolean;
  status: EntityStatus;
  createdAt: Date;
  updatedAt: Date;
  accessedAt: Date;
}

// Subscription types
export interface SubscriptionProperties {
  subscriptionName: string;
  topicName: string;
  activeMessageCount: number;
  deadLetterMessageCount: number;
  transferMessageCount: number;
  transferDeadLetterMessageCount: number;
  maxDeliveryCount: number;
  lockDuration: string;
  defaultMessageTimeToLive: string;
  requiresSession: boolean;
  deadLetteringOnMessageExpiration: boolean;
  deadLetteringOnFilterEvaluationExceptions: boolean;
  enableBatchedOperations: boolean;
  autoDeleteOnIdle: string;
  status: EntityStatus;
  createdAt: Date;
  updatedAt: Date;
  accessedAt: Date;
}

// Message types
export interface ServiceBusMessage {
  messageId: string;
  body: unknown;
  contentType?: string;
  correlationId?: string;
  subject?: string;
  to?: string;
  replyTo?: string;
  replyToSessionId?: string;
  sessionId?: string;
  timeToLive?: number;
  scheduledEnqueueTimeUtc?: Date;
  partitionKey?: string;
  applicationProperties?: Record<string, unknown>;
  enqueuedTimeUtc?: Date;
  sequenceNumber?: bigint;
  deliveryCount?: number;
  lockedUntilUtc?: Date;
  lockToken?: string;
  deadLetterSource?: string;
  deadLetterReason?: string;
  deadLetterErrorDescription?: string;
  state?: 'active' | 'deferred' | 'scheduled';
}

export interface SendMessageOptions {
  body: string;
  contentType?: string;
  correlationId?: string;
  subject?: string;
  to?: string;
  replyTo?: string;
  sessionId?: string;
  timeToLiveSeconds?: number;
  scheduledEnqueueTime?: Date;
  applicationProperties?: Record<string, string>;
}

// Entity status
export type EntityStatus = 'Active' | 'Disabled' | 'SendDisabled' | 'ReceiveDisabled';

// Create options
export interface CreateQueueOptions {
  name: string;
  maxSizeInMegabytes?: number;
  maxDeliveryCount?: number;
  lockDurationSeconds?: number;
  defaultMessageTimeToLiveSeconds?: number;
  requiresDuplicateDetection?: boolean;
  duplicateDetectionHistoryTimeWindowSeconds?: number;
  requiresSession?: boolean;
  deadLetteringOnMessageExpiration?: boolean;
  enablePartitioning?: boolean;
  enableBatchedOperations?: boolean;
}

export interface CreateTopicOptions {
  name: string;
  maxSizeInMegabytes?: number;
  defaultMessageTimeToLiveSeconds?: number;
  requiresDuplicateDetection?: boolean;
  duplicateDetectionHistoryTimeWindowSeconds?: number;
  enablePartitioning?: boolean;
  enableBatchedOperations?: boolean;
}

export interface CreateSubscriptionOptions {
  topicName: string;
  subscriptionName: string;
  maxDeliveryCount?: number;
  lockDurationSeconds?: number;
  defaultMessageTimeToLiveSeconds?: number;
  requiresSession?: boolean;
  deadLetteringOnMessageExpiration?: boolean;
  deadLetteringOnFilterEvaluationExceptions?: boolean;
  enableBatchedOperations?: boolean;
}

// UI State types
export type EntityType = 'queue' | 'topic' | 'subscription';

export interface SelectedEntity {
  type: EntityType;
  name: string;
  topicName?: string; // for subscriptions
}

export type MessageSource = 'active' | 'deadletter';
