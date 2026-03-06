import { useState } from 'react';
import { Modal } from '../common/Modal';
import { serviceBusService } from '../../services/serviceBusService';
import { useAppStore } from '../../store/useAppStore';
import type { SendMessageOptions } from '../../types';

interface SendMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'queue' | 'topic' | 'subscription';
  entityName: string;
  onSent: () => void;
}

export function SendMessageModal({ isOpen, onClose, entityType, entityName, onSent }: SendMessageModalProps) {
  const [body, setBody] = useState('');
  const [contentType, setContentType] = useState('application/json');
  const [correlationId, setCorrelationId] = useState('');
  const [subject, setSubject] = useState('');
  const [customProperties, setCustomProperties] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setError: setGlobalError } = useAppStore();

  const handleSend = async () => {
    if (!body.trim()) {
      setError('Message body is required');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      let applicationProperties: Record<string, string> | undefined;
      if (customProperties.trim()) {
        try {
          applicationProperties = JSON.parse(customProperties);
        } catch {
          setError('Invalid JSON for custom properties');
          setIsSending(false);
          return;
        }
      }

      const options: SendMessageOptions = {
        body: body,
        contentType: contentType || undefined,
        correlationId: correlationId || undefined,
        subject: subject || undefined,
        applicationProperties,
      };

      if (entityType === 'queue') {
        await serviceBusService.sendMessageToQueue(entityName, options);
      } else {
        await serviceBusService.sendMessageToTopic(entityName, options);
      }

      // Reset form
      setBody('');
      setCorrelationId('');
      setSubject('');
      setCustomProperties('');

      onSent();
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      setError(errorMessage);
      setGlobalError(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Send Message to ${entityType === 'queue' ? 'Queue' : 'Topic'}: ${entityName}`}
      footer={
        <>
          <button className="btn btn-secondary" onClick={handleClose} disabled={isSending}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSend} disabled={isSending}>
            {isSending ? 'Sending...' : 'Send Message'}
          </button>
        </>
      }
    >
      {error && (
        <div style={{ color: 'var(--color-danger)', marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Message Body *</label>
        <textarea
          className="form-input"
          placeholder='{"key": "value"}'
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={6}
          style={{ fontFamily: 'Monaco, Menlo, monospace' }}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Content Type</label>
        <input
          type="text"
          className="form-input"
          placeholder="application/json"
          value={contentType}
          onChange={e => setContentType(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Correlation ID</label>
        <input
          type="text"
          className="form-input"
          placeholder="Optional correlation ID"
          value={correlationId}
          onChange={e => setCorrelationId(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Subject (Label)</label>
        <input
          type="text"
          className="form-input"
          placeholder="Optional subject"
          value={subject}
          onChange={e => setSubject(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Custom Properties (JSON)</label>
        <textarea
          className="form-input"
          placeholder='{"propertyName": "value"}'
          value={customProperties}
          onChange={e => setCustomProperties(e.target.value)}
          rows={3}
          style={{ fontFamily: 'Monaco, Menlo, monospace' }}
        />
      </div>
    </Modal>
  );
}
