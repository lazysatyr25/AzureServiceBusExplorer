import { create } from 'zustand';
import type {
  ServiceBusConnection,
  QueueProperties,
  TopicProperties,
  SubscriptionProperties,
  SelectedEntity,
  ServiceBusMessage,
} from '../types';
import { serviceBusService } from '../services/serviceBusService';
import { connectionStorage } from '../services/connectionStorage';

interface AppState {
  // Connection state
  connections: ServiceBusConnection[];
  activeConnection: ServiceBusConnection | null;
  isConnecting: boolean;
  connectionError: string | null;

  // Entities
  queues: QueueProperties[];
  topics: TopicProperties[];
  subscriptions: Record<string, SubscriptionProperties[]>; // keyed by topic name

  // Selection
  selectedEntity: SelectedEntity | null;

  // Messages
  messages: ServiceBusMessage[];
  isLoadingMessages: boolean;

  // Loading states
  isLoadingQueues: boolean;
  isLoadingTopics: boolean;
  isLoadingSubscriptions: boolean;
  refreshingQueues: Set<string>;
  autoRefreshQueues: Set<string>;
  autoRefreshAllQueues: boolean;
  refreshingTopics: Set<string>;
  autoRefreshTopics: Set<string>;
  autoRefreshAllTopics: boolean;

  // Error state
  error: string | null;

  // Actions
  loadConnections: () => void;
  addConnection: (name: string, connectionString: string) => ServiceBusConnection;
  deleteConnection: (id: string) => void;
  connect: (connection: ServiceBusConnection) => Promise<void>;
  disconnect: () => void;

  refreshQueue: (queueName: string) => Promise<void>;
  toggleAutoRefresh: (queueName: string) => void;
  toggleAutoRefreshGroup: (queueNames: string[]) => void;
  toggleAutoRefreshAllQueues: () => void;
  refreshTopic: (topicName: string) => Promise<void>;
  toggleAutoRefreshTopic: (topicName: string) => void;
  toggleAutoRefreshTopicGroup: (topicNames: string[]) => void;
  toggleAutoRefreshAllTopics: () => void;
  deleteQueue: (queueName: string) => Promise<void>;
  deleteQueues: (queueNames: string[]) => Promise<void>;
  deleteTopic: (topicName: string) => Promise<void>;
  deleteTopics: (topicNames: string[]) => Promise<void>;
  deleteSubscription: (topicName: string, subscriptionName: string) => Promise<void>;
  loadQueues: () => Promise<void>;
  loadTopics: () => Promise<void>;
  loadSubscriptions: (topicName: string) => Promise<void>;
  refreshAll: () => Promise<void>;

  selectEntity: (entity: SelectedEntity | null) => void;
  loadMessages: (maxCount?: number) => Promise<void>;

  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  connections: [],
  activeConnection: null,
  isConnecting: false,
  connectionError: null,

  queues: [],
  topics: [],
  subscriptions: {},

  selectedEntity: null,

  messages: [],
  isLoadingMessages: false,

  isLoadingQueues: false,
  isLoadingTopics: false,
  isLoadingSubscriptions: false,
  refreshingQueues: new Set<string>(),
  autoRefreshQueues: new Set<string>(),
  autoRefreshAllQueues: false,
  refreshingTopics: new Set<string>(),
  autoRefreshTopics: new Set<string>(),
  autoRefreshAllTopics: false,

  error: null,

  // Actions
  loadConnections: () => {
    const connections = connectionStorage.list();
    set({ connections });
  },

  addConnection: (name: string, connectionString: string) => {
    const connection = connectionStorage.add(name, connectionString);
    set(state => ({ connections: [...state.connections, connection] }));
    return connection;
  },

  deleteConnection: (id: string) => {
    connectionStorage.delete(id);
    set(state => ({
      connections: state.connections.filter(c => c.id !== id),
      activeConnection: state.activeConnection?.id === id ? null : state.activeConnection,
    }));
  },

  connect: async (connection: ServiceBusConnection) => {
    set({ isConnecting: true, connectionError: null });

    try {
      await serviceBusService.connect(connection.connectionString);
      set({ activeConnection: connection, isConnecting: false });

      // Load queues and topics after connecting
      await Promise.all([get().loadQueues(), get().loadTopics()]);
    } catch (error) {
      set({
        isConnecting: false,
        connectionError: error instanceof Error ? error.message : 'Failed to connect',
      });
      throw error;
    }
  },

  disconnect: () => {
    serviceBusService.disconnect();
    set({
      activeConnection: null,
      queues: [],
      topics: [],
      subscriptions: {},
      selectedEntity: null,
      messages: [],
      autoRefreshQueues: new Set<string>(),
      autoRefreshAllQueues: false,
      autoRefreshTopics: new Set<string>(),
      autoRefreshAllTopics: false,
    });
  },

  refreshQueue: async (queueName: string) => {
    set(state => ({ refreshingQueues: new Set([...state.refreshingQueues, queueName]) }));
    try {
      const updated = await serviceBusService.getQueue(queueName);
      set(state => ({
        queues: state.queues.map(q => q.name === queueName ? updated : q),
        refreshingQueues: new Set([...state.refreshingQueues].filter(n => n !== queueName)),
      }));
    } catch (error) {
      set(state => ({
        error: error instanceof Error ? error.message : 'Failed to refresh queue',
        refreshingQueues: new Set([...state.refreshingQueues].filter(n => n !== queueName)),
      }));
    }
  },

  toggleAutoRefresh: (queueName: string) => {
    set(state => {
      const next = new Set(state.autoRefreshQueues);
      if (next.has(queueName)) {
        next.delete(queueName);
      } else {
        next.add(queueName);
      }
      return { autoRefreshQueues: next };
    });
  },

  toggleAutoRefreshGroup: (queueNames: string[]) => {
    set(state => {
      const allEnabled = queueNames.every(n => state.autoRefreshQueues.has(n));
      const next = new Set(state.autoRefreshQueues);
      if (allEnabled) {
        queueNames.forEach(n => next.delete(n));
      } else {
        queueNames.forEach(n => next.add(n));
      }
      return { autoRefreshQueues: next };
    });
  },

  toggleAutoRefreshAllQueues: () => {
    set(state => ({ autoRefreshAllQueues: !state.autoRefreshAllQueues }));
  },

  refreshTopic: async (topicName: string) => {
    set(state => ({ refreshingTopics: new Set([...state.refreshingTopics, topicName]) }));
    try {
      const updated = await serviceBusService.getTopic(topicName);
      set(state => ({
        topics: state.topics.map(t => t.name === topicName ? updated : t),
        refreshingTopics: new Set([...state.refreshingTopics].filter(n => n !== topicName)),
      }));
      // Also refresh subscriptions if they were already loaded
      if (get().subscriptions[topicName]) {
        const subs = await serviceBusService.listSubscriptions(topicName);
        set(state => ({
          subscriptions: { ...state.subscriptions, [topicName]: subs },
        }));
      }
    } catch (error) {
      set(state => ({
        error: error instanceof Error ? error.message : 'Failed to refresh topic',
        refreshingTopics: new Set([...state.refreshingTopics].filter(n => n !== topicName)),
      }));
    }
  },

  toggleAutoRefreshTopic: (topicName: string) => {
    set(state => {
      const next = new Set(state.autoRefreshTopics);
      if (next.has(topicName)) {
        next.delete(topicName);
      } else {
        next.add(topicName);
      }
      return { autoRefreshTopics: next };
    });
  },

  toggleAutoRefreshTopicGroup: (topicNames: string[]) => {
    set(state => {
      const allEnabled = topicNames.every(n => state.autoRefreshTopics.has(n));
      const next = new Set(state.autoRefreshTopics);
      if (allEnabled) {
        topicNames.forEach(n => next.delete(n));
      } else {
        topicNames.forEach(n => next.add(n));
      }
      return { autoRefreshTopics: next };
    });
  },

  toggleAutoRefreshAllTopics: () => {
    set(state => ({ autoRefreshAllTopics: !state.autoRefreshAllTopics }));
  },

  deleteQueue: async (queueName: string) => {
    try {
      await serviceBusService.deleteQueue(queueName);
      // Remove from local state
      set(state => ({
        queues: state.queues.filter(q => q.name !== queueName),
        selectedEntity: state.selectedEntity?.type === 'queue' && state.selectedEntity.name === queueName
          ? null : state.selectedEntity,
        messages: state.selectedEntity?.type === 'queue' && state.selectedEntity.name === queueName
          ? [] : state.messages,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete queue' });
    }
  },

  deleteQueues: async (queueNames: string[]) => {
    const results = await Promise.allSettled(
      queueNames.map(name => serviceBusService.deleteQueue(name))
    );
    const errors = queueNames.filter((_, i) => results[i].status === 'rejected');
    await get().loadQueues();
    if (errors.length > 0) {
      set({ error: `Failed to delete queues: ${errors.join(', ')}` });
    }
    const { selectedEntity } = get();
    if (selectedEntity?.type === 'queue' && queueNames.includes(selectedEntity.name)) {
      set({ selectedEntity: null, messages: [] });
    }
  },

  deleteTopic: async (topicName: string) => {
    try {
      await serviceBusService.deleteTopic(topicName);
      set(state => ({
        topics: state.topics.filter(t => t.name !== topicName),
        subscriptions: (() => {
          const { [topicName]: _, ...rest } = state.subscriptions;
          return rest;
        })(),
        selectedEntity:
          (state.selectedEntity?.type === 'topic' && state.selectedEntity.name === topicName) ||
          (state.selectedEntity?.type === 'subscription' && state.selectedEntity.topicName === topicName)
            ? null : state.selectedEntity,
        messages:
          (state.selectedEntity?.type === 'topic' && state.selectedEntity.name === topicName) ||
          (state.selectedEntity?.type === 'subscription' && state.selectedEntity.topicName === topicName)
            ? [] : state.messages,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete topic' });
    }
  },

  deleteTopics: async (topicNames: string[]) => {
    const results = await Promise.allSettled(
      topicNames.map(name => serviceBusService.deleteTopic(name))
    );
    const errors = topicNames.filter((_, i) => results[i].status === 'rejected');
    await get().loadTopics();
    if (errors.length > 0) {
      set({ error: `Failed to delete topics: ${errors.join(', ')}` });
    }
    const { selectedEntity } = get();
    if (
      selectedEntity &&
      ((selectedEntity.type === 'topic' && topicNames.includes(selectedEntity.name)) ||
       (selectedEntity.type === 'subscription' && selectedEntity.topicName && topicNames.includes(selectedEntity.topicName)))
    ) {
      set({ selectedEntity: null, messages: [] });
    }
  },

  deleteSubscription: async (topicName: string, subscriptionName: string) => {
    try {
      await serviceBusService.deleteSubscription(topicName, subscriptionName);
      set(state => ({
        subscriptions: {
          ...state.subscriptions,
          [topicName]: (state.subscriptions[topicName] || []).filter(
            s => s.subscriptionName !== subscriptionName
          ),
        },
        selectedEntity:
          state.selectedEntity?.type === 'subscription' &&
          state.selectedEntity.topicName === topicName &&
          state.selectedEntity.name === subscriptionName
            ? null : state.selectedEntity,
        messages:
          state.selectedEntity?.type === 'subscription' &&
          state.selectedEntity.topicName === topicName &&
          state.selectedEntity.name === subscriptionName
            ? [] : state.messages,
      }));
      // Refresh topic to update subscription count
      get().refreshTopic(topicName);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete subscription' });
    }
  },

  loadQueues: async () => {
    const showSpinner = get().queues.length === 0;
    if (showSpinner) set({ isLoadingQueues: true });
    set({ error: null });

    try {
      const queues = await serviceBusService.listQueues();
      set({ queues, isLoadingQueues: false });
    } catch (error) {
      set({
        isLoadingQueues: false,
        error: error instanceof Error ? error.message : 'Failed to load queues',
      });
    }
  },

  loadTopics: async () => {
    const showSpinner = get().topics.length === 0;
    if (showSpinner) set({ isLoadingTopics: true });
    set({ error: null });

    try {
      const topics = await serviceBusService.listTopics();
      set({ topics, isLoadingTopics: false });
    } catch (error) {
      set({
        isLoadingTopics: false,
        error: error instanceof Error ? error.message : 'Failed to load topics',
      });
    }
  },

  loadSubscriptions: async (topicName: string) => {
    const showSpinner = !get().subscriptions[topicName];
    if (showSpinner) set({ isLoadingSubscriptions: true });
    set({ error: null });

    try {
      const subscriptionsList = await serviceBusService.listSubscriptions(topicName);
      set(state => ({
        subscriptions: {
          ...state.subscriptions,
          [topicName]: subscriptionsList,
        },
        isLoadingSubscriptions: false,
      }));
    } catch (error) {
      set({
        isLoadingSubscriptions: false,
        error: error instanceof Error ? error.message : 'Failed to load subscriptions',
      });
    }
  },

  refreshAll: async () => {
    const { activeConnection, subscriptions } = get();
    if (!activeConnection) return;

    // Load queues and topics
    await Promise.all([get().loadQueues(), get().loadTopics()]);

    // Also refresh subscriptions for any topics that were already loaded
    const topicNames = Object.keys(subscriptions);
    if (topicNames.length > 0) {
      await Promise.all(topicNames.map(topicName => get().loadSubscriptions(topicName)));
    }
  },

  selectEntity: (entity: SelectedEntity | null) => {
    set({ selectedEntity: entity, messages: [] });
  },

  loadMessages: async (maxCount: number = 30) => {
    const { selectedEntity } = get();
    if (!selectedEntity) return;

    set({ isLoadingMessages: true, error: null });

    try {
      let messages: ServiceBusMessage[];

      if (selectedEntity.type === 'queue') {
        messages = await serviceBusService.peekQueueMessages(selectedEntity.name, maxCount);
      } else if (selectedEntity.type === 'subscription' && selectedEntity.topicName) {
        messages = await serviceBusService.peekSubscriptionMessages(
          selectedEntity.topicName,
          selectedEntity.name,
          maxCount
        );
      } else {
        messages = [];
      }

      set({ messages, isLoadingMessages: false });
    } catch (error) {
      set({
        isLoadingMessages: false,
        error: error instanceof Error ? error.message : 'Failed to load messages',
      });
    }
  },

  setError: (error: string | null) => {
    set({ error });
  },

  clearError: () => {
    set({ error: null });
  },
}));
