import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { serviceBusService } from '../../services/serviceBusService';
import { formatDate } from '../../utils/formatters';
import type { SubscriptionProperties } from '../../types';

interface SubscriptionDetailsProps {
  topicName: string;
  subscriptionName: string;
}

export function SubscriptionDetails({ topicName, subscriptionName }: SubscriptionDetailsProps) {
  const [subscription, setSubscription] = useState<SubscriptionProperties | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { setError } = useAppStore();

  const loadSubscription = async () => {
    setIsLoading(true);
    try {
      const subs = await serviceBusService.listSubscriptions(topicName);
      const sub = subs.find(s => s.subscriptionName === subscriptionName);
      setSubscription(sub || null);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load subscription details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSubscription();
  }, [topicName, subscriptionName]);

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading subscription details...
      </div>
    );
  }

  if (!subscription) {
    return <div className="empty-state">Subscription not found</div>;
  }

  return (
    <div>
      <div className="content-header">
        <h1>Subscription: {subscriptionName}</h1>
        <button className="btn btn-secondary" onClick={loadSubscription}>
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <div className="content-body">
        <div className="properties-panel">
          <div className="properties-section">
            <h3>Message Counts</h3>
            <div className="property-row">
              <span className="property-label">Active Messages</span>
              <span className="property-value">{subscription.activeMessageCount}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Dead Letter Messages</span>
              <span className="property-value">{subscription.deadLetterMessageCount}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Transfer Messages</span>
              <span className="property-value">{subscription.transferMessageCount}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Transfer Dead Letter Messages</span>
              <span className="property-value">{subscription.transferDeadLetterMessageCount}</span>
            </div>
          </div>

          <div className="properties-section">
            <h3>Configuration</h3>
            <div className="property-row">
              <span className="property-label">Topic Name</span>
              <span className="property-value">{subscription.topicName}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Max Delivery Count</span>
              <span className="property-value">{subscription.maxDeliveryCount}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Status</span>
              <span className="property-value">{subscription.status}</span>
            </div>
          </div>

          <div className="properties-section">
            <h3>Timing</h3>
            <div className="property-row">
              <span className="property-label">Lock Duration</span>
              <span className="property-value">{subscription.lockDuration}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Default Message TTL</span>
              <span className="property-value">{subscription.defaultMessageTimeToLive}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Auto Delete On Idle</span>
              <span className="property-value">{subscription.autoDeleteOnIdle || 'Never'}</span>
            </div>
          </div>

          <div className="properties-section">
            <h3>Features</h3>
            <div className="property-row">
              <span className="property-label">Requires Session</span>
              <span className="property-value">{subscription.requiresSession ? 'Yes' : 'No'}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Dead Lettering on Expiration</span>
              <span className="property-value">{subscription.deadLetteringOnMessageExpiration ? 'Yes' : 'No'}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Dead Lettering on Filter Exceptions</span>
              <span className="property-value">{subscription.deadLetteringOnFilterEvaluationExceptions ? 'Yes' : 'No'}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Batched Operations</span>
              <span className="property-value">{subscription.enableBatchedOperations ? 'Yes' : 'No'}</span>
            </div>
          </div>

          <div className="properties-section">
            <h3>Timestamps</h3>
            <div className="property-row">
              <span className="property-label">Created</span>
              <span className="property-value">{formatDate(subscription.createdAt)}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Updated</span>
              <span className="property-value">{formatDate(subscription.updatedAt)}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Accessed</span>
              <span className="property-value">{formatDate(subscription.accessedAt)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
