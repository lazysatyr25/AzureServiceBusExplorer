import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Inbox, MessageSquare, Bell, Folder, FolderOpen, RefreshCw, Loader2, Radio, Search } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { ConnectionPanel } from '../connection/ConnectionPanel';
import { ContextMenu, ContextMenuItem } from '../common/ContextMenu';
import { Modal } from '../common/Modal';
import type { SelectedEntity, QueueProperties, TopicProperties } from '../../types';

interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

interface DeleteConfirmState {
  title: string;
  message: string;
  onConfirm: () => Promise<void> | void;
  isProcessing?: boolean;
}

interface TreeSectionProps {
  title: string;
  count: number;
  isLoading: boolean;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
  extraIndicator?: React.ReactNode;
}

function TreeSection({ title, count, isLoading, children, defaultExpanded = true, onContextMenu, extraIndicator }: TreeSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="tree-section">
      <div
        className="tree-section-header"
        onClick={() => setIsExpanded(!isExpanded)}
        onContextMenu={onContextMenu}
      >
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {isExpanded ? (
          <FolderOpen size={14} style={{ color: '#dcb67a' }} />
        ) : (
          <Folder size={14} style={{ color: '#dcb67a' }} />
        )}
        <span>{title}</span>
        <span className="count">[{count}]</span>
        {extraIndicator}
      </div>
      {isExpanded && (
        <div className="tree-section-content">
          {isLoading ? (
            <div className="loading" style={{ padding: '8px 32px' }}>
              <div className="spinner" style={{ width: 14, height: 14 }} />
            </div>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
}

// Group items by prefix (part before first /)
function groupByPrefix<T extends { name: string }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const slashIdx = item.name.indexOf('/');
    const prefix = slashIdx !== -1 ? item.name.substring(0, slashIdx) : '';

    if (!groups.has(prefix)) {
      groups.set(prefix, []);
    }
    groups.get(prefix)!.push(item);
  }

  return groups;
}

interface QueueGroupProps {
  groupName: string;
  queues: QueueProperties[];
  isSelected: (type: SelectedEntity['type'], name: string, topicName?: string) => boolean;
  onSelectQueue: (name: string) => void;
  onContextMenu: (e: React.MouseEvent, items: ContextMenuItem[]) => void;
  onDeleteQueue: (queueName: string) => void;
  onDeleteGroupQueues: (groupName: string, queueNames: string[]) => void;
  onRefreshQueue: (queueName: string) => void;
  refreshingQueues: Set<string>;
  autoRefreshQueues: Set<string>;
  onToggleAutoRefresh: (queueName: string) => void;
  onToggleAutoRefreshGroup: (queueNames: string[]) => void;
}

function QueueGroup({ groupName, queues, isSelected, onSelectQueue, onContextMenu, onDeleteQueue, onDeleteGroupQueues, onRefreshQueue, refreshingQueues, autoRefreshQueues, onToggleAutoRefresh, onToggleAutoRefreshGroup }: QueueGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate totals for the group
  const totalActive = queues.reduce((sum, q) => sum + q.activeMessageCount, 0);
  const totalDeadLetter = queues.reduce((sum, q) => sum + q.deadLetterMessageCount, 0);

  return (
    <div>
      <div
        className="tree-item tree-group-item"
        onClick={() => setIsExpanded(!isExpanded)}
        onContextMenu={(e) => {
          e.preventDefault();
          const allAutoRefresh = queues.every(q => autoRefreshQueues.has(q.name));
          onContextMenu(e, [
            { label: isExpanded ? 'Collapse' : 'Expand', onClick: () => setIsExpanded(!isExpanded) },
            { label: 'Refresh All', onClick: () => queues.forEach(q => onRefreshQueue(q.name)) },
            { label: allAutoRefresh ? 'Stop Auto Refresh' : 'Auto Refresh (5s)', onClick: () => onToggleAutoRefreshGroup(queues.map(q => q.name)) },
            { label: `Delete All (${queues.length})`, onClick: () => onDeleteGroupQueues(groupName, queues.map(q => q.name)), danger: true },
          ]);
        }}
      >
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Folder size={14} style={{ color: '#dcb67a' }} />
        <span className="name">{groupName}</span>
        {totalActive > 0 && (
          <span className="badge active">{totalActive}</span>
        )}
        {totalDeadLetter > 0 && (
          <span className="badge deadletter">{totalDeadLetter}</span>
        )}
        {queues.some(q => autoRefreshQueues.has(q.name)) && (
          <Radio size={12} className="auto-refresh-indicator" />
        )}
      </div>
      {isExpanded && queues.map(queue => (
        <div
          key={queue.name}
          className={`tree-item tree-sub-item ${isSelected('queue', queue.name) ? 'selected' : ''}`}
          onClick={() => onSelectQueue(queue.name)}
          onContextMenu={(e) => {
            e.preventDefault();
            const isAuto = autoRefreshQueues.has(queue.name);
            onContextMenu(e, [
              { label: 'Properties', onClick: () => onSelectQueue(queue.name) },
              { label: 'Peek Messages', onClick: () => onSelectQueue(queue.name) },
              { label: 'Refresh', onClick: () => onRefreshQueue(queue.name) },
              { label: isAuto ? 'Stop Auto Refresh' : 'Auto Refresh (5s)', onClick: () => onToggleAutoRefresh(queue.name) },
              { label: 'Delete Queue', onClick: () => onDeleteQueue(queue.name), danger: true },
            ]);
          }}
        >
          <Inbox size={14} style={{ color: 'var(--color-text-secondary)' }} />
          <span className="name">{queue.name.substring(groupName.length + 1)}</span>
          {autoRefreshQueues.has(queue.name) && (
            <Radio size={12} className="auto-refresh-indicator" />
          )}
          {refreshingQueues.has(queue.name) ? (
            <Loader2 size={12} className="spinning" style={{ color: 'var(--color-text-muted)', marginLeft: 'auto' }} />
          ) : (
            <span className="message-counts">
              (<span className={queue.activeMessageCount > 0 ? 'count-active' : ''}>{queue.activeMessageCount}</span>,{' '}
              <span className={queue.deadLetterMessageCount > 0 ? 'count-deadletter' : ''}>{queue.deadLetterMessageCount}</span>,{' '}
              {queue.scheduledMessageCount})
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

interface TopicGroupProps {
  groupName: string;
  topics: TopicProperties[];
  isSelected: (type: SelectedEntity['type'], name: string, topicName?: string) => boolean;
  onSelectTopic: (name: string) => void;
  onToggleTopic: (name: string) => void;
  expandedTopics: Set<string>;
  subscriptions: Record<string, import('../../types').SubscriptionProperties[]>;
  isLoadingSubscriptions: boolean;
  onSelectSubscription: (topicName: string, subscriptionName: string) => void;
  onContextMenu: (e: React.MouseEvent, items: ContextMenuItem[]) => void;
  onRefreshTopic: (topicName: string) => void;
  refreshingTopics: Set<string>;
  autoRefreshTopics: Set<string>;
  onToggleAutoRefresh: (topicName: string) => void;
  onToggleAutoRefreshGroup: (topicNames: string[]) => void;
  onDeleteTopic: (topicName: string) => void;
  onDeleteSubscription: (topicName: string, subscriptionName: string) => void;
}

function TopicGroup({ groupName, topics, isSelected, onSelectTopic, onToggleTopic, expandedTopics, subscriptions, isLoadingSubscriptions, onSelectSubscription, onContextMenu, onRefreshTopic, refreshingTopics, autoRefreshTopics, onToggleAutoRefresh, onToggleAutoRefreshGroup, onDeleteTopic, onDeleteSubscription }: TopicGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div>
      <div
        className="tree-item tree-group-item"
        onClick={() => setIsExpanded(!isExpanded)}
        onContextMenu={(e) => {
          e.preventDefault();
          const allAutoRefresh = topics.every(t => autoRefreshTopics.has(t.name));
          onContextMenu(e, [
            { label: isExpanded ? 'Collapse' : 'Expand', onClick: () => setIsExpanded(!isExpanded) },
            { label: 'Refresh All', onClick: () => topics.forEach(t => onRefreshTopic(t.name)) },
            { label: allAutoRefresh ? 'Stop Auto Refresh' : 'Auto Refresh (5s)', onClick: () => onToggleAutoRefreshGroup(topics.map(t => t.name)) },
          ]);
        }}
      >
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Folder size={14} style={{ color: '#dcb67a' }} />
        <span className="name">{groupName}</span>
        <span className="badge">{topics.length}</span>
        {topics.some(t => autoRefreshTopics.has(t.name)) && (
          <Radio size={12} className="auto-refresh-indicator" />
        )}
      </div>
      {isExpanded && topics.map(topic => (
        <div key={topic.name}>
          <div
            className={`tree-item tree-sub-item ${isSelected('topic', topic.name) ? 'selected' : ''}`}
            onClick={() => onSelectTopic(topic.name)}
            onContextMenu={(e) => {
              e.preventDefault();
              const isTopicExpanded = expandedTopics.has(topic.name);
              const isAuto = autoRefreshTopics.has(topic.name);
              onContextMenu(e, [
                { label: 'Properties', onClick: () => onSelectTopic(topic.name) },
                { label: isTopicExpanded ? 'Collapse Subscriptions' : 'Expand Subscriptions', onClick: () => onToggleTopic(topic.name) },
                { label: 'Refresh', onClick: () => onRefreshTopic(topic.name) },
                { label: isAuto ? 'Stop Auto Refresh' : 'Auto Refresh (5s)', onClick: () => onToggleAutoRefresh(topic.name) },
                { label: 'Delete Topic', onClick: () => onDeleteTopic(topic.name), danger: true },
              ]);
            }}
          >
            <span
              onClick={e => {
                e.stopPropagation();
                onToggleTopic(topic.name);
              }}
              style={{ cursor: 'pointer' }}
            >
              {expandedTopics.has(topic.name) ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </span>
            <MessageSquare size={14} style={{ color: 'var(--color-text-secondary)' }} />
            <span className="name">{topic.name.substring(groupName.length + 1)}</span>
            {autoRefreshTopics.has(topic.name) && (
              <Radio size={12} className="auto-refresh-indicator" />
            )}
            {refreshingTopics.has(topic.name) ? (
              <Loader2 size={12} className="spinning" style={{ color: 'var(--color-text-muted)', marginLeft: 'auto' }} />
            ) : (
              <span className="badge">{topic.subscriptionCount} subs</span>
            )}
          </div>

          {expandedTopics.has(topic.name) && (
            <div>
              {isLoadingSubscriptions && !subscriptions[topic.name] ? (
                <div className="loading" style={{ padding: '8px 48px' }}>
                  <div className="spinner" style={{ width: 14, height: 14 }} />
                </div>
              ) : (
                (subscriptions[topic.name] || []).map(sub => (
                  <div
                    key={sub.subscriptionName}
                    className={`tree-item ${isSelected('subscription', sub.subscriptionName, topic.name) ? 'selected' : ''}`}
                    style={{ paddingLeft: 68 }}
                    onClick={() => onSelectSubscription(topic.name, sub.subscriptionName)}
                    onContextMenu={(e) => {
                      onContextMenu(e, [
                        { label: 'Properties', onClick: () => onSelectSubscription(topic.name, sub.subscriptionName) },
                        { label: 'Peek Messages', onClick: () => onSelectSubscription(topic.name, sub.subscriptionName) },
                        { label: 'Delete Subscription', onClick: () => onDeleteSubscription(topic.name, sub.subscriptionName), danger: true },
                      ]);
                    }}
                  >
                    <Bell size={14} style={{ color: 'var(--color-text-secondary)' }} />
                    <span className="name">{sub.subscriptionName}</span>
                    {sub.activeMessageCount > 0 && (
                      <span className="badge active">{sub.activeMessageCount}</span>
                    )}
                    {sub.deadLetterMessageCount > 0 && (
                      <span className="badge deadletter">{sub.deadLetterMessageCount}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function Sidebar({ style }: { style?: React.CSSProperties }) {
  const {
    activeConnection,
    queues,
    topics,
    subscriptions,
    selectedEntity,
    isLoadingQueues,
    isLoadingTopics,
    isLoadingSubscriptions,
    selectEntity,
    loadSubscriptions,
    refreshAll,
    refreshQueue,
    refreshingQueues,
    autoRefreshQueues,
    toggleAutoRefresh,
    toggleAutoRefreshGroup,
    loadQueues,
    loadTopics,
    deleteQueue,
    deleteQueues,
    refreshTopic,
    refreshingTopics,
    autoRefreshTopics,
    toggleAutoRefreshTopic,
    toggleAutoRefreshTopicGroup,
    deleteTopic,
    deleteTopics,
    deleteSubscription,
    autoRefreshAllQueues,
    toggleAutoRefreshAllQueues,
    autoRefreshAllTopics,
    toggleAutoRefreshAllTopics,
  } = useAppStore();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  // Auto-refresh intervals
  const autoRefreshQueueRef = useRef(autoRefreshQueues);
  autoRefreshQueueRef.current = autoRefreshQueues;
  const autoRefreshTopicRef = useRef(autoRefreshTopics);
  autoRefreshTopicRef.current = autoRefreshTopics;

  const hasAutoRefresh = autoRefreshQueues.size > 0 || autoRefreshTopics.size > 0 || autoRefreshAllQueues || autoRefreshAllTopics;
  useEffect(() => {
    if (!hasAutoRefresh) return;

    const interval = setInterval(() => {
      const allQueues = useAppStore.getState().autoRefreshAllQueues;
      const allTopics = useAppStore.getState().autoRefreshAllTopics;

      if (autoRefreshQueueRef.current.size > 0 || allQueues) {
        loadQueues();
      }
      if (autoRefreshTopicRef.current.size > 0 || allTopics) {
        loadTopics();
        const subs = useAppStore.getState().subscriptions;
        if (allTopics) {
          Object.keys(subs).forEach(topicName => loadSubscriptions(topicName));
        } else {
          autoRefreshTopicRef.current.forEach(topicName => {
            if (subs[topicName]) {
              loadSubscriptions(topicName);
            }
          });
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [hasAutoRefresh, loadQueues, loadTopics, loadSubscriptions]);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setIsRefreshing(false);
    }
  };

  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  const filteredQueues = useMemo(() => {
    if (!searchFilter) return queues;
    const lower = searchFilter.toLowerCase();
    return queues.filter(q => q.name.toLowerCase().includes(lower));
  }, [queues, searchFilter]);

  const filteredTopics = useMemo(() => {
    if (!searchFilter) return topics;
    const lower = searchFilter.toLowerCase();
    return topics.filter(t => t.name.toLowerCase().includes(lower));
  }, [topics, searchFilter]);

  // Group queues and topics by prefix
  const queueGroups = useMemo(() => groupByPrefix(filteredQueues), [filteredQueues]);
  const topicGroups = useMemo(() => groupByPrefix(filteredTopics), [filteredTopics]);

  const handleSelectQueue = (name: string) => {
    selectEntity({ type: 'queue', name });
  };

  const handleSelectTopic = (name: string) => {
    selectEntity({ type: 'topic', name });
  };

  const handleSelectSubscription = (topicName: string, subscriptionName: string) => {
    selectEntity({ type: 'subscription', name: subscriptionName, topicName });
  };

  const handleToggleTopic = async (topicName: string) => {
    const newExpanded = new Set(expandedTopics);
    if (newExpanded.has(topicName)) {
      newExpanded.delete(topicName);
    } else {
      newExpanded.add(topicName);
      if (!subscriptions[topicName]) {
        await loadSubscriptions(topicName);
      }
    }
    setExpandedTopics(newExpanded);
  };

  const isSelected = (type: SelectedEntity['type'], name: string, topicName?: string) => {
    if (!selectedEntity) return false;
    if (selectedEntity.type !== type) return false;
    if (selectedEntity.name !== name) return false;
    if (type === 'subscription' && selectedEntity.topicName !== topicName) return false;
    return true;
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, items: ContextMenuItem[]) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleDeleteQueue = useCallback((queueName: string) => {
    setDeleteConfirm({
      title: 'Delete Queue',
      message: `Are you sure you want to delete queue "${queueName}"? This action cannot be undone.`,
      onConfirm: () => {
        deleteQueue(queueName);
        setDeleteConfirm(null);
      },
    });
  }, [deleteQueue]);

  const handleDeleteGroupQueues = useCallback((groupName: string, queueNames: string[]) => {
    setDeleteConfirm({
      title: 'Delete All Queues in Folder',
      message: `Are you sure you want to delete all ${queueNames.length} queues in "${groupName}"? This action cannot be undone.`,
      onConfirm: async () => {
        setDeleteConfirm(prev => prev ? { ...prev, isProcessing: true } : null);
        await deleteQueues(queueNames);
        setDeleteConfirm(null);
      },
    });
  }, [deleteQueues]);

  const handleDeleteTopic = useCallback((topicName: string) => {
    setDeleteConfirm({
      title: 'Delete Topic',
      message: `Are you sure you want to delete topic "${topicName}" and all its subscriptions? This action cannot be undone.`,
      onConfirm: async () => {
        setDeleteConfirm(prev => prev ? { ...prev, isProcessing: true } : null);
        await deleteTopic(topicName);
        setDeleteConfirm(null);
      },
    });
  }, [deleteTopic]);

  const handleDeleteAllQueues = useCallback(() => {
    const allNames = queues.map(q => q.name);
    if (allNames.length === 0) return;
    setDeleteConfirm({
      title: 'Delete All Queues',
      message: `Are you sure you want to delete all ${allNames.length} queues? This action cannot be undone.`,
      onConfirm: async () => {
        setDeleteConfirm(prev => prev ? { ...prev, isProcessing: true } : null);
        await deleteQueues(allNames);
        setDeleteConfirm(null);
      },
    });
  }, [queues, deleteQueues]);

  const handleDeleteAllTopics = useCallback(() => {
    const allNames = topics.map(t => t.name);
    if (allNames.length === 0) return;
    setDeleteConfirm({
      title: 'Delete All Topics',
      message: `Are you sure you want to delete all ${allNames.length} topics and their subscriptions? This action cannot be undone.`,
      onConfirm: async () => {
        setDeleteConfirm(prev => prev ? { ...prev, isProcessing: true } : null);
        await deleteTopics(allNames);
        setDeleteConfirm(null);
      },
    });
  }, [topics, deleteTopics]);

  const handleDeleteSubscription = useCallback((topicName: string, subscriptionName: string) => {
    setDeleteConfirm({
      title: 'Delete Subscription',
      message: `Are you sure you want to delete subscription "${subscriptionName}" from topic "${topicName}"? This action cannot be undone.`,
      onConfirm: () => {
        deleteSubscription(topicName, subscriptionName);
        setDeleteConfirm(null);
      },
    });
  }, [deleteSubscription]);

  return (
    <div className="sidebar" style={style} onContextMenu={(e) => e.preventDefault()}>
      <ConnectionPanel />

      {activeConnection && (
        <>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleRefreshAll}
                disabled={isRefreshing || isLoadingQueues || isLoadingTopics}
                style={{ flex: 1 }}
              >
                <RefreshCw size={14} className={isRefreshing ? 'spinning' : ''} />
                {isRefreshing ? 'Refreshing...' : 'Refresh All'}
              </button>
              <button
                className={`btn btn-sm ${autoRefreshAllQueues && autoRefreshAllTopics ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  if (autoRefreshAllQueues && autoRefreshAllTopics) {
                    toggleAutoRefreshAllQueues();
                    toggleAutoRefreshAllTopics();
                  } else {
                    if (!autoRefreshAllQueues) toggleAutoRefreshAllQueues();
                    if (!autoRefreshAllTopics) toggleAutoRefreshAllTopics();
                  }
                }}
                title={autoRefreshAllQueues && autoRefreshAllTopics ? 'Stop Auto Refresh' : 'Auto Refresh All (5s)'}
              >
                <Radio size={14} />
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                className="form-input"
                type="text"
                placeholder="Filter entities..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                style={{ width: '100%', paddingLeft: 28, fontSize: 12, height: 28, boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div className="sidebar-content" style={{ paddingTop: 8 }}>
            <TreeSection
              title="Queues"
              count={filteredQueues.length}
              isLoading={isLoadingQueues}
              onContextMenu={(e) => {
                e.preventDefault();
                const allQueueNames = queues.map(q => q.name);
                handleContextMenu(e, [
                  { label: 'Refresh All Queues', onClick: () => loadQueues() },
                  { label: autoRefreshAllQueues ? 'Stop Auto Refresh All' : 'Auto Refresh All (5s)', onClick: toggleAutoRefreshAllQueues },
                  { label: `Delete All Queues (${allQueueNames.length})`, onClick: handleDeleteAllQueues, danger: true },
                ]);
              }}
              extraIndicator={autoRefreshAllQueues || autoRefreshQueues.size > 0 ? <Radio size={12} className="auto-refresh-indicator" /> : undefined}
            >
              {filteredQueues.length === 0 ? (
                <div style={{ padding: '8px 32px', color: 'var(--color-text-muted)', fontSize: 12 }}>
                  No queues found
                </div>
              ) : (
                <>
                  {/* Grouped queues (folders first) */}
                  {Array.from(queueGroups.entries())
                    .filter(([prefix]) => prefix !== '')
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([prefix, groupQueues]) => (
                      <QueueGroup
                        key={prefix}
                        groupName={prefix}
                        queues={groupQueues}
                        isSelected={isSelected}
                        onSelectQueue={handleSelectQueue}
                        onContextMenu={handleContextMenu}
                        onDeleteQueue={handleDeleteQueue}
                        onDeleteGroupQueues={handleDeleteGroupQueues}
                        onRefreshQueue={refreshQueue}
                        refreshingQueues={refreshingQueues}
                        autoRefreshQueues={autoRefreshQueues}
                        onToggleAutoRefresh={toggleAutoRefresh}
                        onToggleAutoRefreshGroup={toggleAutoRefreshGroup}
                      />
                    ))}
                  {/* Ungrouped queues (no prefix) */}
                  {queueGroups.get('')?.map(queue => (
                    <div
                      key={queue.name}
                      className={`tree-item ${isSelected('queue', queue.name) ? 'selected' : ''}`}
                      onClick={() => handleSelectQueue(queue.name)}
                      onContextMenu={(e) => {
                        const isAuto = autoRefreshQueues.has(queue.name);
                        handleContextMenu(e, [
                          { label: 'Properties', onClick: () => handleSelectQueue(queue.name) },
                          { label: 'Peek Messages', onClick: () => handleSelectQueue(queue.name) },
                          { label: 'Refresh', onClick: () => refreshQueue(queue.name) },
                          { label: isAuto ? 'Stop Auto Refresh' : 'Auto Refresh (5s)', onClick: () => toggleAutoRefresh(queue.name) },
                          { label: 'Delete Queue', onClick: () => handleDeleteQueue(queue.name), danger: true },
                        ]);
                      }}
                    >
                      <Inbox size={14} style={{ color: 'var(--color-text-secondary)' }} />
                      <span className="name">{queue.name}</span>
                      {autoRefreshQueues.has(queue.name) && (
                        <Radio size={12} className="auto-refresh-indicator" />
                      )}
                      {refreshingQueues.has(queue.name) ? (
                        <Loader2 size={12} className="spinning" style={{ color: 'var(--color-text-muted)', marginLeft: 'auto' }} />
                      ) : (
                        <span className="message-counts">
                          (<span className={queue.activeMessageCount > 0 ? 'count-active' : ''}>{queue.activeMessageCount}</span>,{' '}
                          <span className={queue.deadLetterMessageCount > 0 ? 'count-deadletter' : ''}>{queue.deadLetterMessageCount}</span>,{' '}
                          0)
                        </span>
                      )}
                    </div>
                  ))}
                </>
              )}
            </TreeSection>

            <TreeSection
              title="Topics"
              count={filteredTopics.length}
              isLoading={isLoadingTopics}
              onContextMenu={(e) => {
                e.preventDefault();
                const allTopicNames = topics.map(t => t.name);
                handleContextMenu(e, [
                  { label: 'Refresh All Topics', onClick: () => loadTopics() },
                  { label: autoRefreshAllTopics ? 'Stop Auto Refresh All' : 'Auto Refresh All (5s)', onClick: toggleAutoRefreshAllTopics },
                  { label: `Delete All Topics (${allTopicNames.length})`, onClick: handleDeleteAllTopics, danger: true },
                ]);
              }}
              extraIndicator={autoRefreshAllTopics || autoRefreshTopics.size > 0 ? <Radio size={12} className="auto-refresh-indicator" /> : undefined}
            >
              {filteredTopics.length === 0 ? (
                <div style={{ padding: '8px 32px', color: 'var(--color-text-muted)', fontSize: 12 }}>
                  No topics found
                </div>
              ) : (
                <>
                  {/* Grouped topics (folders first) */}
                  {Array.from(topicGroups.entries())
                    .filter(([prefix]) => prefix !== '')
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([prefix, groupTopics]) => (
                      <TopicGroup
                        key={prefix}
                        groupName={prefix}
                        topics={groupTopics}
                        isSelected={isSelected}
                        onSelectTopic={handleSelectTopic}
                        onToggleTopic={handleToggleTopic}
                        expandedTopics={expandedTopics}
                        subscriptions={subscriptions}
                        isLoadingSubscriptions={isLoadingSubscriptions}
                        onSelectSubscription={handleSelectSubscription}
                        onContextMenu={handleContextMenu}
                        onRefreshTopic={refreshTopic}
                        refreshingTopics={refreshingTopics}
                        autoRefreshTopics={autoRefreshTopics}
                        onToggleAutoRefresh={toggleAutoRefreshTopic}
                        onToggleAutoRefreshGroup={toggleAutoRefreshTopicGroup}
                        onDeleteTopic={handleDeleteTopic}
                        onDeleteSubscription={handleDeleteSubscription}
                      />
                    ))}
                  {/* Ungrouped topics (no prefix) */}
                  {topicGroups.get('')?.map(topic => (
                    <div key={topic.name}>
                      <div
                        className={`tree-item ${isSelected('topic', topic.name) ? 'selected' : ''}`}
                        onClick={() => handleSelectTopic(topic.name)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          const isExpanded = expandedTopics.has(topic.name);
                          const isAuto = autoRefreshTopics.has(topic.name);
                          handleContextMenu(e, [
                            { label: 'Properties', onClick: () => handleSelectTopic(topic.name) },
                            { label: isExpanded ? 'Collapse Subscriptions' : 'Expand Subscriptions', onClick: () => handleToggleTopic(topic.name) },
                            { label: 'Refresh', onClick: () => refreshTopic(topic.name) },
                            { label: isAuto ? 'Stop Auto Refresh' : 'Auto Refresh (5s)', onClick: () => toggleAutoRefreshTopic(topic.name) },
                            { label: 'Delete Topic', onClick: () => handleDeleteTopic(topic.name), danger: true },
                          ]);
                        }}
                      >
                        <span
                          onClick={e => {
                            e.stopPropagation();
                            handleToggleTopic(topic.name);
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          {expandedTopics.has(topic.name) ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                        </span>
                        <MessageSquare size={14} style={{ color: 'var(--color-text-secondary)' }} />
                        <span className="name">{topic.name}</span>
                        {autoRefreshTopics.has(topic.name) && (
                          <Radio size={12} className="auto-refresh-indicator" />
                        )}
                        {refreshingTopics.has(topic.name) ? (
                          <Loader2 size={12} className="spinning" style={{ color: 'var(--color-text-muted)', marginLeft: 'auto' }} />
                        ) : (
                          <span className="badge">{topic.subscriptionCount} subs</span>
                        )}
                      </div>

                      {expandedTopics.has(topic.name) && (
                        <div>
                          {isLoadingSubscriptions && !subscriptions[topic.name] ? (
                            <div className="loading" style={{ padding: '8px 48px' }}>
                              <div className="spinner" style={{ width: 14, height: 14 }} />
                            </div>
                          ) : (
                            (subscriptions[topic.name] || []).map(sub => (
                              <div
                                key={sub.subscriptionName}
                                className={`tree-item tree-sub-item ${
                                  isSelected('subscription', sub.subscriptionName, topic.name) ? 'selected' : ''
                                }`}
                                onClick={() => handleSelectSubscription(topic.name, sub.subscriptionName)}
                                onContextMenu={(e) => {
                                  handleContextMenu(e, [
                                    { label: 'Properties', onClick: () => handleSelectSubscription(topic.name, sub.subscriptionName) },
                                    { label: 'Peek Messages', onClick: () => handleSelectSubscription(topic.name, sub.subscriptionName) },
                                    { label: 'Delete Subscription', onClick: () => handleDeleteSubscription(topic.name, sub.subscriptionName), danger: true },
                                  ]);
                                }}
                              >
                                <Bell size={14} style={{ color: 'var(--color-text-secondary)' }} />
                                <span className="name">{sub.subscriptionName}</span>
                                {sub.activeMessageCount > 0 && (
                                  <span className="badge active">{sub.activeMessageCount}</span>
                                )}
                                {sub.deadLetterMessageCount > 0 && (
                                  <span className="badge deadletter">{sub.deadLetterMessageCount}</span>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </TreeSection>
          </div>
        </>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={closeContextMenu}
        />
      )}

      <Modal
        isOpen={deleteConfirm !== null}
        onClose={() => !deleteConfirm?.isProcessing && setDeleteConfirm(null)}
        title={deleteConfirm?.title ?? ''}
        footer={
          <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)} disabled={deleteConfirm?.isProcessing}>Cancel</button>
            <button className="btn btn-danger" onClick={() => deleteConfirm?.onConfirm()} disabled={deleteConfirm?.isProcessing}>
              {deleteConfirm?.isProcessing ? (
                <><Loader2 size={14} className="spinning" /> Deleting...</>
              ) : 'Delete'}
            </button>
          </div>
        }
      >
        <p style={{ margin: 0, color: 'var(--color-text)' }}>
          {deleteConfirm?.message}
        </p>
      </Modal>
    </div>
  );
}
