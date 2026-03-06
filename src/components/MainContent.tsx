import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { QueueDetails } from './queues/QueueDetails';
import { TopicDetails } from './topics/TopicDetails';
import { SubscriptionDetails } from './topics/SubscriptionDetails';
import { MessageList } from './messages/MessageList';
import { Database, Plug } from 'lucide-react';

export function MainContent() {
  const { activeConnection, selectedEntity, error, clearError } = useAppStore();
  const [activeTab, setActiveTab] = useState<'properties' | 'messages'>('properties');

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(clearError, 5000);
    return () => clearTimeout(timer);
  }, [error]);

  if (!activeConnection) {
    return (
      <div className="main-content">
        <div className="empty-state" style={{ flex: 1 }}>
          <Plug size={64} style={{ opacity: 0.3, marginBottom: 24 }} />
          <h3>No Connection</h3>
          <p>Connect to a Service Bus namespace to get started.</p>
          <p style={{ marginTop: 8 }}>Add a connection using the + button in the sidebar.</p>
        </div>
      </div>
    );
  }

  if (!selectedEntity) {
    return (
      <div className="main-content">
        <div className="empty-state" style={{ flex: 1 }}>
          <Database size={64} style={{ opacity: 0.3, marginBottom: 24 }} />
          <h3>Select an Entity</h3>
          <p>Select a queue, topic, or subscription from the sidebar to view details.</p>
        </div>
      </div>
    );
  }

  const showMessageTab = selectedEntity.type === 'queue' || selectedEntity.type === 'subscription';

  return (
    <div className="main-content">
      {error && (
        <div
          style={{
            padding: '12px 20px',
            background: 'var(--color-danger)',
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{error}</span>
          <button
            onClick={clearError}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: 18,
            }}
          >
            ×
          </button>
        </div>
      )}

      {showMessageTab && (
        <div className="tabs">
          <div
            className={`tab ${activeTab === 'properties' ? 'active' : ''}`}
            onClick={() => setActiveTab('properties')}
          >
            Properties
          </div>
          <div
            className={`tab ${activeTab === 'messages' ? 'active' : ''}`}
            onClick={() => setActiveTab('messages')}
          >
            Messages
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'messages' && showMessageTab ? (
          <MessageList />
        ) : (
          <>
            {selectedEntity.type === 'queue' && <QueueDetails queueName={selectedEntity.name} />}
            {selectedEntity.type === 'topic' && <TopicDetails topicName={selectedEntity.name} />}
            {selectedEntity.type === 'subscription' && selectedEntity.topicName && (
              <SubscriptionDetails
                topicName={selectedEntity.topicName}
                subscriptionName={selectedEntity.name}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
