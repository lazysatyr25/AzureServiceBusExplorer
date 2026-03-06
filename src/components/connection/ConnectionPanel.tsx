import { useState } from 'react';
import { Plus, Trash2, Plug, Unplug, Copy } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { ConnectionModal } from './ConnectionModal';
import { Modal } from '../common/Modal';
import type { ServiceBusConnection } from '../../types';

export function ConnectionPanel() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const {
    connections,
    activeConnection,
    isConnecting,
    connectionError,
    addConnection,
    deleteConnection,
    connect,
    disconnect,
  } = useAppStore();

  const handleConnect = async (connection: ServiceBusConnection) => {
    if (activeConnection?.id === connection.id) {
      disconnect();
    } else {
      try {
        await connect(connection);
      } catch (error) {
        // Error is handled in store
      }
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirm(id);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteConnection(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  return (
    <div className="connection-panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Connections
        </span>
        <button className="btn btn-icon" onClick={() => setIsModalOpen(true)} title="Add connection">
          <Plus size={16} />
        </button>
      </div>

      {connectionError && (
        <div style={{ color: 'var(--color-danger)', fontSize: 12, marginBottom: 8, padding: '8px', background: 'var(--color-bg-tertiary)', borderRadius: 4 }}>
          {connectionError}
        </div>
      )}

      {connections.length === 0 ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
          No connections yet.<br />
          Click + to add one.
        </div>
      ) : (
        connections.map(conn => (
          <div
            key={conn.id}
            className={`connection-item ${activeConnection?.id === conn.id ? 'active' : ''}`}
            onClick={() => handleConnect(conn)}
          >
            <div className={`connection-status ${activeConnection?.id === conn.id ? 'connected' : ''}`} />
            <span className="name">{conn.name}</span>
            {isConnecting && activeConnection?.id !== conn.id ? null : (
              <>
                {activeConnection?.id === conn.id ? (
                  <Unplug size={14} style={{ color: 'var(--color-text-secondary)' }} />
                ) : (
                  <Plug size={14} style={{ color: 'var(--color-text-secondary)' }} />
                )}
              </>
            )}
            <button
              className="btn btn-icon"
              onClick={e => {
                e.stopPropagation();
                navigator.clipboard.writeText(conn.connectionString);
              }}
              title="Copy connection string"
              style={{ padding: 4 }}
            >
              <Copy size={14} />
            </button>
            <button
              className="btn btn-icon"
              onClick={e => handleDelete(e, conn.id)}
              title="Delete connection"
              style={{ padding: 4 }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))
      )}

      {isConnecting && (
        <div className="loading">
          <div className="spinner" />
          Connecting...
        </div>
      )}

      <ConnectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={addConnection}
      />

      <Modal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Connection"
        footer={
          <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={confirmDelete}>Delete</button>
          </div>
        }
      >
        <p style={{ margin: 0, color: 'var(--color-text)' }}>
          Are you sure you want to delete this connection?
        </p>
      </Modal>
    </div>
  );
}
