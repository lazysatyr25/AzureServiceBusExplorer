# Azure ServiceBus Explorer — Project Context

## Overview

Desktop GUI client for Azure Service Bus management. Built with **Tauri 2** (Rust backend) + **React 19** (TypeScript frontend). Allows connecting to Azure Service Bus namespaces via connection string, browsing queues/topics/subscriptions, viewing/sending/deleting messages, and resubmitting dead-letter messages.

**Version:** 0.1.0 (early stage)
**Identifier:** `com.vostroukh.azure-servicebus-explorer`

---

## Tech Stack

### Frontend
- **React 19.1** — UI framework
- **TypeScript 5.8** — strict mode enabled
- **Vite 7** — bundler, dev server on port 1420
- **Zustand 5** — global state management (single store)
- **lucide-react 0.469** — icon library
- **@tauri-apps/api v2** — IPC bridge to Rust backend via `invoke()`

### Backend (src-tauri/)
- **Tauri 2** — desktop app framework
- **Rust edition 2021**
- **reqwest 0.12** — HTTP client for Azure Service Bus REST API
- **serde / serde_json** — serialization
- **hmac 0.12 + sha2 0.10** — SAS token generation
- **base64 0.22** — encoding for SAS signatures
- **urlencoding 2.1** — URL encoding for SAS tokens
- **chrono 0.4** — timestamp for token expiry
- **quick-xml 0.37** — listed in Cargo.toml but NOT actually used; XML parsing is manual
- **tokio** — async runtime (full features)
- **tauri-plugin-opener** — default Tauri plugin

### Build
- `npm run dev` → Vite dev server
- `npm run build` → `tsc && vite build`
- `npm run tauri` → Tauri CLI
- Dev URL: `http://localhost:1420`
- Frontend dist: `../dist` (relative to src-tauri)

---

## Project Structure

```
AzSbExplorer/
├── index.html                          # HTML entry point
├── package.json                        # NPM config
├── tsconfig.json                       # TS config (strict, ES2020, react-jsx)
├── tsconfig.node.json                  # TS config for Node
├── vite.config.ts                      # Vite config with Tauri-specific settings
├── src/
│   ├── main.tsx                        # React entry: ReactDOM.createRoot, StrictMode
│   ├── App.tsx                         # Root component: Sidebar + MainContent, loads connections on mount
│   ├── App.css                         # All CSS (single file, ~690 lines, dark theme, VS Code-like)
│   ├── vite-env.d.ts                   # Vite type declarations
│   ├── types/
│   │   └── index.ts                    # All TypeScript interfaces and types
│   ├── store/
│   │   └── useAppStore.ts              # Zustand store — all app state and actions
│   ├── services/
│   │   ├── serviceBusService.ts        # Service layer — wraps Tauri invoke() calls
│   │   └── connectionStorage.ts        # Connection persistence via localStorage
│   └── components/
│       ├── common/
│       │   └── Modal.tsx               # Reusable modal component
│       ├── connection/
│       │   ├── ConnectionPanel.tsx      # Sidebar: connection list, connect/disconnect/delete
│       │   └── ConnectionModal.tsx      # Modal: add new connection form
│       ├── sidebar/
│       │   └── Sidebar.tsx             # Sidebar: tree view of queues/topics/subscriptions
│       ├── queues/
│       │   └── QueueDetails.tsx        # Properties view for selected queue
│       ├── topics/
│       │   ├── TopicDetails.tsx        # Properties view for selected topic
│       │   └── SubscriptionDetails.tsx # Properties view for selected subscription
│       ├── messages/
│       │   ├── MessageList.tsx         # Message browser: list + detail view + actions
│       │   └── SendMessageModal.tsx    # Modal: send message form
│       └── MainContent.tsx             # Main area: tabs (Properties/Messages), entity details
├── src-tauri/
│   ├── Cargo.toml                      # Rust dependencies
│   ├── tauri.conf.json                 # Tauri config (window 1200x800, CSP null, bundle all)
│   ├── build.rs                        # Tauri build script
│   ├── icons/                          # App icons for all platforms
│   └── src/
│       ├── main.rs                     # Binary entry: calls tauri_app_lib::run()
│       ├── lib.rs                      # Tauri builder: registers all commands, manages state
│       └── servicebus.rs              # All Rust backend logic (~888 lines)
└── public/                             # Static assets
```

---

## Architecture Details

### Communication Flow
```
React Component → useAppStore action → serviceBusService method → invoke('sb_*', params) → Rust command → Azure REST API
```

### State Management (Zustand store: src/store/useAppStore.ts)

**State shape:**
```typescript
{
  connections: ServiceBusConnection[]      // saved connections (from localStorage)
  activeConnection: ServiceBusConnection | null  // currently connected
  isConnecting: boolean
  connectionError: string | null

  queues: QueueProperties[]                // loaded after connect
  topics: TopicProperties[]                // loaded after connect
  subscriptions: Record<string, SubscriptionProperties[]>  // keyed by topic name, lazy-loaded

  selectedEntity: SelectedEntity | null    // { type: 'queue'|'topic'|'subscription', name, topicName? }

  messages: ServiceBusMessage[]            // messages for selected entity
  isLoadingMessages: boolean

  isLoadingQueues: boolean
  isLoadingTopics: boolean
  isLoadingSubscriptions: boolean

  error: string | null                     // global error message
}
```

**Actions:**
- `loadConnections()` — reads from localStorage
- `addConnection(name, connectionString)` — saves to localStorage, updates state
- `deleteConnection(id)` — removes from localStorage, clears active if deleted
- `connect(connection)` — calls sb_connect, then loads queues+topics in parallel
- `disconnect()` — calls sb_disconnect, resets all entity state
- `loadQueues()` — fetches queue list from Azure
- `loadTopics()` — fetches topic list from Azure
- `loadSubscriptions(topicName)` — fetches subscriptions for a topic (lazy, on expand)
- `refreshAll()` — reloads queues + topics + previously-loaded subscriptions
- `selectEntity(entity | null)` — sets selection, clears messages
- `loadMessages(maxCount=100)` — peeks messages for selected queue/subscription
- `setError(error)` / `clearError()` — error management

### Service Layer (src/services/serviceBusService.ts)

Class `ServiceBusService` (singleton export) wraps all Tauri IPC calls:

- `connect(connectionString)` → `invoke('sb_connect', { connectionString })`
- `disconnect()` → `invoke('sb_disconnect')`
- `listQueues()` → `invoke('sb_list_queues')` — maps RustQueueProperties to QueueProperties
- `listTopics()` → `invoke('sb_list_topics')` — maps RustTopicProperties to TopicProperties
- `listSubscriptions(topicName)` → `invoke('sb_list_subscriptions', { topicName })`
- `getQueue(name)` → calls listQueues() then finds by name (inefficient)
- `getTopic(name)` → calls listTopics() then finds by name (inefficient)
- `peekQueueMessages(queueName, maxCount, source)` → `invoke('sb_peek_queue_messages', { queueName, maxCount, fromDeadLetter })`
- `peekSubscriptionMessages(topicName, subscriptionName, maxCount, source)` → `invoke('sb_peek_subscription_messages', ...)`
- `sendMessageToQueue(queueName, options)` → `invoke('sb_send_message', { entityPath, body, contentType, correlationId, subject })`
- `sendMessageToTopic(topicName, options)` → same invoke as queue (entityPath = topicName)
- `deleteQueueMessage(queueName, source)` → `invoke('sb_delete_queue_message', { queueName, fromDeadLetter })`
- `deleteSubscriptionMessage(topicName, subscriptionName, source)` → `invoke('sb_delete_subscription_message', ...)`
- `resubmitQueueMessage(queueName)` → `invoke('sb_resubmit_queue_message', { queueName })`
- `resubmitSubscriptionMessage(topicName, subscriptionName)` → `invoke('sb_resubmit_subscription_message', ...)`
- `deleteQueue()` → **NOT IMPLEMENTED** (throws Error)
- `deleteTopic()` → **NOT IMPLEMENTED** (throws Error)
- `deleteSubscription()` → **NOT IMPLEMENTED** (throws Error)
- `purgeQueue()` → **NOT IMPLEMENTED** (throws Error)
- `purgeSubscription()` → **NOT IMPLEMENTED** (throws Error)

**Mapping notes:** Frontend types (QueueProperties etc.) are richer than Rust types. The service layer fills missing fields with hardcoded defaults:
- `maxDeliveryCount: 10`
- `lockDuration: 'PT1M'`
- `defaultMessageTimeToLive: 'P14D'`
- `requiresDuplicateDetection: false`
- `requiresSession: false`
- `deadLetteringOnMessageExpiration: false`
- `enablePartitioning: false`
- `enableBatchedOperations: true`
- `createdAt/updatedAt/accessedAt: new Date()` (always current time, not real)

### Connection Storage (src/services/connectionStorage.ts)

Class `ConnectionStorage` (singleton export):
- Uses `localStorage` key `'azure-sb-explorer-connections'`
- Stores `ServiceBusConnection[]` as JSON
- Methods: `list()`, `add(name, connectionString)`, `get(id)`, `update(id, name, connectionString)`, `delete(id)`
- IDs generated via `crypto.randomUUID()`

### Rust Backend (src-tauri/src/servicebus.rs)

**State:** `ServiceBusState` contains `Mutex<Option<ConnectionInfo>>` with endpoint, key_name, key parsed from connection string.

**Azure Authentication:**
- Parses connection string to extract Endpoint (sb:// → https://), SharedAccessKeyName, SharedAccessKey
- Generates SAS tokens via HMAC-SHA256: `StringToSign = url_encode(lowercase(url)) + "\n" + expiry`
- Key used as raw UTF-8 bytes (NOT base64 decoded)
- Token format: `SharedAccessSignature sr={}&sig={}&se={}&skn={}`
- Token TTL: 3600 seconds

**Azure REST API usage:**
- API version: `2017-04`
- List queues: `GET {endpoint}/$Resources/Queues?api-version=2017-04`
- List topics: `GET {endpoint}/$Resources/Topics?api-version=2017-04`
- List subscriptions: `GET {endpoint}/{topicName}/Subscriptions?api-version=2017-04`
- Peek messages: `POST {endpoint}/{path}/messages/head?api-version=2017-04` (Content-Length: 0)
- Send message: `POST {endpoint}/{entityPath}/messages?api-version=2017-04` (body = message)
- Delete message: `DELETE {endpoint}/{path}/messages/head?api-version=2017-04&timeout=60`
- Resubmit: DELETE from DLQ path → POST body back to main entity path

**XML Parsing:** Manual string-based parsing (NOT using quick-xml despite it being in Cargo.toml):
- `extract_xml_value(xml, tag)` — searches for `<tag>value</tag>` and `<prefix:tag>value</prefix:tag>`
- `extract_xml_number(xml, tag)` — parse to i64 or default 0
- Splits on `<entry`/`</entry>` to find individual entities
- Extracts: title (name), ActiveMessageCount, DeadLetterMessageCount, ScheduledMessageCount, SizeInBytes, MaxSizeInMegabytes, Status, SubscriptionCount

**Message handling:**
- Broker properties come from `BrokerProperties` response header (JSON)
- Parsed fields: MessageId, CorrelationId, Label (→subject), EnqueuedTimeUtc, SequenceNumber, DeliveryCount
- Peek is capped at `max_count.min(10)` — max 10 messages per call regardless of frontend request
- Each peek iteration creates a new SAS token (could be optimized)

**Registered Tauri commands** (in lib.rs):
1. `sb_connect` — parse + test connection
2. `sb_disconnect` — clear state
3. `sb_list_queues` — list all queues
4. `sb_list_topics` — list all topics
5. `sb_list_subscriptions` — list subscriptions for a topic
6. `sb_peek_queue_messages` — read messages from queue (active or DLQ)
7. `sb_peek_subscription_messages` — read messages from subscription (active or DLQ)
8. `sb_send_message` — send message to queue or topic
9. `sb_delete_queue_message` — destructive receive from queue
10. `sb_delete_subscription_message` — destructive receive from subscription
11. `sb_resubmit_queue_message` — move DLQ message back to queue
12. `sb_resubmit_subscription_message` — move DLQ message back to topic

---

## UI Components Detail

### App.tsx
- Root layout: `div.app` with flex row → Sidebar + MainContent
- On mount: `loadConnections()` from localStorage

### Sidebar.tsx
- Top: `ConnectionPanel` (connection management)
- If connected: "Refresh All" button → `refreshAll()`
- Tree view with two sections:
  - **Queues** — grouped by prefix before first `/` (e.g., `orders/create` → group `orders`)
    - `QueueGroup` component for grouped queues with expand/collapse
    - Shows message counts: (active, deadletter, 0) — third value always hardcoded 0
    - Active/deadletter counts colored if > 0
  - **Topics** — flat list, expandable to show subscriptions
    - Click chevron to expand → lazy-loads subscriptions via `loadSubscriptions(topicName)`
    - Subscriptions show active/deadletter badges
- Selection: `selectEntity({ type, name, topicName? })`

### MainContent.tsx
- No connection → "No Connection" empty state with Plug icon
- No entity selected → "Select an Entity" empty state with Database icon
- Entity selected → error banner (if any) + tab bar (Properties/Messages) + content
  - Messages tab only shown for queue and subscription (not topic)
  - Properties tab renders: QueueDetails / TopicDetails / SubscriptionDetails
  - Messages tab renders: MessageList

### ConnectionPanel.tsx
- Header: "Connections" label + "+" button
- Connection error display
- Connection list: each item shows status dot (green if active), name, plug/unplug icon, trash button
- Click connection: toggle connect/disconnect
- Delete: `confirm()` dialog → `deleteConnection(id)`
- Opens `ConnectionModal` for new connection

### ConnectionModal.tsx
- Form fields: Connection Name (text), Connection String (textarea, 4 rows)
- Validation: name required, connectionString required, must contain `Endpoint=` and `SharedAccessKey=`
- Help text about finding connection string in Azure Portal

### QueueDetails.tsx
- Header: "Queue: {name}" + Refresh + Delete buttons
- Loads queue via `serviceBusService.getQueue(name)` (calls listQueues internally)
- Sections: Message Counts, Size & Limits, Timing, Features, Timestamps
- Delete calls `serviceBusService.deleteQueue()` — **will always throw error (not implemented)**
- Has local `formatBytes()` and `formatDate()` helpers

### TopicDetails.tsx
- Same structure as QueueDetails but for topics
- Sections: Overview, Size & Limits, Timing, Features, Timestamps
- Delete calls `serviceBusService.deleteTopic()` — **will always throw error**
- Duplicated `formatBytes()` and `formatDate()`

### SubscriptionDetails.tsx
- Same structure, loads via `listSubscriptions(topicName)` then finds by name
- Sections: Message Counts, Configuration, Timing, Features, Timestamps
- Delete calls `serviceBusService.deleteSubscription()` — **will always throw error**
- Duplicated `formatDate()`

### MessageList.tsx
- Toolbar: Active/Dead Letter tabs + Refresh/Send/Purge buttons
- Left panel: scrollable message list with preview (first 100 chars of body)
- Right panel (50% width): selected message detail — properties + application properties + body (pre-formatted JSON)
- Actions on selected message:
  - **Delete** — `sb_delete_*_message` (destructive receive from head)
  - **Resubmit** (only in DLQ mode) — `sb_resubmit_*_message` (DELETE from DLQ + POST back)
- Purge calls `serviceBusService.purgeQueue/purgeSubscription()` — **will always throw error**
- Auto-refreshes when selectedEntity or messageSource changes
- Uses `useAppStore.setState()` directly (bypasses actions) for loading state

### SendMessageModal.tsx
- Form: Body (textarea, monospace, required), Content Type (default "application/json"), Correlation ID, Subject, Custom Properties (JSON textarea)
- Validates body required, custom properties must be valid JSON
- Sends via `serviceBusService.sendMessageToQueue/sendMessageToTopic`
- On success: resets form, calls onSent callback, closes modal

### Modal.tsx
- Generic modal: overlay (click to close) + modal box (click stops propagation)
- Props: isOpen, onClose, title, children, footer
- Header with title + X close button

---

## CSS / Theming (App.css)

Single CSS file, dark theme (VS Code-inspired):

**CSS Variables:**
```css
--color-bg: #1e1e1e          (main background)
--color-bg-secondary: #252526 (sidebar, headers)
--color-bg-tertiary: #2d2d2d  (inputs, badges)
--color-bg-hover: #3c3c3c     (hover state)
--color-bg-active: #094771    (selected items — blue)
--color-border: #3c3c3c
--color-text: #cccccc
--color-text-secondary: #858585
--color-text-muted: #6b6b6b
--color-primary: #0e639c      (buttons, active tab border)
--color-primary-hover: #1177bb
--color-danger: #f14c4c       (delete, DLQ badges)
--color-danger-hover: #d73a3a
--color-success: #4caf50      (connected status dot)
--color-warning: #ff9800
--color-info: #2196f3
--sidebar-width: 280px
--header-height: 40px
```

**Key style classes:** `.app`, `.sidebar`, `.sidebar-content`, `.tree-section`, `.tree-item`, `.tree-sub-item` (padded 52px), `.main-content`, `.content-header`, `.content-body`, `.connection-panel`, `.connection-item`, `.btn` (variants: primary/secondary/danger/icon/sm), `.form-group/.form-label/.form-input`, `.modal-overlay/.modal`, `.messages-panel/.messages-toolbar/.messages-list/.message-item/.message-detail`, `.tabs/.tab`, `.properties-panel/.properties-section/.property-row`, `.empty-state`, `.loading/.spinner`, `.toast` (not actively used), custom scrollbar styles.

**Animations:** `@keyframes spin` (spinner), `@keyframes slideIn` (toast), `.spinning` class for RefreshCw icon.

---

## Types (src/types/index.ts)

### Data Types
```typescript
ServiceBusConnection { id, name, connectionString, createdAt: Date }

QueueProperties { name, activeMessageCount, deadLetterMessageCount, scheduledMessageCount,
  transferMessageCount, transferDeadLetterMessageCount, sizeInBytes, maxSizeInMegabytes,
  maxDeliveryCount, lockDuration, defaultMessageTimeToLive, duplicateDetectionHistoryTimeWindow,
  requiresDuplicateDetection, requiresSession, deadLetteringOnMessageExpiration,
  enablePartitioning, enableBatchedOperations, status: EntityStatus, createdAt, updatedAt, accessedAt }

TopicProperties { name, sizeInBytes, maxSizeInMegabytes, subscriptionCount,
  defaultMessageTimeToLive, duplicateDetectionHistoryTimeWindow, requiresDuplicateDetection,
  enablePartitioning, enableBatchedOperations, status: EntityStatus, createdAt, updatedAt, accessedAt }

SubscriptionProperties { subscriptionName, topicName, activeMessageCount, deadLetterMessageCount,
  transferMessageCount, transferDeadLetterMessageCount, maxDeliveryCount, lockDuration,
  defaultMessageTimeToLive, requiresSession, deadLetteringOnMessageExpiration,
  deadLetteringOnFilterEvaluationExceptions, enableBatchedOperations, status: EntityStatus,
  createdAt, updatedAt, accessedAt }

ServiceBusMessage { messageId, body: unknown, contentType?, correlationId?, subject?, to?,
  replyTo?, replyToSessionId?, sessionId?, timeToLive?, scheduledEnqueueTimeUtc?, partitionKey?,
  applicationProperties?: Record<string, unknown>, enqueuedTimeUtc?, sequenceNumber?: bigint,
  deliveryCount?, lockedUntilUtc?, lockToken?, deadLetterSource?, deadLetterReason?,
  deadLetterErrorDescription?, state?: 'active'|'deferred'|'scheduled' }

SendMessageOptions { body, contentType?, correlationId?, subject?, to?, replyTo?,
  sessionId?, timeToLiveSeconds?, scheduledEnqueueTime?, applicationProperties?: Record<string, string> }

EntityStatus = 'Active' | 'Disabled' | 'SendDisabled' | 'ReceiveDisabled'
EntityType = 'queue' | 'topic' | 'subscription'
SelectedEntity { type: EntityType, name, topicName?: string }
MessageSource = 'active' | 'deadletter'
```

### Create Options (defined but not used in the app)
```typescript
CreateQueueOptions { name, maxSizeInMegabytes?, maxDeliveryCount?, lockDurationSeconds?, ... }
CreateTopicOptions { name, maxSizeInMegabytes?, ... }
CreateSubscriptionOptions { topicName, subscriptionName, maxDeliveryCount?, ... }
```

---

## Rust Types (src-tauri/src/servicebus.rs)

```rust
ConnectionInfo { endpoint: String, key_name: String, key: String }

QueueProperties { name, active_message_count: i64, dead_letter_message_count: i64,
  scheduled_message_count: i64, size_in_bytes: i64, max_size_in_megabytes: i64, status: String }
  // serde rename: camelCase for JSON

TopicProperties { name, size_in_bytes, max_size_in_megabytes, subscription_count, status }

SubscriptionProperties { subscription_name, topic_name, active_message_count, dead_letter_message_count, status }

ServiceBusMessage { message_id, body, content_type?, correlation_id?, subject?,
  enqueued_time?, sequence_number?: i64, delivery_count?: i32 }

ServiceBusState { connection: Mutex<Option<ConnectionInfo>> }
```

---

## Known Issues & Limitations

### Critical
1. **Peek actually consumes messages** — `POST /messages/head` without PeekLock is a destructive receive. Should use peek-lock mode or AMQP.
2. **Connection strings stored in plaintext** in localStorage (contains SharedAccessKey secrets).

### Not Implemented (stubs that throw errors)
3. Delete queue / topic / subscription — buttons visible in UI but throw
4. Purge messages — button visible in MessageList but throws
5. Create queue / topic / subscription — types defined but no UI or backend

### Data Accuracy
6. Many queue/topic/subscription properties hardcoded in frontend mapping (not from Azure)
7. Timestamps (createdAt/updatedAt/accessedAt) always show current time, not real values
8. Message counts show (active, deadletter, 0) — third value always 0

### Performance
9. `getQueue()` and `getTopic()` call full list then filter — no single-entity API call
10. Peek capped at 10 messages (`max_count.min(10)`) — frontend sends 100
11. `reqwest::Client::new()` created per request instead of reusing
12. SAS token regenerated per message in peek loop
13. Subscriptions list re-fetched to get single subscription details

### Code Quality
14. `quick-xml` crate in Cargo.toml but not used — manual XML parsing instead
15. Significant Rust code duplication: peek/delete/resubmit for queue vs subscription
16. Duplicated utility functions (formatBytes, formatDate) across QueueDetails, TopicDetails, SubscriptionDetails
17. `MessageList.tsx` uses `useAppStore.setState()` directly instead of store actions
18. Many `console.log` / `println!` debug statements in production code
19. `Mutex::lock().unwrap()` can panic on poisoned mutex

### Security
20. `"csp": null` in tauri.conf.json — no Content Security Policy
21. No input sanitization for entity names in URL construction (potential injection in REST paths)

### UX
22. No search/filter for queues, topics, subscriptions
23. No auto-refresh / polling
24. No keyboard shortcuts
25. Confirmation dialogs use native `confirm()` — inconsistent with app's modal pattern
26. No loading indicator when connecting (only "Connecting..." text)
27. Error messages not auto-dismissed
28. No dark/light theme toggle (dark only)
29. No window title bar customization (uses native)
30. No pagination for message list

---

## Tauri Configuration (tauri.conf.json)

```json
{
  "productName": "Azure ServiceBus Explorer",
  "version": "0.1.0",
  "identifier": "com.vostroukh.azure-servicebus-explorer",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [{ "title": "Azure ServiceBus Explorer", "width": 1200, "height": 800, "minWidth": 900, "minHeight": 600 }],
    "security": { "csp": null }
  },
  "bundle": { "active": true, "targets": "all" }
}
```

---

## Development Commands

```bash
npm run dev          # Start Vite dev server (port 1420)
npm run build        # TypeScript check + Vite build
npm run preview      # Preview production build
npm run tauri dev    # Run Tauri in dev mode (compiles Rust + starts Vite)
npm run tauri build  # Build production app (creates .app/.dmg on macOS)
```
