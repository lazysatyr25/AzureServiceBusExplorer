import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { serviceBusService } from '../../services/serviceBusService';
import { formatBytes, formatDate } from '../../utils/formatters';
import type { TopicProperties } from '../../types';

interface TopicDetailsProps {
  topicName: string;
}

export function TopicDetails({ topicName }: TopicDetailsProps) {
  const [topic, setTopic] = useState<TopicProperties | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { setError } = useAppStore();

  const loadTopic = async () => {
    setIsLoading(true);
    try {
      const t = await serviceBusService.getTopic(topicName);
      setTopic(t);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load topic details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTopic();
  }, [topicName]);

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading topic details...
      </div>
    );
  }

  if (!topic) {
    return <div className="empty-state">Topic not found</div>;
  }

  return (
    <div>
      <div className="content-header">
        <h1>Topic: {topicName}</h1>
        <button className="btn btn-secondary" onClick={loadTopic}>
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <div className="content-body">
        <div className="properties-panel">
          <div className="properties-section">
            <h3>Overview</h3>
            <div className="property-row">
              <span className="property-label">Subscription Count</span>
              <span className="property-value">{topic.subscriptionCount}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Status</span>
              <span className="property-value">{topic.status}</span>
            </div>
          </div>

          <div className="properties-section">
            <h3>Size & Limits</h3>
            <div className="property-row">
              <span className="property-label">Current Size</span>
              <span className="property-value">{formatBytes(topic.sizeInBytes)}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Max Size</span>
              <span className="property-value">{topic.maxSizeInMegabytes} MB</span>
            </div>
          </div>

          <div className="properties-section">
            <h3>Timing</h3>
            <div className="property-row">
              <span className="property-label">Default Message TTL</span>
              <span className="property-value">{topic.defaultMessageTimeToLive}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Duplicate Detection Window</span>
              <span className="property-value">{topic.duplicateDetectionHistoryTimeWindow || 'N/A'}</span>
            </div>
          </div>

          <div className="properties-section">
            <h3>Features</h3>
            <div className="property-row">
              <span className="property-label">Requires Duplicate Detection</span>
              <span className="property-value">{topic.requiresDuplicateDetection ? 'Yes' : 'No'}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Partitioning Enabled</span>
              <span className="property-value">{topic.enablePartitioning ? 'Yes' : 'No'}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Batched Operations</span>
              <span className="property-value">{topic.enableBatchedOperations ? 'Yes' : 'No'}</span>
            </div>
          </div>

          <div className="properties-section">
            <h3>Timestamps</h3>
            <div className="property-row">
              <span className="property-label">Created</span>
              <span className="property-value">{formatDate(topic.createdAt)}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Updated</span>
              <span className="property-value">{formatDate(topic.updatedAt)}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Accessed</span>
              <span className="property-value">{formatDate(topic.accessedAt)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
