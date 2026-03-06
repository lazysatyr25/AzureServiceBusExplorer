import type { ServiceBusConnection } from '../types';

const STORAGE_KEY = 'azure-sb-explorer-connections';

class ConnectionStorage {
  private getConnections(): ServiceBusConnection[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data).map((conn: ServiceBusConnection) => ({
        ...conn,
        createdAt: new Date(conn.createdAt),
      }));
    } catch {
      return [];
    }
  }

  private saveConnections(connections: ServiceBusConnection[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
  }

  list(): ServiceBusConnection[] {
    return this.getConnections();
  }

  add(name: string, connectionString: string): ServiceBusConnection {
    const connections = this.getConnections();
    const newConnection: ServiceBusConnection = {
      id: crypto.randomUUID(),
      name,
      connectionString,
      createdAt: new Date(),
    };
    connections.push(newConnection);
    this.saveConnections(connections);
    return newConnection;
  }

  get(id: string): ServiceBusConnection | undefined {
    return this.getConnections().find(c => c.id === id);
  }

  update(id: string, name: string, connectionString: string): ServiceBusConnection | undefined {
    const connections = this.getConnections();
    const index = connections.findIndex(c => c.id === id);
    if (index === -1) return undefined;

    connections[index] = {
      ...connections[index],
      name,
      connectionString,
    };
    this.saveConnections(connections);
    return connections[index];
  }

  delete(id: string): boolean {
    const connections = this.getConnections();
    const index = connections.findIndex(c => c.id === id);
    if (index === -1) return false;

    connections.splice(index, 1);
    this.saveConnections(connections);
    return true;
  }
}

export const connectionStorage = new ConnectionStorage();
