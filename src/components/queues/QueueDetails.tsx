import { useEffect, useState } from 'react';
import { Trash2, RefreshCw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { serviceBusService } from '../../services/serviceBusService';
import { Modal } from '../common/Modal';
import { formatBytes, formatDate } from '../../utils/formatters';
import type { QueueProperties } from '../../types';

interface QueueDetailsProps {
  queueName: string;
}

export function QueueDetails({ queueName }: QueueDetailsProps) {
  const [queue, setQueue] = useState<QueueProperties | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { loadQueues, selectEntity, setError } = useAppStore();

  const loadQueue = async () => {
    setIsLoading(true);
    try {
      const q = await serviceBusService.getQueue(queueName);
      setQueue(q);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load queue details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [queueName]);

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    setIsDeleting(true);
    try {
      await serviceBusService.deleteQueue(queueName);
      selectEntity(null);
      await loadQueues();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete queue');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading queue details...
      </div>
    );
  }

  if (!queue) {
    return <div className="empty-state">Queue not found</div>;
  }

  return (
    <div>
      <div className="content-header">
        <h1>Queue: {queueName}</h1>
        <div className="btn-group">
          <button className="btn btn-secondary" onClick={loadQueue}>
            <RefreshCw size={14} />
            Refresh
          </button>
          <button className="btn btn-danger" onClick={() => setShowDeleteConfirm(true)} disabled={isDeleting}>
            <Trash2 size={14} />
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      <div className="content-body">
        <div className="properties-panel">
          <div className="properties-section">
            <h3>Message Counts</h3>
            <div className="property-row">
              <span className="property-label">Active Messages</span>
              <span className="property-value">{queue.activeMessageCount}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Dead Letter Messages</span>
              <span className="property-value">{queue.deadLetterMessageCount}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Scheduled Messages</span>
              <span className="property-value">{queue.scheduledMessageCount}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Transfer Messages</span>
              <span className="property-value">{queue.transferMessageCount}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Transfer Dead Letter Messages</span>
              <span className="property-value">{queue.transferDeadLetterMessageCount}</span>
            </div>
          </div>

          <div className="properties-section">
            <h3>Size & Limits</h3>
            <div className="property-row">
              <span className="property-label">Current Size</span>
              <span className="property-value">{formatBytes(queue.sizeInBytes)}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Max Size</span>
              <span className="property-value">{queue.maxSizeInMegabytes} MB</span>
            </div>
            <div className="property-row">
              <span className="property-label">Max Delivery Count</span>
              <span className="property-value">{queue.maxDeliveryCount}</span>
            </div>
          </div>

          <div className="properties-section">
            <h3>Timing</h3>
            <div className="property-row">
              <span className="property-label">Lock Duration</span>
              <span className="property-value">{queue.lockDuration}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Default Message TTL</span>
              <span className="property-value">{queue.defaultMessageTimeToLive}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Duplicate Detection Window</span>
              <span className="property-value">{queue.duplicateDetectionHistoryTimeWindow || 'N/A'}</span>
            </div>
          </div>

          <div className="properties-section">
            <h3>Features</h3>
            <div className="property-row">
              <span className="property-label">Status</span>
              <span className="property-value">{queue.status}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Requires Duplicate Detection</span>
              <span className="property-value">{queue.requiresDuplicateDetection ? 'Yes' : 'No'}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Requires Session</span>
              <span className="property-value">{queue.requiresSession ? 'Yes' : 'No'}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Dead Lettering on Expiration</span>
              <span className="property-value">{queue.deadLetteringOnMessageExpiration ? 'Yes' : 'No'}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Partitioning Enabled</span>
              <span className="property-value">{queue.enablePartitioning ? 'Yes' : 'No'}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Batched Operations</span>
              <span className="property-value">{queue.enableBatchedOperations ? 'Yes' : 'No'}</span>
            </div>
          </div>

          <div className="properties-section">
            <h3>Timestamps</h3>
            <div className="property-row">
              <span className="property-label">Created</span>
              <span className="property-value">{formatDate(queue.createdAt)}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Updated</span>
              <span className="property-value">{formatDate(queue.updatedAt)}</span>
            </div>
            <div className="property-row">
              <span className="property-label">Accessed</span>
              <span className="property-value">{formatDate(queue.accessedAt)}</span>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Queue"
        footer={
          <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
          </div>
        }
      >
        <p style={{ margin: 0, color: 'var(--color-text)' }}>
          Are you sure you want to delete queue "{queueName}"? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
