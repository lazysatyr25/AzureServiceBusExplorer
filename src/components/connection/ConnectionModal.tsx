import { useState } from 'react';
import { Modal } from '../common/Modal';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, connectionString: string) => void;
}

export function ConnectionModal({ isOpen, onClose, onSave }: ConnectionModalProps) {
  const [name, setName] = useState('');
  const [connectionString, setConnectionString] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!connectionString.trim()) {
      setError('Connection string is required');
      return;
    }

    // Basic validation for connection string format
    if (!connectionString.includes('Endpoint=') || !connectionString.includes('SharedAccessKey=')) {
      setError('Invalid connection string format');
      return;
    }

    onSave(name.trim(), connectionString.trim());
    setName('');
    setConnectionString('');
    setError(null);
    onClose();
  };

  const handleClose = () => {
    setName('');
    setConnectionString('');
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="New Connection"
      footer={
        <>
          <button className="btn btn-secondary" onClick={handleClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save
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
        <label className="form-label">Connection Name</label>
        <input
          type="text"
          className="form-input"
          placeholder="My Service Bus"
          value={name}
          onChange={e => setName(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Connection String</label>
        <textarea
          className="form-input"
          placeholder="Endpoint=sb://...;SharedAccessKeyName=...;SharedAccessKey=..."
          value={connectionString}
          onChange={e => setConnectionString(e.target.value)}
          rows={4}
        />
      </div>

      <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
        You can find the connection string in the Azure Portal under your Service Bus namespace → Shared access policies.
      </p>
    </Modal>
  );
}
