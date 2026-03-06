import { useState, useEffect } from 'react';
import { RefreshCw, Send, Eye, Mail, MailWarning, X, RotateCcw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { serviceBusService } from '../../services/serviceBusService';
import { SendMessageModal } from './SendMessageModal';
import { formatBody, formatDate } from '../../utils/formatters';
import type { ServiceBusMessage, MessageSource } from '../../types';

export function MessageList() {
  const { selectedEntity, messages, isLoadingMessages, setError, refreshQueue, loadSubscriptions } = useAppStore();
  const [selectedMessage, setSelectedMessage] = useState<ServiceBusMessage | null>(null);
  const [messageSource, setMessageSource] = useState<MessageSource>('active');
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResubmitting, setIsResubmitting] = useState(false);

  useEffect(() => {
    let canceled = false;

    const loadMessages = async () => {
      if (!selectedEntity || (selectedEntity.type !== 'queue' && selectedEntity.type !== 'subscription')) return;

      // Yield to event loop so React StrictMode cleanup can cancel the first call
      await new Promise(r => setTimeout(r, 0));
      if (canceled) return;

      useAppStore.setState({ isLoadingMessages: true });

      try {
        let msgs: ServiceBusMessage[] = [];
        if (selectedEntity.type === 'queue') {
          msgs = await serviceBusService.peekQueueMessages(selectedEntity.name, 100, messageSource);
        } else if (selectedEntity.type === 'subscription' && selectedEntity.topicName) {
          msgs = await serviceBusService.peekSubscriptionMessages(
            selectedEntity.topicName,
            selectedEntity.name,
            100,
            messageSource
          );
        }
        if (!canceled) {
          useAppStore.setState({ messages: msgs, isLoadingMessages: false });
        }
      } catch (error) {
        if (!canceled) {
          useAppStore.setState({ isLoadingMessages: false });
          setError(error instanceof Error ? error.message : 'Failed to load messages');
        }
      }
    };

    loadMessages();
    return () => { canceled = true; };
  }, [selectedEntity, messageSource]);

  const handleRefresh = async () => {
    if (!selectedEntity) return;

    useAppStore.setState({ isLoadingMessages: true });

    try {
      if (selectedEntity.type === 'queue') {
        const msgs = await serviceBusService.peekQueueMessages(selectedEntity.name, 100, messageSource);
        useAppStore.setState({ messages: msgs, isLoadingMessages: false });
      } else if (selectedEntity.type === 'subscription' && selectedEntity.topicName) {
        const msgs = await serviceBusService.peekSubscriptionMessages(
          selectedEntity.topicName,
          selectedEntity.name,
          100,
          messageSource
        );
        useAppStore.setState({ messages: msgs, isLoadingMessages: false });
      }
    } catch (error) {
      useAppStore.setState({ isLoadingMessages: false });
      setError(error instanceof Error ? error.message : 'Failed to load messages');
    }
  };

  const refreshEntityCounts = async () => {
    if (!selectedEntity) return;
    if (selectedEntity.type === 'queue') {
      await refreshQueue(selectedEntity.name);
    } else if (selectedEntity.type === 'subscription' && selectedEntity.topicName) {
      await loadSubscriptions(selectedEntity.topicName);
    }
  };

  const handleDeleteMessage = async () => {
    if (!selectedEntity) return;

    setIsDeleting(true);
    try {
      if (selectedEntity.type === 'queue') {
        await serviceBusService.deleteQueueMessage(selectedEntity.name, messageSource);
      } else if (selectedEntity.type === 'subscription' && selectedEntity.topicName) {
        await serviceBusService.deleteSubscriptionMessage(
          selectedEntity.topicName,
          selectedEntity.name,
          messageSource
        );
      }
      setSelectedMessage(null);
      await handleRefresh();
      refreshEntityCounts();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete message');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResubmit = async () => {
    if (!selectedEntity) return;

    setIsResubmitting(true);
    try {
      if (selectedEntity.type === 'queue') {
        await serviceBusService.resubmitQueueMessage(selectedEntity.name);
      } else if (selectedEntity.type === 'subscription' && selectedEntity.topicName) {
        await serviceBusService.resubmitSubscriptionMessage(
          selectedEntity.topicName,
          selectedEntity.name
        );
      }
      setSelectedMessage(null);
      await handleRefresh();
      refreshEntityCounts();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to resubmit message');
    } finally {
      setIsResubmitting(false);
    }
  };

  if (!selectedEntity || selectedEntity.type === 'topic') {
    return null;
  }

  return (
    <div className="messages-panel">
      <div className="messages-toolbar">
        <div className="tabs" style={{ border: 'none' }}>
          <div
            className={`tab ${messageSource === 'active' ? 'active' : ''}`}
            onClick={() => setMessageSource('active')}
          >
            <Mail size={14} style={{ marginRight: 6 }} />
            Active
          </div>
          <div
            className={`tab ${messageSource === 'deadletter' ? 'active' : ''}`}
            onClick={() => setMessageSource('deadletter')}
          >
            <MailWarning size={14} style={{ marginRight: 6 }} />
            Dead Letter
          </div>
        </div>

        <div className="btn-group">
          <button className="btn btn-secondary" onClick={handleRefresh} disabled={isLoadingMessages}>
            <RefreshCw size={14} />
            Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setIsSendModalOpen(true)}>
            <Send size={14} />
            Send
          </button>
        </div>
      </div>

      {isLoadingMessages ? (
        <div className="loading" style={{ flex: 1 }}>
          <div className="spinner" />
          Loading messages...
        </div>
      ) : messages.length === 0 ? (
        <div className="empty-state" style={{ flex: 1 }}>
          <Eye size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
          <h3>No messages</h3>
          <p>There are no {messageSource === 'deadletter' ? 'dead letter ' : ''}messages in this {selectedEntity.type}.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div className="messages-list" style={{ flex: 1 }}>
            {messages.map((msg, index) => (
              <div
                key={msg.messageId || index}
                className={`message-item ${selectedMessage?.messageId === msg.messageId ? 'selected' : ''}`}
                onClick={() => setSelectedMessage(msg)}
              >
                <div className="message-item-header">
                  <span className="message-id">{msg.messageId || `Message ${index + 1}`}</span>
                  <span className="message-time">{formatDate(msg.enqueuedTimeUtc)}</span>
                </div>
                <div className="message-body-preview">
                  {formatBody(msg.body).substring(0, 100)}
                  {formatBody(msg.body).length > 100 ? '...' : ''}
                </div>
              </div>
            ))}
          </div>

          {selectedMessage && (
            <div className="message-detail" style={{ width: '50%', maxHeight: 'none', borderTop: 'none', borderLeft: '1px solid var(--color-border)' }}>
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>PROPERTIES</h3>
                <div className="btn-group">
                  {messageSource === 'deadletter' && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResubmit();
                      }}
                      disabled={isResubmitting}
                      title="Resubmit message to main queue"
                      type="button"
                    >
                      <RotateCcw size={14} />
                      {isResubmitting ? 'Resubmitting...' : 'Resubmit'}
                    </button>
                  )}
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteMessage();
                    }}
                    disabled={isDeleting}
                    title="Delete message"
                    type="button"
                  >
                    <X size={14} />
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div className="property-row">
                  <span className="property-label">Message ID</span>
                  <span className="property-value">{selectedMessage.messageId || '-'}</span>
                </div>
                <div className="property-row">
                  <span className="property-label">Content Type</span>
                  <span className="property-value">{selectedMessage.contentType || '-'}</span>
                </div>
                <div className="property-row">
                  <span className="property-label">Correlation ID</span>
                  <span className="property-value">{selectedMessage.correlationId || '-'}</span>
                </div>
                <div className="property-row">
                  <span className="property-label">Subject</span>
                  <span className="property-value">{selectedMessage.subject || '-'}</span>
                </div>
                <div className="property-row">
                  <span className="property-label">Enqueued Time</span>
                  <span className="property-value">{formatDate(selectedMessage.enqueuedTimeUtc)}</span>
                </div>
                <div className="property-row">
                  <span className="property-label">Sequence Number</span>
                  <span className="property-value">{selectedMessage.sequenceNumber?.toString() || '-'}</span>
                </div>
                <div className="property-row">
                  <span className="property-label">Delivery Count</span>
                  <span className="property-value">{selectedMessage.deliveryCount ?? '-'}</span>
                </div>
                {messageSource === 'deadletter' && (
                  <>
                    <div className="property-row">
                      <span className="property-label">Dead Letter Reason</span>
                      <span className="property-value">{selectedMessage.deadLetterReason || '-'}</span>
                    </div>
                    <div className="property-row">
                      <span className="property-label">Dead Letter Description</span>
                      <span className="property-value">{selectedMessage.deadLetterErrorDescription || '-'}</span>
                    </div>
                  </>
                )}
              </div>

              {selectedMessage.applicationProperties && Object.keys(selectedMessage.applicationProperties).length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8 }}>APPLICATION PROPERTIES</h3>
                  {Object.entries(selectedMessage.applicationProperties).map(([key, value]) => (
                    <div className="property-row" key={key}>
                      <span className="property-label">{key}</span>
                      <span className="property-value">{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <h3 style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8 }}>BODY</h3>
                <pre style={{
                  background: 'var(--color-bg)',
                  padding: 12,
                  borderRadius: 4,
                  overflow: 'auto',
                  maxHeight: 300
                }}>
                  {formatBody(selectedMessage.body)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      <SendMessageModal
        isOpen={isSendModalOpen}
        onClose={() => setIsSendModalOpen(false)}
        entityType={selectedEntity.type}
        entityName={selectedEntity.type === 'subscription' ? selectedEntity.topicName! : selectedEntity.name}
        onSent={handleRefresh}
      />
    </div>
  );
}
