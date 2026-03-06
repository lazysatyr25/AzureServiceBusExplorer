use base64::{engine::general_purpose::STANDARD, Engine};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::collections::HashMap;
use std::sync::Mutex;
use chrono::Utc;

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ConnectionInfo {
    pub endpoint: String,
    pub key_name: String,
    pub key: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct QueueProperties {
    pub name: String,
    #[serde(rename = "activeMessageCount")]
    pub active_message_count: i64,
    #[serde(rename = "deadLetterMessageCount")]
    pub dead_letter_message_count: i64,
    #[serde(rename = "scheduledMessageCount")]
    pub scheduled_message_count: i64,
    #[serde(rename = "sizeInBytes")]
    pub size_in_bytes: i64,
    #[serde(rename = "maxSizeInMegabytes")]
    pub max_size_in_megabytes: i64,
    pub status: String,
    #[serde(rename = "maxDeliveryCount")]
    pub max_delivery_count: i64,
    #[serde(rename = "lockDuration")]
    pub lock_duration: String,
    #[serde(rename = "defaultMessageTimeToLive")]
    pub default_message_time_to_live: String,
    #[serde(rename = "requiresDuplicateDetection")]
    pub requires_duplicate_detection: bool,
    #[serde(rename = "requiresSession")]
    pub requires_session: bool,
    #[serde(rename = "deadLetteringOnMessageExpiration")]
    pub dead_lettering_on_message_expiration: bool,
    #[serde(rename = "enablePartitioning")]
    pub enable_partitioning: bool,
    #[serde(rename = "enableBatchedOperations")]
    pub enable_batched_operations: bool,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    #[serde(rename = "accessedAt")]
    pub accessed_at: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TopicProperties {
    pub name: String,
    #[serde(rename = "sizeInBytes")]
    pub size_in_bytes: i64,
    #[serde(rename = "maxSizeInMegabytes")]
    pub max_size_in_megabytes: i64,
    #[serde(rename = "subscriptionCount")]
    pub subscription_count: i64,
    pub status: String,
    #[serde(rename = "defaultMessageTimeToLive")]
    pub default_message_time_to_live: String,
    #[serde(rename = "requiresDuplicateDetection")]
    pub requires_duplicate_detection: bool,
    #[serde(rename = "enablePartitioning")]
    pub enable_partitioning: bool,
    #[serde(rename = "enableBatchedOperations")]
    pub enable_batched_operations: bool,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    #[serde(rename = "accessedAt")]
    pub accessed_at: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SubscriptionProperties {
    #[serde(rename = "subscriptionName")]
    pub subscription_name: String,
    #[serde(rename = "topicName")]
    pub topic_name: String,
    #[serde(rename = "activeMessageCount")]
    pub active_message_count: i64,
    #[serde(rename = "deadLetterMessageCount")]
    pub dead_letter_message_count: i64,
    pub status: String,
    #[serde(rename = "maxDeliveryCount")]
    pub max_delivery_count: i64,
    #[serde(rename = "lockDuration")]
    pub lock_duration: String,
    #[serde(rename = "defaultMessageTimeToLive")]
    pub default_message_time_to_live: String,
    #[serde(rename = "requiresSession")]
    pub requires_session: bool,
    #[serde(rename = "deadLetteringOnMessageExpiration")]
    pub dead_lettering_on_message_expiration: bool,
    #[serde(rename = "enableBatchedOperations")]
    pub enable_batched_operations: bool,
    #[serde(rename = "autoDeleteOnIdle")]
    pub auto_delete_on_idle: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    #[serde(rename = "accessedAt")]
    pub accessed_at: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ServiceBusMessage {
    #[serde(rename = "messageId")]
    pub message_id: String,
    pub body: String,
    #[serde(rename = "contentType")]
    pub content_type: Option<String>,
    #[serde(rename = "correlationId")]
    pub correlation_id: Option<String>,
    pub subject: Option<String>,
    #[serde(rename = "enqueuedTime")]
    pub enqueued_time: Option<String>,
    #[serde(rename = "sequenceNumber")]
    pub sequence_number: Option<i64>,
    #[serde(rename = "deliveryCount")]
    pub delivery_count: Option<i32>,
}

pub struct ServiceBusState {
    pub connection: Mutex<Option<ConnectionInfo>>,
    pub client: reqwest::Client,
}

impl ServiceBusState {
    pub fn new() -> Self {
        Self {
            connection: Mutex::new(None),
            client: reqwest::Client::new(),
        }
    }
}

fn parse_connection_string(conn_str: &str) -> Result<ConnectionInfo, String> {
    let mut params: HashMap<String, String> = HashMap::new();

    for part in conn_str.split(';') {
        if let Some(idx) = part.find('=') {
            let key = part[..idx].trim().to_string();
            let value = part[idx + 1..].trim().to_string();
            params.insert(key, value);
        }
    }

    let endpoint = params.get("Endpoint")
        .ok_or("Missing Endpoint")?
        .replace("sb://", "https://")
        .trim_end_matches('/')
        .to_string();

    let key_name = params.get("SharedAccessKeyName")
        .ok_or("Missing SharedAccessKeyName")?
        .clone();

    let key = params.get("SharedAccessKey")
        .ok_or("Missing SharedAccessKey")?
        .clone();

    Ok(ConnectionInfo { endpoint, key_name, key })
}

fn create_sas_token(resource_uri: &str, key_name: &str, key: &str, expiry_seconds: i64) -> Result<String, String> {
    let uri_lowercase = resource_uri.to_lowercase();
    let expiry = Utc::now().timestamp() + expiry_seconds;

    let encoded_uri = urlencoding::encode(&uri_lowercase);
    let string_to_sign = format!("{}\n{}", encoded_uri, expiry);

    let key_bytes = key.as_bytes();

    let mut mac = HmacSha256::new_from_slice(key_bytes)
        .map_err(|e| format!("Failed to create HMAC: {}", e))?;
    mac.update(string_to_sign.as_bytes());
    let signature = mac.finalize().into_bytes();

    let signature_b64 = STANDARD.encode(&signature);
    let encoded_sig = urlencoding::encode(&signature_b64);

    Ok(format!(
        "SharedAccessSignature sr={}&sig={}&se={}&skn={}",
        encoded_uri,
        encoded_sig,
        expiry,
        key_name
    ))
}

fn extract_xml_value(xml: &str, tag: &str) -> Option<String> {
    let open_tag = format!("<{}", tag);
    let close_tag = format!("</{}>", tag);

    if let Some(start_idx) = xml.find(&open_tag) {
        let after_tag = &xml[start_idx..];
        if let Some(content_start) = after_tag.find('>') {
            let content_part = &after_tag[content_start + 1..];
            if let Some(end_idx) = content_part.find(&close_tag) {
                return Some(content_part[..end_idx].to_string());
            }
        }
    }

    let search_pattern = format!(":{}", tag);
    let mut search_start = 0;

    while let Some(pos) = xml[search_start..].find(&search_pattern) {
        let absolute_pos = search_start + pos;

        if let Some(rel_open) = xml[..absolute_pos].rfind('<') {
            let prefix_part = &xml[rel_open + 1..absolute_pos];

            if !prefix_part.contains(' ') && !prefix_part.contains('>') && !prefix_part.contains('/') {
                let tag_start = &xml[rel_open..];
                if let Some(tag_content_start) = tag_start.find('>') {
                    let content_start = rel_open + tag_content_start + 1;
                    let close_tag = format!("</{}:{}>", prefix_part, tag);

                    if let Some(close_pos) = xml[content_start..].find(&close_tag) {
                        let value = &xml[content_start..content_start + close_pos];
                        return Some(value.to_string());
                    }
                }
            }
        }

        search_start = absolute_pos + 1;
    }

    None
}

fn extract_xml_number(xml: &str, tag: &str) -> i64 {
    extract_xml_value(xml, tag)
        .and_then(|s| s.parse().ok())
        .unwrap_or(0)
}

fn extract_xml_bool(xml: &str, tag: &str) -> bool {
    extract_xml_value(xml, tag)
        .map(|s| s.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

fn get_connection_info(state: &tauri::State<'_, ServiceBusState>) -> Result<ConnectionInfo, String> {
    let conn = state.connection.lock()
        .map_err(|_| "Internal error: connection state corrupted".to_string())?;
    conn.clone().ok_or_else(|| "Not connected".to_string())
}

fn parse_queue_properties(entry: &str, name: String) -> QueueProperties {
    QueueProperties {
        name,
        active_message_count: extract_xml_number(entry, "ActiveMessageCount"),
        dead_letter_message_count: extract_xml_number(entry, "DeadLetterMessageCount"),
        scheduled_message_count: extract_xml_number(entry, "ScheduledMessageCount"),
        size_in_bytes: extract_xml_number(entry, "SizeInBytes"),
        max_size_in_megabytes: extract_xml_number(entry, "MaxSizeInMegabytes"),
        status: extract_xml_value(entry, "Status").unwrap_or_else(|| "Active".to_string()),
        max_delivery_count: extract_xml_number(entry, "MaxDeliveryCount"),
        lock_duration: extract_xml_value(entry, "LockDuration").unwrap_or_default(),
        default_message_time_to_live: extract_xml_value(entry, "DefaultMessageTimeToLive").unwrap_or_default(),
        requires_duplicate_detection: extract_xml_bool(entry, "RequiresDuplicateDetection"),
        requires_session: extract_xml_bool(entry, "RequiresSession"),
        dead_lettering_on_message_expiration: extract_xml_bool(entry, "DeadLetteringOnMessageExpiration"),
        enable_partitioning: extract_xml_bool(entry, "EnablePartitioning"),
        enable_batched_operations: extract_xml_bool(entry, "EnableBatchedOperations"),
        created_at: extract_xml_value(entry, "CreatedAt").unwrap_or_default(),
        updated_at: extract_xml_value(entry, "UpdatedAt").unwrap_or_default(),
        accessed_at: extract_xml_value(entry, "AccessedAt").unwrap_or_default(),
    }
}

fn parse_topic_properties(entry: &str, name: String) -> TopicProperties {
    TopicProperties {
        name,
        size_in_bytes: extract_xml_number(entry, "SizeInBytes"),
        max_size_in_megabytes: extract_xml_number(entry, "MaxSizeInMegabytes"),
        subscription_count: extract_xml_number(entry, "SubscriptionCount"),
        status: extract_xml_value(entry, "Status").unwrap_or_else(|| "Active".to_string()),
        default_message_time_to_live: extract_xml_value(entry, "DefaultMessageTimeToLive").unwrap_or_default(),
        requires_duplicate_detection: extract_xml_bool(entry, "RequiresDuplicateDetection"),
        enable_partitioning: extract_xml_bool(entry, "EnablePartitioning"),
        enable_batched_operations: extract_xml_bool(entry, "EnableBatchedOperations"),
        created_at: extract_xml_value(entry, "CreatedAt").unwrap_or_default(),
        updated_at: extract_xml_value(entry, "UpdatedAt").unwrap_or_default(),
        accessed_at: extract_xml_value(entry, "AccessedAt").unwrap_or_default(),
    }
}

fn parse_subscription_properties(entry: &str, name: String, topic_name: String) -> SubscriptionProperties {
    SubscriptionProperties {
        subscription_name: name,
        topic_name,
        active_message_count: extract_xml_number(entry, "ActiveMessageCount"),
        dead_letter_message_count: extract_xml_number(entry, "DeadLetterMessageCount"),
        status: extract_xml_value(entry, "Status").unwrap_or_else(|| "Active".to_string()),
        max_delivery_count: extract_xml_number(entry, "MaxDeliveryCount"),
        lock_duration: extract_xml_value(entry, "LockDuration").unwrap_or_default(),
        default_message_time_to_live: extract_xml_value(entry, "DefaultMessageTimeToLive").unwrap_or_default(),
        requires_session: extract_xml_bool(entry, "RequiresSession"),
        dead_lettering_on_message_expiration: extract_xml_bool(entry, "DeadLetteringOnMessageExpiration"),
        enable_batched_operations: extract_xml_bool(entry, "EnableBatchedOperations"),
        auto_delete_on_idle: extract_xml_value(entry, "AutoDeleteOnIdle").unwrap_or_default(),
        created_at: extract_xml_value(entry, "CreatedAt").unwrap_or_default(),
        updated_at: extract_xml_value(entry, "UpdatedAt").unwrap_or_default(),
        accessed_at: extract_xml_value(entry, "AccessedAt").unwrap_or_default(),
    }
}

fn parse_xml_entries(xml: &str) -> Vec<String> {
    xml.split("<entry")
        .skip(1)
        .filter_map(|s| s.split("</entry>").next())
        .map(|s| s.to_string())
        .collect()
}

async fn peek_messages_impl(
    client: &reqwest::Client,
    path: &str,
    max_count: i32,
    info: &ConnectionInfo,
) -> Result<Vec<ServiceBusMessage>, String> {
    let token = create_sas_token(&info.endpoint, &info.key_name, &info.key, 3600)?;

    let mut messages = Vec::new();
    let mut lock_uris = Vec::new();
    let count = max_count.min(50);

    for i in 0..count {
        let response = client
            .post(path)
            .header("Authorization", &token)
            .header("Content-Length", "0")
            .query(&[("api-version", "2017-04"), ("timeout", "1")])
            .body("")
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if response.status().as_u16() == 204 || response.status().as_u16() == 404 {
            break;
        }

        if !response.status().is_success() {
            break;
        }

        // Collect lock URI to abandon after the loop
        if let Some(uri) = response.headers()
            .get("Location")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string())
        {
            lock_uris.push(uri);
        }

        let broker_props = response.headers()
            .get("BrokerProperties")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        let content_type = response.headers()
            .get("Content-Type")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        let body = response.text().await.unwrap_or_default();

        let mut message = ServiceBusMessage {
            message_id: format!("msg-{}", i),
            body,
            content_type,
            correlation_id: None,
            subject: None,
            enqueued_time: None,
            sequence_number: None,
            delivery_count: None,
        };

        if let Some(props) = broker_props {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&props) {
                if let Some(id) = json.get("MessageId").and_then(|v| v.as_str()) {
                    message.message_id = id.to_string();
                }
                if let Some(corr) = json.get("CorrelationId").and_then(|v| v.as_str()) {
                    message.correlation_id = Some(corr.to_string());
                }
                if let Some(label) = json.get("Label").and_then(|v| v.as_str()) {
                    message.subject = Some(label.to_string());
                }
                if let Some(time) = json.get("EnqueuedTimeUtc").and_then(|v| v.as_str()) {
                    message.enqueued_time = Some(time.to_string());
                }
                if let Some(seq) = json.get("SequenceNumber").and_then(|v| v.as_i64()) {
                    message.sequence_number = Some(seq);
                }
                if let Some(dc) = json.get("DeliveryCount").and_then(|v| v.as_i64()) {
                    message.delivery_count = Some(dc as i32);
                }
            }
        }

        messages.push(message);
    }

    // Abandon all peek-locks so messages stay in the queue
    for uri in &lock_uris {
        let _ = client
            .put(uri)
            .header("Authorization", &token)
            .header("Content-Length", "0")
            .body("")
            .send()
            .await;
    }

    Ok(messages)
}

async fn delete_message_impl(
    client: &reqwest::Client,
    path: &str,
    info: &ConnectionInfo,
) -> Result<(), String> {
    let token = create_sas_token(&info.endpoint, &info.key_name, &info.key, 3600)?;

    let response = client
        .delete(path)
        .header("Authorization", &token)
        .query(&[("api-version", "2017-04"), ("timeout", "60")])
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if response.status().as_u16() == 204 {
        return Ok(());
    }

    if response.status().as_u16() == 404 {
        return Err("Entity not found".to_string());
    }

    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Failed to delete message: {}", text));
    }

    Ok(())
}

async fn resubmit_message_impl(
    client: &reqwest::Client,
    dlq_path: &str,
    send_path: &str,
    info: &ConnectionInfo,
) -> Result<(), String> {
    let token = create_sas_token(&info.endpoint, &info.key_name, &info.key, 3600)?;

    let response = client
        .delete(dlq_path)
        .header("Authorization", &token)
        .query(&[("api-version", "2017-04"), ("timeout", "5")])
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if response.status().as_u16() == 204 || response.status().as_u16() == 404 {
        return Err("No messages in dead letter queue".to_string());
    }

    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Failed to receive message: {}", text));
    }

    let broker_props = response.headers()
        .get("BrokerProperties")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let content_type = response.headers()
        .get("Content-Type")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "application/json".to_string());

    let body = response.text().await.unwrap_or_default();

    let token2 = create_sas_token(&info.endpoint, &info.key_name, &info.key, 3600)?;

    let mut request = client
        .post(send_path)
        .header("Authorization", &token2)
        .header("Content-Type", &content_type)
        .body(body);

    if let Some(props) = broker_props {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&props) {
            let mut new_props = serde_json::Map::new();
            if let Some(corr) = json.get("CorrelationId").and_then(|v| v.as_str()) {
                new_props.insert("CorrelationId".to_string(), serde_json::Value::String(corr.to_string()));
            }
            if let Some(label) = json.get("Label").and_then(|v| v.as_str()) {
                new_props.insert("Label".to_string(), serde_json::Value::String(label.to_string()));
            }
            if !new_props.is_empty() {
                if let Ok(json_str) = serde_json::to_string(&new_props) {
                    request = request.header("BrokerProperties", json_str);
                }
            }
        }
    }

    let send_response = request.send().await.map_err(|e| format!("Failed to resubmit: {}", e))?;

    if !send_response.status().is_success() {
        let text = send_response.text().await.unwrap_or_default();
        return Err(format!("Failed to resubmit message: {}", text));
    }

    Ok(())
}

#[tauri::command]
pub async fn sb_connect(
    state: tauri::State<'_, ServiceBusState>,
    connection_string: String,
) -> Result<(), String> {
    let info = parse_connection_string(&connection_string)?;

    let url = format!("{}/$Resources/Queues?api-version=2017-04", info.endpoint);
    let token = create_sas_token(&info.endpoint, &info.key_name, &info.key, 3600)?;

    let response = state.client
        .get(&url)
        .header("Authorization", &token)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Connection failed: {}", text));
    }

    let mut conn = state.connection.lock()
        .map_err(|_| "Internal error: connection state corrupted".to_string())?;
    *conn = Some(info);

    Ok(())
}

#[tauri::command]
pub fn sb_disconnect(state: tauri::State<'_, ServiceBusState>) -> Result<(), String> {
    let mut conn = state.connection.lock()
        .map_err(|_| "Internal error: connection state corrupted".to_string())?;
    *conn = None;
    Ok(())
}

#[tauri::command]
pub async fn sb_list_queues(
    state: tauri::State<'_, ServiceBusState>,
) -> Result<Vec<QueueProperties>, String> {
    let info = get_connection_info(&state)?;

    let url = format!("{}/$Resources/Queues?api-version=2017-04", info.endpoint);
    let token = create_sas_token(&info.endpoint, &info.key_name, &info.key, 3600)?;

    let response = state.client
        .get(&url)
        .header("Authorization", &token)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Failed to list queues: {}", text));
    }

    let xml = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;

    let mut queues = Vec::new();
    for entry in parse_xml_entries(&xml) {
        if let Some(name) = extract_xml_value(&entry, "title") {
            if !name.is_empty() {
                queues.push(parse_queue_properties(&entry, name));
            }
        }
    }

    Ok(queues)
}

#[tauri::command]
pub async fn sb_list_topics(
    state: tauri::State<'_, ServiceBusState>,
) -> Result<Vec<TopicProperties>, String> {
    let info = get_connection_info(&state)?;

    let url = format!("{}/$Resources/Topics?api-version=2017-04", info.endpoint);
    let token = create_sas_token(&info.endpoint, &info.key_name, &info.key, 3600)?;

    let response = state.client
        .get(&url)
        .header("Authorization", &token)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Failed to list topics: {}", text));
    }

    let xml = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;

    let mut topics = Vec::new();
    for entry in parse_xml_entries(&xml) {
        if let Some(name) = extract_xml_value(&entry, "title") {
            if !name.is_empty() {
                topics.push(parse_topic_properties(&entry, name));
            }
        }
    }

    Ok(topics)
}

#[tauri::command]
pub async fn sb_list_subscriptions(
    state: tauri::State<'_, ServiceBusState>,
    topic_name: String,
) -> Result<Vec<SubscriptionProperties>, String> {
    let info = get_connection_info(&state)?;

    let encoded_topic = urlencoding::encode(&topic_name);
    let url = format!("{}/{}/Subscriptions?api-version=2017-04", info.endpoint, encoded_topic);
    let token = create_sas_token(&info.endpoint, &info.key_name, &info.key, 3600)?;

    let response = state.client
        .get(&url)
        .header("Authorization", &token)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Failed to list subscriptions: {}", text));
    }

    let xml = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;

    let mut subscriptions = Vec::new();
    for entry in parse_xml_entries(&xml) {
        if let Some(name) = extract_xml_value(&entry, "title") {
            if !name.is_empty() {
                subscriptions.push(parse_subscription_properties(&entry, name, topic_name.clone()));
            }
        }
    }

    Ok(subscriptions)
}

#[tauri::command]
pub async fn sb_get_queue(
    state: tauri::State<'_, ServiceBusState>,
    queue_name: String,
) -> Result<QueueProperties, String> {
    let info = get_connection_info(&state)?;

    let encoded_name = urlencoding::encode(&queue_name);
    let url = format!("{}/{}?api-version=2017-04", info.endpoint, encoded_name);
    let token = create_sas_token(&info.endpoint, &info.key_name, &info.key, 3600)?;

    let response = state.client
        .get(&url)
        .header("Authorization", &token)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Failed to get queue '{}': {}", queue_name, text));
    }

    let xml = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;

    Ok(parse_queue_properties(&xml, queue_name))
}

#[tauri::command]
pub async fn sb_delete_queue(
    state: tauri::State<'_, ServiceBusState>,
    queue_name: String,
) -> Result<(), String> {
    let info = get_connection_info(&state)?;

    let encoded_name = urlencoding::encode(&queue_name);
    let url = format!("{}/{}?api-version=2017-04", info.endpoint, encoded_name);
    let token = create_sas_token(&info.endpoint, &info.key_name, &info.key, 3600)?;

    let response = state.client
        .delete(&url)
        .header("Authorization", &token)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Failed to delete queue '{}': {}", queue_name, text));
    }

    Ok(())
}

#[tauri::command]
pub async fn sb_delete_topic(
    state: tauri::State<'_, ServiceBusState>,
    topic_name: String,
) -> Result<(), String> {
    let info = get_connection_info(&state)?;

    let encoded_name = urlencoding::encode(&topic_name);
    let url = format!("{}/{}?api-version=2017-04", info.endpoint, encoded_name);
    let token = create_sas_token(&info.endpoint, &info.key_name, &info.key, 3600)?;

    let response = state.client
        .delete(&url)
        .header("Authorization", &token)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Failed to delete topic '{}': {}", topic_name, text));
    }

    Ok(())
}

#[tauri::command]
pub async fn sb_delete_subscription(
    state: tauri::State<'_, ServiceBusState>,
    topic_name: String,
    subscription_name: String,
) -> Result<(), String> {
    let info = get_connection_info(&state)?;

    let encoded_topic = urlencoding::encode(&topic_name);
    let encoded_sub = urlencoding::encode(&subscription_name);
    let url = format!("{}/{}/Subscriptions/{}?api-version=2017-04", info.endpoint, encoded_topic, encoded_sub);
    let token = create_sas_token(&info.endpoint, &info.key_name, &info.key, 3600)?;

    let response = state.client
        .delete(&url)
        .header("Authorization", &token)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Failed to delete subscription '{}/{}': {}", topic_name, subscription_name, text));
    }

    Ok(())
}

#[tauri::command]
pub async fn sb_get_topic(
    state: tauri::State<'_, ServiceBusState>,
    topic_name: String,
) -> Result<TopicProperties, String> {
    let info = get_connection_info(&state)?;

    let encoded_name = urlencoding::encode(&topic_name);
    let url = format!("{}/{}?api-version=2017-04", info.endpoint, encoded_name);
    let token = create_sas_token(&info.endpoint, &info.key_name, &info.key, 3600)?;

    let response = state.client
        .get(&url)
        .header("Authorization", &token)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Failed to get topic '{}': {}", topic_name, text));
    }

    let xml = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;

    Ok(parse_topic_properties(&xml, topic_name))
}

#[tauri::command]
pub async fn sb_peek_queue_messages(
    state: tauri::State<'_, ServiceBusState>,
    queue_name: String,
    max_count: i32,
    from_dead_letter: bool,
) -> Result<Vec<ServiceBusMessage>, String> {
    let info = get_connection_info(&state)?;

    let encoded_name = urlencoding::encode(&queue_name);
    let path = if from_dead_letter {
        format!("{}/{}/$deadletterqueue/messages/head", info.endpoint, encoded_name)
    } else {
        format!("{}/{}/messages/head", info.endpoint, encoded_name)
    };

    peek_messages_impl(&state.client, &path, max_count, &info).await
}

#[tauri::command]
pub async fn sb_peek_subscription_messages(
    state: tauri::State<'_, ServiceBusState>,
    topic_name: String,
    subscription_name: String,
    max_count: i32,
    from_dead_letter: bool,
) -> Result<Vec<ServiceBusMessage>, String> {
    let info = get_connection_info(&state)?;

    let encoded_topic = urlencoding::encode(&topic_name);
    let encoded_sub = urlencoding::encode(&subscription_name);
    let path = if from_dead_letter {
        format!("{}/{}/Subscriptions/{}/$deadletterqueue/messages/head", info.endpoint, encoded_topic, encoded_sub)
    } else {
        format!("{}/{}/Subscriptions/{}/messages/head", info.endpoint, encoded_topic, encoded_sub)
    };

    peek_messages_impl(&state.client, &path, max_count, &info).await
}

#[tauri::command]
pub async fn sb_send_message(
    state: tauri::State<'_, ServiceBusState>,
    entity_path: String,
    body: String,
    content_type: Option<String>,
    correlation_id: Option<String>,
    subject: Option<String>,
) -> Result<(), String> {
    let info = get_connection_info(&state)?;

    let encoded_path = urlencoding::encode(&entity_path);
    let url = format!("{}/{}/messages?api-version=2017-04", info.endpoint, encoded_path);
    let token = create_sas_token(&info.endpoint, &info.key_name, &info.key, 3600)?;

    let mut broker_props = serde_json::Map::new();
    if let Some(corr) = correlation_id {
        broker_props.insert("CorrelationId".to_string(), serde_json::Value::String(corr));
    }
    if let Some(subj) = subject {
        broker_props.insert("Label".to_string(), serde_json::Value::String(subj));
    }

    let mut request = state.client
        .post(&url)
        .header("Authorization", &token)
        .header("Content-Type", content_type.unwrap_or_else(|| "application/json".to_string()))
        .body(body);

    if !broker_props.is_empty() {
        if let Ok(json_str) = serde_json::to_string(&broker_props) {
            request = request.header("BrokerProperties", json_str);
        }
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Failed to send message: {}", text));
    }

    Ok(())
}

#[tauri::command]
pub async fn sb_delete_queue_message(
    state: tauri::State<'_, ServiceBusState>,
    queue_name: String,
    from_dead_letter: bool,
) -> Result<(), String> {
    let info = get_connection_info(&state)?;

    let encoded_name = urlencoding::encode(&queue_name);
    let path = if from_dead_letter {
        format!("{}/{}/$deadletterqueue/messages/head", info.endpoint, encoded_name)
    } else {
        format!("{}/{}/messages/head", info.endpoint, encoded_name)
    };

    delete_message_impl(&state.client, &path, &info).await
}

#[tauri::command]
pub async fn sb_delete_subscription_message(
    state: tauri::State<'_, ServiceBusState>,
    topic_name: String,
    subscription_name: String,
    from_dead_letter: bool,
) -> Result<(), String> {
    let info = get_connection_info(&state)?;

    let encoded_topic = urlencoding::encode(&topic_name);
    let encoded_sub = urlencoding::encode(&subscription_name);
    let path = if from_dead_letter {
        format!("{}/{}/Subscriptions/{}/$deadletterqueue/messages/head", info.endpoint, encoded_topic, encoded_sub)
    } else {
        format!("{}/{}/Subscriptions/{}/messages/head", info.endpoint, encoded_topic, encoded_sub)
    };

    delete_message_impl(&state.client, &path, &info).await
}

#[tauri::command]
pub async fn sb_resubmit_queue_message(
    state: tauri::State<'_, ServiceBusState>,
    queue_name: String,
) -> Result<(), String> {
    let info = get_connection_info(&state)?;

    let encoded_name = urlencoding::encode(&queue_name);
    let dlq_path = format!("{}/{}/$deadletterqueue/messages/head", info.endpoint, encoded_name);
    let send_path = format!("{}/{}/messages?api-version=2017-04", info.endpoint, encoded_name);

    resubmit_message_impl(&state.client, &dlq_path, &send_path, &info).await
}

#[tauri::command]
pub async fn sb_resubmit_subscription_message(
    state: tauri::State<'_, ServiceBusState>,
    topic_name: String,
    subscription_name: String,
) -> Result<(), String> {
    let info = get_connection_info(&state)?;

    let encoded_topic = urlencoding::encode(&topic_name);
    let encoded_sub = urlencoding::encode(&subscription_name);
    let dlq_path = format!("{}/{}/Subscriptions/{}/$deadletterqueue/messages/head", info.endpoint, encoded_topic, encoded_sub);
    let send_path = format!("{}/{}/messages?api-version=2017-04", info.endpoint, encoded_topic);

    resubmit_message_impl(&state.client, &dlq_path, &send_path, &info).await
}
