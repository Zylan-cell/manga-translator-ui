pub mod folder;
pub mod fonts;
pub mod project;

use serde::Serialize;

#[derive(Serialize)]
pub struct ImageInfo {
    pub name: String,
    pub path: String,
    pub data_url: String,
    pub thumbnail: String,
}

// Импортируем и реэкспортируем основные команды
use serde_json::Value;
use tauri::Emitter;
use base64::{engine::general_purpose::STANDARD, Engine as _};

pub async fn handle_response(response: reqwest::Response) -> Result<Value, String> {
    let status = response.status();
    if status.is_success() {
        response
            .json::<Value>()
            .await
            .map_err(|e| format!("Failed to parse JSON response: {}", e))
    } else {
        let error_body = response
            .text()
            .await
            .map_err(|e| format!("Failed to read error body: {}", e))?;
        Err(format!("API Error: Status {}, Body: {}", status, error_body))
    }
}

#[tauri::command]
pub async fn fetch_models(api_url: String) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let response = client.get(&api_url).send().await.map_err(|e| e.to_string())?;
    handle_response(response).await
}

#[tauri::command]
pub async fn detect_text_areas(api_url: String, image_data: String) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/detect_text_areas", api_url.trim_end_matches('/'));
    let payload = serde_json::json!({ "image_data": image_data });
    let response = client.post(&url).json(&payload).send().await.map_err(|e| e.to_string())?;
    handle_response(response).await
}

#[tauri::command]
pub async fn detect_panels(api_url: String, image_data: String) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/detect_panels", api_url.trim_end_matches('/'));
    let payload = serde_json::json!({ "image_data": image_data });
    let response = client.post(&url).json(&payload).send().await.map_err(|e| e.to_string())?;
    handle_response(response).await
}

#[tauri::command]
pub async fn recognize_images_batch(
    api_url: String,
    images_data: Vec<String>,
    engine: Option<String>,
    langs: Option<Vec<String>>,
    auto_rotate: Option<bool>,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/recognize_images_batch", api_url.trim_end_matches('/'));
    let payload = serde_json::json!({
        "images_data": images_data,
        "engine": engine.unwrap_or_else(|| "manga".to_string()),
        "langs": langs,
        "auto_rotate": auto_rotate.unwrap_or(true),
    });
    let response = client
        .post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let status = response.status();
    if status.is_success() {
        response
            .json::<serde_json::Value>()
            .await
            .map_err(|e| format!("Failed to parse JSON response: {}", e))
    } else {
        let error_body = response
            .text()
            .await
            .map_err(|e| format!("Failed to read error body: {}", e))?;
        Err(format!("API Error: Status {}, Body: {}", status, error_body))
    }
}

#[tauri::command]
pub async fn translate_text(api_url: String, payload: Value) -> Result<Value, String> {
    if let Some(messages) = payload.get("messages").and_then(|m| m.as_array()) {
        if let Some(last_message) = messages.last() {
            if let Some(content) = last_message.get("content").and_then(|c| c.as_str()) {
                println!("\n--- Sending to LLM ---\n{}\n----------------------", content);
            }
        }
    }

    let client = reqwest::Client::new();
    let response = client.post(&api_url).json(&payload).send().await.map_err(|e| e.to_string())?;

    let status = response.status();
    if status.is_success() {
        let body_text = response.text().await.map_err(|e| format!("Failed to read response body: {}", e))?;
        println!("\n--- Received from LLM ---\n{}\n-------------------------", body_text);
        let json_value: Value = serde_json::from_str(&body_text).map_err(|e| format!("Failed to parse JSON from response: {}", e))?;
        Ok(json_value)
    } else {
        let error_body = response.text().await.map_err(|e| format!("Failed to read error body: {}", e))?;
        Err(format!("API Error: Status {}, Body: {}", status, error_body))
    }
}

#[tauri::command]
pub async fn translate_text_stream(window: tauri::Window, api_url: String, payload: Value, stream_id: String) -> Result<(), String> {
    if let Some(messages) = payload.get("messages").and_then(|m| m.as_array()) {
        if let Some(last_message) = messages.last() {
            if let Some(content) = last_message.get("content").and_then(|c| c.as_str()) {
                println!("\n--- Sending to LLM (Stream) ---\n{}\n-----------------------------", content);
            }
        }
    }

    let client = reqwest::Client::new();
    let mut response = client.post(&api_url).json(&payload).send().await.map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("API Error: Status {}, Body: {}", status, text));
    }

    while let Ok(Some(chunk)) = response.chunk().await {
        let s = String::from_utf8_lossy(&chunk);
        for line in s.split('\n') {
            let line = line.trim();
            if line.is_empty() { continue; }
            if line.starts_with("data: ") {
                let data = &line[6..];
                if data == "[DONE]" {
                    let _ = window.emit("llm-stream", serde_json::json!({ "id": stream_id, "done": true }));
                    continue;
                }
                if let Ok(val) = serde_json::from_str::<Value>(data) {
                    if let Some(choices) = val.get("choices").and_then(|v| v.as_array()) {
                        for c in choices {
                            if let Some(delta) = c.get("delta").and_then(|d| d.get("content")) {
                                let _ = window.emit("llm-stream", serde_json::json!({ "id": stream_id, "delta": delta, "done": false }));
                            }
                        }
                    }
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn translate_deeplx(
    api_url: String,
    api_key: Option<String>,
    texts: Vec<String>,
    target_lang: String,
    source_lang: Option<String>
) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let text_payload = texts.join("\n");

    let mut payload = serde_json::json!({
        "text": text_payload,
        "target_lang": target_lang
    });
    if let Some(lang) = source_lang {
        payload["source_lang"] = serde_json::json!(lang);
    }

    let mut builder = client.post(&api_url).json(&payload);
    if let Some(key) = api_key {
        if !key.is_empty() {
            builder = builder.bearer_auth(key);
        }
    }

    let response = builder.send().await.map_err(|e| e.to_string())?;
    handle_response(response).await
}

#[tauri::command]
pub async fn inpaint_image(api_url: String, image_data: String, mask_data: String) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/inpaint", api_url.trim_end_matches('/'));
    let payload = serde_json::json!({ "image_data": image_data, "mask_data": mask_data });
    let response = client.post(&url).json(&payload).send().await.map_err(|e| e.to_string())?;
    handle_response(response).await
}

#[tauri::command]
pub async fn inpaint_text_auto(api_url: String, image_data: String, boxes: Option<Vec<Vec<i32>>>, dilate: Option<i32>) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/inpaint_auto_text", api_url.trim_end_matches('/'));
    let payload = serde_json::json!({ "image_data": image_data, "boxes": boxes, "dilate": dilate.unwrap_or(2) });
    let response = client.post(&url).json(&payload).send().await.map_err(|e| e.to_string())?;
    handle_response(response).await
}

#[tauri::command]
pub async fn fetch_image(url: String) -> Result<String, String> {
    let resp = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    Ok(STANDARD.encode(bytes))
}

#[tauri::command]
pub async fn read_file_b64(path: String) -> Result<String, String> {
    use std::fs;
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    Ok(STANDARD.encode(bytes))
}