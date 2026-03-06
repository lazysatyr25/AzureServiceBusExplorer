mod servicebus;

use servicebus::ServiceBusState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(ServiceBusState::new())
        .invoke_handler(tauri::generate_handler![
            servicebus::sb_connect,
            servicebus::sb_disconnect,
            servicebus::sb_list_queues,
            servicebus::sb_list_topics,
            servicebus::sb_list_subscriptions,
            servicebus::sb_get_queue,
            servicebus::sb_get_topic,
            servicebus::sb_delete_queue,
            servicebus::sb_delete_topic,
            servicebus::sb_delete_subscription,
            servicebus::sb_peek_queue_messages,
            servicebus::sb_peek_subscription_messages,
            servicebus::sb_send_message,
            servicebus::sb_delete_queue_message,
            servicebus::sb_delete_subscription_message,
            servicebus::sb_resubmit_queue_message,
            servicebus::sb_resubmit_subscription_message,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
