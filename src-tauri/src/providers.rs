//! Provider credentials never return to the renderer. Windows DPAPI protects storage.
use std::{collections::BTreeMap, sync::Mutex, time::Duration, io::Write};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tauri::{Manager, WebviewWindow};
static STORE_LOCK: Mutex<()> = Mutex::new(());
#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Config { api_key: String, account_id: String, #[serde(default)] revision: String }
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct Metadata { provider: String, configured: bool, account_id: String, revision: String }
fn registry_entry(provider:&str)->Result<Value,String>{
 let entries:Vec<Value>=serde_json::from_str(include_str!("../../src/core/providers/catalog.json")).map_err(|_|"Invalid bundled catalog")?;
 entries.into_iter().find(|v|v["id"]==provider).ok_or("Unknown provider".into())
}
fn supported(provider:&str)->Result<(),String>{registry_entry(provider).map(|_|())}
#[tauri::command]
pub fn open_provider_dashboard(window:WebviewWindow,provider:String)->Result<(),String>{
 crate::terminal::trusted(&window)?;use tauri_plugin_opener::OpenerExt;
 let entry=registry_entry(&provider)?;let url=entry["dashboard"].as_str().ok_or("No official dashboard configured")?;
 window.app_handle().opener().open_url(url,None::<&str>).map_err(|_|"Could not open the default browser".into())
}
#[tauri::command]
pub async fn provider_catalog(window:WebviewWindow,provider:String)->Result<Value,String>{
 crate::terminal::trusted(&window)?;let entry=registry_entry(&provider)?;
 let config={let _guard=STORE_LOCK.lock().map_err(|_|"Credential store busy")?;load(&location(&window)?)?.get(&provider).cloned().ok_or("Save provider configuration first")?};
 let url=entry["modelsEndpoint"].as_str().ok_or("Live model discovery is unavailable for this provider; consult its official dashboard.")?;
 let client=reqwest::Client::builder().timeout(Duration::from_secs(20)).redirect(reqwest::redirect::Policy::none()).no_proxy().build().map_err(|_|"Catalog transport unavailable")?;
 let mut request=client.get(url);
 if provider=="gemini"||provider=="anthropic" {request=request.header(if provider=="gemini"{"x-goog-api-key"}else{"x-api-key"},config.api_key);if provider=="anthropic"{request=request.header("anthropic-version","2023-06-01");}}
 else if provider!="ollama" {request=request.bearer_auth(config.api_key);}
 let mut response=request.send().await.map_err(|_|"Model discovery connection failed")?;
 if !response.status().is_success(){return Err(format!("Model discovery HTTP {}. Check key, permissions and endpoint availability.",response.status().as_u16()));}
 let mut bytes=Vec::new();while let Some(chunk)=response.chunk().await.map_err(|_|"Model catalog interrupted")?{if bytes.len()+chunk.len()>4_000_000{return Err("Model catalog exceeds size limit".into());}bytes.extend_from_slice(&chunk);}
 let value:Value=serde_json::from_slice(&bytes).map_err(|_|"Invalid model catalog")?;
 let rows=value.as_array().or_else(||value["data"].as_array()).or_else(||value["models"].as_array()).or_else(||value["results"].as_array()).ok_or("Unrecognized model catalog format")?;
 let models:Vec<Value>=rows.iter().take(500).filter_map(|m|{let id=m["id"].as_str().or_else(||m["name"].as_str())?;let prompt=m["pricing"]["prompt"].as_str().and_then(|s|s.parse::<f64>().ok());let completion=m["pricing"]["completion"].as_str().and_then(|s|s.parse::<f64>().ok());let pricing=if provider=="ollama"{"free"}else if prompt==Some(0.0)&&completion==Some(0.0){"free"}else if prompt.is_some()&&completion.is_some(){"paid"}else{"unknown"};Some(json!({"id":id,"pricing":pricing}))}).collect();
 Ok(json!({"models":models,"tags":entry["tags"],"partial":rows.len()>500||value["has_more"]==true||value["next"].is_string()||value["nextPageToken"].is_string(),"catalogOnly":entry["catalogOnly"]}))
}
#[cfg(windows)]
pub(crate) fn protect(bytes: &[u8], encrypt: bool) -> Result<Vec<u8>, String> {
    use windows_sys::Win32::{Security::Cryptography::*, Foundation::LocalFree};
    let input = CRYPT_INTEGER_BLOB { cbData: bytes.len() as u32, pbData: bytes.as_ptr() as *mut u8 };
    let mut output = CRYPT_INTEGER_BLOB { cbData: 0, pbData: std::ptr::null_mut() };
    unsafe {
        let ok = if encrypt { CryptProtectData(&input, std::ptr::null(), std::ptr::null(), std::ptr::null(), std::ptr::null(), CRYPTPROTECT_UI_FORBIDDEN, &mut output) }
        else { CryptUnprotectData(&input, std::ptr::null_mut(), std::ptr::null(), std::ptr::null(), std::ptr::null(), CRYPTPROTECT_UI_FORBIDDEN, &mut output) };
        if ok == 0 { return Err("Windows credential encryption/unlock failed".into()); }
        let result = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
        std::ptr::write_bytes(output.pbData, 0, output.cbData as usize);
        LocalFree(output.pbData as *mut _);
        Ok(result)
    }
}
#[cfg(not(windows))]
pub(crate) fn protect(_: &[u8], _: bool) -> Result<Vec<u8>, String> { Err("Secure provider storage is currently supported on Windows desktop".into()) }
fn location(window: &WebviewWindow) -> Result<std::path::PathBuf, String> {
    Ok(window.app_handle().path().app_config_dir().map_err(|_| "Cannot locate app config")?.join("providers.dpapi"))
}
fn load(path: &std::path::Path) -> Result<BTreeMap<String, Config>, String> {
    match std::fs::read(path) {
        Ok(bytes) => serde_json::from_slice(&protect(&bytes, false)?).map_err(|_| "Credential store is damaged".into()),
        Err(e) if e.kind()==std::io::ErrorKind::NotFound => Ok(BTreeMap::new()),
        Err(_) => Err("Cannot read credential store".into())
    }
}
fn save(path: &std::path::Path, configs: &BTreeMap<String,Config>) -> Result<(),String> {
    let encrypted = protect(&serde_json::to_vec(configs).map_err(|_| "Cannot encode credentials")?, true)?;
    let parent = path.parent().ok_or("Missing configuration directory")?;
    std::fs::create_dir_all(parent).map_err(|_| "Cannot create configuration directory")?;
    let mut file = tempfile::NamedTempFile::new_in(parent).map_err(|_| "Cannot create encrypted store")?;
    file.write_all(&encrypted).map_err(|_| "Cannot save encrypted credentials")?;
    file.as_file().sync_all().map_err(|_| "Cannot flush encrypted credentials")?;
    file.persist(path).map_err(|_| "Cannot replace encrypted credential store")?;
    Ok(())
}
#[tauri::command]
pub fn provider_configs(window: WebviewWindow) -> Result<Vec<Metadata>,String> {
    crate::terminal::trusted(&window)?;
    let _guard = STORE_LOCK.lock().map_err(|_| "Credential store busy")?;
    Ok(load(&location(&window)?)?.into_iter().map(|(provider,c)| Metadata { configured: provider=="ollama" || !c.api_key.is_empty(), provider, account_id:c.account_id, revision:c.revision }).collect())
}
#[tauri::command]
pub fn provider_save(window: WebviewWindow, provider: String, api_key: String, account_id: String, remove: bool) -> Result<(),String> {
    crate::terminal::trusted(&window)?; supported(&provider)?;
    let _guard = STORE_LOCK.lock().map_err(|_| "Credential store busy")?;
    let path = location(&window)?; let mut configs = load(&path)?;
    if remove { configs.remove(&provider); }
    else {
        let key = if api_key.trim().is_empty() { configs.get(&provider).map(|c| c.api_key.clone()).unwrap_or_default() } else { api_key.trim().to_string() };
        if provider!="ollama" && (key.is_empty() || key.len()>8192 || key.contains(['\r','\n'])) { return Err("Enter a valid API key".into()); }
        if provider=="cloudflare" && (account_id.len()!=32 || !account_id.chars().all(|c|c.is_ascii_hexdigit())) { return Err("Cloudflare requires a 32-character account ID".into()); }
        configs.insert(provider,Config {api_key:key,account_id,revision:uuid::Uuid::new_v4().to_string()});
    }
    save(&path,&configs)
}
fn endpoint(provider: &str, model: &str, account: &str) -> Result<String,String> {
    supported(provider)?;
    if model.is_empty() || model.len()>200 || !model.chars().all(|c|c.is_ascii_alphanumeric() || "-_.:/@".contains(c)) || model.contains("..") { return Err("Invalid model ID".into()); }
    Ok(match provider {
        "gemini" => { if model.contains('/') { return Err("Invalid Gemini model ID".into()); } format!("https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent") },
        "anthropic" => "https://api.anthropic.com/v1/messages".into(),
        "openai" => "https://api.openai.com/v1/chat/completions".into(),
        "deepseek" => "https://api.deepseek.com/chat/completions".into(),
        "mistral" => "https://api.mistral.ai/v1/chat/completions".into(),
        "cohere" => "https://api.cohere.com/v2/chat".into(),
        "huggingface" => "https://router.huggingface.co/v1/chat/completions".into(),
        "together" => "https://api.together.xyz/v1/chat/completions".into(),
        "perplexity" => "https://api.perplexity.ai/chat/completions".into(),
        "replicate" => { if !model.contains('/') { return Err("Replicate models use the owner/name form".into()); } format!("https://api.replicate.com/v1/models/{model}/predictions") },
        "fireworks" => "https://api.fireworks.ai/inference/v1/chat/completions".into(),
        "openrouter" => { if model!="openrouter/free" && !model.ends_with(":free") { return Err("This adapter only permits OpenRouter free models".into()); } "https://openrouter.ai/api/v1/chat/completions".into() },
        "groq" => "https://api.groq.com/openai/v1/chat/completions".into(),
        "cloudflare" => { if account.len()!=32 || !account.chars().all(|c|c.is_ascii_hexdigit()) { return Err("Configure Cloudflare account ID".into()); } format!("https://api.cloudflare.com/client/v4/accounts/{account}/ai/v1/chat/completions") },
        "nvidia" => "https://integrate.api.nvidia.com/v1/chat/completions".into(),
        "fishaudio" => "https://api.fish.audio/v1/tts".into(),
        "ollama" => "http://127.0.0.1:11434/api/chat".into(),
        _ => return Err("Chat inference for this provider is not enabled; model discovery only".into())
    })
}
/// Flattens an OpenAI-style message into plain text.
fn message_text(message: &Value) -> String {
    if let Some(text) = message["content"].as_str() { return text.to_string(); }
    if let Some(parts) = message["content"].as_array() {
        return parts.iter().filter_map(|p|p["text"].as_str()).collect::<Vec<_>>().join("\n");
    }
    String::new()
}
/// Converts the shared OpenAI-style payload into each provider's native wire
/// format. OpenAI-compatible providers (deepseek, mistral, cohere v2,
/// huggingface router, together, perplexity, fireworks, and the fixed
/// groq/cloudflare/nvidia endpoints) pass through unchanged.
fn chat_payload(provider: &str, payload: &Value) -> Result<Value, String> {
    match provider {
        "anthropic" => {
            let messages=payload["messages"].as_array().ok_or("Invalid provider payload; messages are missing")?;
            let mut system=String::new(); let mut turns=Vec::new();
            for message in messages {
                let role=message["role"].as_str().unwrap_or("user");
                let content=message_text(message);
                if content.is_empty() { continue; }
                if role=="system" { if !system.is_empty(){system.push_str("\n");} system.push_str(&content); }
                else { let role=if role=="assistant"{"assistant"}else{"user"}; turns.push(json!({"role":role,"content":content})); }
            }
            if turns.is_empty() { return Err("Provider payload has no user or assistant turns".into()); }
            let mut body=json!({"model":payload["model"],"max_tokens":4096,"messages":turns});
            if !system.is_empty() { body["system"]=json!(system); }
            Ok(body)
        }
        "replicate" => {
            let messages=payload["messages"].as_array().ok_or("Invalid provider payload; messages are missing")?;
            let mut prompt=String::new(); let mut system=String::new();
            for message in messages {
                let role=message["role"].as_str().unwrap_or("user");
                let content=message_text(message);
                if content.is_empty() { continue; }
                if role=="system" { if !system.is_empty(){system.push_str("\n");} system.push_str(&content); }
                else if prompt.is_empty() { if role=="assistant" { prompt.push_str("Assistant: "); } prompt.push_str(&content); }
                else { prompt.push_str(&format!("\n\n{}: {}", if role=="assistant"{"assistant"}else{"user"}, content)); }
            }
            if prompt.is_empty() { return Err("Provider payload has no user or assistant turns".into()); }
            let mut input=json!({"prompt":prompt});
            if !system.is_empty() { input["system_prompt"]=json!(system); }
            Ok(json!({"input":input}))
        }
        _ => Ok(payload.clone()),
    }
}
/// Normalizes each provider's native reply into the OpenAI `choices` shape the
/// renderer already understands.
fn normalize_reply(provider: &str, value: &Value) -> Result<Value, String> {
    let text = match provider {
        "anthropic" => value["content"].as_array().map(|parts| parts.iter().filter_map(|p|p["text"].as_str()).collect::<Vec<_>>().join("")).unwrap_or_default(),
        "cohere" => {
            let content=&value["message"]["content"];
            content.as_array().map(|parts| parts.iter().filter_map(|p|p["text"].as_str().or_else(||p.as_str())).collect::<Vec<_>>().join("")).unwrap_or_default()
        }
        "replicate" => {
            let status=value["status"].as_str().unwrap_or("succeeded");
            if status=="failed" || status=="canceled" { return Err(format!("Replicate prediction did not complete: {}", value["error"].as_str().unwrap_or(status))); }
            match &value["output"] {
                Value::String(text)=>text.clone(),
                Value::Array(parts)=>parts.iter().filter_map(|p|p.as_str().map(|s|s.to_string()).or_else(||p["text"].as_str().map(|t|t.to_string()))).collect::<Vec<_>>().join(""),
                _=>String::new(),
            }
        }
        _ => return Ok(value.clone()),
    };
    Ok(json!({"choices":[{"message":{"content":text}}]}))
}
/// Provider calls the renderer may still cancel (losing racers), by request id.
type Abort = Box<dyn Fn() + Send>;
static IN_FLIGHT: Mutex<BTreeMap<String, Abort>> = Mutex::new(BTreeMap::new());
fn valid_request_id(id: &str) -> bool { !id.is_empty() && id.len() <= 80 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') }

#[tauri::command]
pub async fn provider_request(window: WebviewWindow, provider: String, model: String, payload: Value, timeout_secs: Option<u64>, request_id: Option<String>) -> Result<Value,String> {
    crate::terminal::trusted(&window)?;
    let Some(id) = request_id.filter(|id| valid_request_id(id)) else { return send_provider_request(window, provider, model, payload, timeout_secs).await };
    let task = tauri::async_runtime::spawn(send_provider_request(window, provider, model, payload, timeout_secs));
    let abort = task.inner().abort_handle();
    if let Ok(mut map) = IN_FLIGHT.lock() { map.insert(id.clone(), Box::new(move || abort.abort())); }
    let outcome = task.await;
    if let Ok(mut map) = IN_FLIGHT.lock() { map.remove(&id); }
    outcome.unwrap_or_else(|_| Err("Provider request cancelled".into()))
}

/// Stops an in-flight provider call: the HTTP request is dropped, so the provider stops
/// streaming to us (and usually stops generating) instead of finishing in the background.
#[tauri::command]
pub fn provider_cancel(window: WebviewWindow, request_id: String) -> Result<(), String> {
    crate::terminal::trusted(&window)?;
    let abort = IN_FLIGHT.lock().map_err(|_| "Request registry busy")?.remove(&request_id);
    if let Some(abort) = abort { abort(); }
    Ok(())
}

async fn send_provider_request(window: WebviewWindow, provider: String, model: String, mut payload: Value, timeout_secs: Option<u64>) -> Result<Value,String> {
    supported(&provider)?;
    let config = { let _guard=STORE_LOCK.lock().map_err(|_| "Credential store busy")?; load(&location(&window)?)?.get(&provider).cloned() };
    let config = config.ok_or("Provider is not configured. Save its configuration in Cloud Brain.")?;
    let url=endpoint(&provider,&model,&config.account_id)?;
    if !payload.is_object() || payload.to_string().len()>8_000_000 { return Err("Invalid or oversized provider request".into()); }
    if provider!="gemini" { payload["model"]=json!(model); payload["stream"]=json!(false); }
    let body=chat_payload(&provider,&payload)?;
    // The renderer races providers, so each attempt gets a bounded wait (10-120s, default 90).
    let timeout=Duration::from_secs(timeout_secs.unwrap_or(90).clamp(10,120));
    let client=reqwest::Client::builder().timeout(timeout).redirect(reqwest::redirect::Policy::none()).build().map_err(|_| "Cannot initialize provider transport")?;
    let mut request=client.post(url).json(&body);
    if provider=="gemini" { request=request.header("x-goog-api-key",config.api_key.clone()); }
    else if provider=="anthropic" { request=request.header("x-api-key",config.api_key.clone()).header("anthropic-version","2023-06-01"); }
    else if provider=="replicate" { request=request.bearer_auth(config.api_key.clone()).header("Prefer","wait"); }
    else if provider!="ollama" { request=request.bearer_auth(config.api_key.clone()); }
    let mut response=request.send().await.map_err(|e| format!("Provider connection failed: {}", e))?;
    let status=response.status();
    if !status.is_success() {
        let err_text = response.text().await.unwrap_or_default();
        let err_msg = serde_json::from_str::<Value>(&err_text)
            .ok()
            .and_then(|v| {
                if let Some(err_obj) = v.get("error") {
                    if let Some(msg) = err_obj.get("message").and_then(|m| m.as_str()) {
                        return Some(msg.to_string());
                    }
                }
                v.get("message").and_then(|m| m.as_str()).map(|s| s.to_string())
            })
            .unwrap_or_else(|| if err_text.trim().is_empty() {
                match status.as_u16() {
                    401 | 403 => "Check API key and permissions".to_string(),
                    429 => "Quota or rate limit reached".to_string(),
                    404 => "Model or endpoint unavailable".to_string(),
                    _ => "Request failed; check model availability and provider configuration".to_string(),
                }
            } else {
                err_text
            });
        return Err(format!("Provider HTTP {}: {}", status.as_u16(), err_msg));
    }
    let mut bytes=Vec::new();
    while let Some(chunk)=response.chunk().await.map_err(|_| "Provider response interrupted")? { if bytes.len()+chunk.len()>8_000_000 { return Err("Provider response too large".into()); } bytes.extend_from_slice(&chunk); }
    let value:Value=serde_json::from_slice(&bytes).map_err(|_|"Provider returned invalid JSON".to_string())?;
    normalize_reply(&provider,&value)
}

#[tauri::command]
pub async fn fish_audio_tts(
    window: WebviewWindow,
    text: String,
    api_key: Option<String>,
    model: Option<String>,
    reference_id: Option<String>,
) -> Result<Vec<u8>, String> {
    crate::terminal::trusted(&window)?;
    let key = match api_key.filter(|k| !k.trim().is_empty()) {
        Some(k) => k.trim().to_string(),
        None => {
            let _guard = STORE_LOCK.lock().map_err(|_| "Credential store busy")?;
            load(&location(&window)?)?
                .get("fishaudio")
                .map(|c| c.api_key.clone())
                .filter(|k| !k.trim().is_empty())
                .ok_or("Fish Audio API key is not configured. Enter your sk-fish-... key in Cloud Brain.")?
        }
    };

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(45))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| "Cannot initialize Fish Audio HTTP client")?;

    let mut body = json!({
        "text": text.trim(),
        "format": "mp3",
    });
    if let Some(m) = model.filter(|m| !m.trim().is_empty()) {
        body["model"] = json!(m.trim());
    }
    if let Some(r) = reference_id.filter(|r| !r.trim().is_empty()) {
        body["reference_id"] = json!(r.trim());
    }

    let response = client
        .post("https://api.fish.audio/v1/tts")
        .bearer_auth(key)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Fish Audio connection failed: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let err_text = response.text().await.unwrap_or_default();
        let err_msg = serde_json::from_str::<Value>(&err_text)
            .ok()
            .and_then(|v| v.get("message").and_then(|m| m.as_str()).map(|s| s.to_string()))
            .unwrap_or_else(|| err_text);
        return Err(format!("Fish Audio HTTP {}: {}", status.as_u16(), err_msg));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read Fish Audio audio stream: {}", e))?;
    Ok(bytes.to_vec())
}

#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct FishAudioTestResult {
    pub success: bool,
    pub status_code: u16,
    pub latency_ms: u64,
    pub message: String,
}

#[tauri::command]
pub async fn fish_audio_test(
    window: WebviewWindow,
    api_key: Option<String>,
) -> Result<FishAudioTestResult, String> {
    crate::terminal::trusted(&window)?;
    let key = match api_key.filter(|k| !k.trim().is_empty()) {
        Some(k) => k.trim().to_string(),
        None => {
            let _guard = STORE_LOCK.lock().map_err(|_| "Credential store busy")?;
            load(&location(&window)?)?
                .get("fishaudio")
                .map(|c| c.api_key.clone())
                .filter(|k| !k.trim().is_empty())
                .unwrap_or_default()
        }
    };

    if key.trim().is_empty() {
        return Ok(FishAudioTestResult {
            success: false,
            status_code: 400,
            latency_ms: 0,
            message: "Fish Audio API key is not configured. Enter your sk-fish-... key in Cloud Brain.".to_string(),
        });
    }

    let start = std::time::Instant::now();
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| format!("Cannot initialize HTTP client: {}", e))?;

    let body = json!({
        "text": "AXION voice test",
        "format": "mp3"
    });

    let res = client
        .post("https://api.fish.audio/v1/tts")
        .bearer_auth(key)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await;

    let latency_ms = start.elapsed().as_millis() as u64;

    match res {
        Ok(response) => {
            let status = response.status();
            if status.is_success() {
                Ok(FishAudioTestResult {
                    success: true,
                    status_code: status.as_u16(),
                    latency_ms,
                    message: format!("Connected & Verified · Fish Audio neural synthesis active ({}ms).", latency_ms),
                })
            } else {
                let err_text = response.text().await.unwrap_or_default();
                let err_msg = serde_json::from_str::<Value>(&err_text)
                    .ok()
                    .and_then(|v| v.get("message").and_then(|m| m.as_str()).map(|s| s.to_string()))
                    .unwrap_or_else(|| err_text);
                let message = if status.as_u16() == 402 {
                    format!("Fish Audio HTTP 402: Insufficient API credit. Visit https://fish.audio/app/developers to view your credit balance or add funds.")
                } else if status.as_u16() == 401 {
                    format!("Fish Audio HTTP 401: Unauthorized. Please check your Fish Audio API key.")
                } else {
                    format!("Fish Audio HTTP {}: {}", status.as_u16(), err_msg)
                };
                Ok(FishAudioTestResult {
                    success: false,
                    status_code: status.as_u16(),
                    latency_ms,
                    message,
                })
            }
        }
        Err(e) => Ok(FishAudioTestResult {
            success: false,
            status_code: 0,
            latency_ms,
            message: format!("Network connection error: {}", e),
        }),
    }
}
#[cfg(test)] mod tests {
 use super::*;
 #[test] fn endpoints_are_fixed_and_free_router_cannot_spend(){assert!(endpoint("openrouter","openrouter/auto","").is_err());assert!(endpoint("gemini","../../evil","").is_err());assert!(endpoint("cloudflare","model","../bad").is_err());assert_eq!(endpoint("ollama","qwen2.5-coder:7b","").unwrap(),"http://127.0.0.1:11434/api/chat");}
 #[test] fn catalog_only_providers_have_chat_adapters(){
  assert_eq!(endpoint("anthropic","claude-3-5-haiku-latest","").unwrap(),"https://api.anthropic.com/v1/messages");
  assert_eq!(endpoint("deepseek","deepseek-chat","").unwrap(),"https://api.deepseek.com/chat/completions");
  assert_eq!(endpoint("mistral","mistral-small-latest","").unwrap(),"https://api.mistral.ai/v1/chat/completions");
  assert_eq!(endpoint("cohere","command-r7b-12-2024","").unwrap(),"https://api.cohere.com/v2/chat");
  assert_eq!(endpoint("huggingface","HuggingFaceH4/zephyr-7b-beta","").unwrap(),"https://router.huggingface.co/v1/chat/completions");
  assert_eq!(endpoint("together","meta-llama/Llama-3.3-70B-Instruct-Turbo","").unwrap(),"https://api.together.xyz/v1/chat/completions");
  assert_eq!(endpoint("perplexity","sonar","").unwrap(),"https://api.perplexity.ai/chat/completions");
  assert_eq!(endpoint("replicate","openai/gpt-4.1-mini","").unwrap(),"https://api.replicate.com/v1/models/openai/gpt-4.1-mini/predictions");
  assert_eq!(endpoint("fireworks","accounts/fireworks/models/llama-v3p3-70b-instruct","").unwrap(),"https://api.fireworks.ai/inference/v1/chat/completions");
  assert!(endpoint("replicate","llama-3-70b","").is_err());
 }
 #[test] fn reply_normalization_extracts_text(){
  let anthropic=json!({"content":[{"type":"text","text":"OK"}]});
  let flat=normalize_reply("anthropic",&anthropic).unwrap();
  assert_eq!(flat["choices"][0]["message"]["content"],"OK");
  let cohere=json!({"message":{"content":[{"type":"text","text":"OK"}]}});
  assert_eq!(normalize_reply("cohere",&cohere).unwrap()["choices"][0]["message"]["content"],"OK");
  let replicate=json!({"status":"succeeded","output":["OK","!"]});
  assert_eq!(normalize_reply("replicate",&replicate).unwrap()["choices"][0]["message"]["content"],"OK!");
  assert!(normalize_reply("replicate",&json!({"status":"failed","error":"model error"})).is_err());
 }
 #[test] fn chat_payloads_match_provider_wire_formats(){
  let openai=json!({"model":"m","messages":[{"role":"system","content":"Be brief."},{"role":"user","content":"Reply OK."}],"stream":false});
  let anthropic=chat_payload("anthropic",&openai).unwrap();
  assert_eq!(anthropic["system"],"Be brief.");
  assert_eq!(anthropic["messages"][0]["role"],"user");
  assert!(anthropic["max_tokens"].as_u64().unwrap_or(0)>=1);
  let replicate=chat_payload("replicate",&openai).unwrap();
  assert_eq!(replicate["input"]["prompt"],"Reply OK.");
  assert_eq!(replicate["input"]["system_prompt"],"Be brief.");
  assert!(chat_payload("gemini",&openai).is_ok());
 }
 #[cfg(windows)] #[test] fn encrypted_store_roundtrip_and_replace(){let dir=tempfile::tempdir().unwrap();let path=dir.path().join("test.dpapi");let mut data=BTreeMap::new();data.insert("groq".into(),Config{api_key:"test-secret-not-real".into(),account_id:String::new(),revision:String::new()});save(&path,&data).unwrap();assert!(!String::from_utf8_lossy(&std::fs::read(&path).unwrap()).contains("test-secret-not-real"));assert_eq!(load(&path).unwrap()["groq"].api_key,"test-secret-not-real");data.clear();save(&path,&data).unwrap();assert!(load(&path).unwrap().is_empty());}
}

#[tauri::command]
pub async fn transcribe_audio(window:WebviewWindow,audio:Vec<u8>,mime:String,language:Option<String>)->Result<String,String>{
 crate::terminal::trusted(&window)?;
 if audio.is_empty()||audio.len()>2_000_000{return Err("Audio segment is empty or too large".into());}
 let (filename,content_type)=match mime.split(';').next().unwrap_or(""){"audio/webm"=>("speech.webm","audio/webm"),"audio/ogg"=>("speech.ogg","audio/ogg"),"audio/mp4"=>("speech.m4a","audio/mp4"),_=>return Err("Unsupported microphone recording format".into())};
 let key={let _guard=STORE_LOCK.lock().map_err(|_|"Credential store busy")?;load(&location(&window)?)?.get("groq").map(|c|c.api_key.clone()).filter(|k|!k.is_empty()).ok_or("Save a Groq key in Cloud Brain to enable desktop transcription.")?};
 let part=reqwest::multipart::Part::bytes(audio).file_name(filename).mime_str(content_type).map_err(|_|"Invalid audio format")?;
 // Whisper is told the user's language (any ISO 639-1 code): left to guess, it often writes Hindi in Urdu script.
 // Do not seed example commands or vocabulary: Whisper can echo them on noisy audio.
 let language=language.as_deref().map(str::trim).filter(|l|(2..=3).contains(&l.len())&&l.chars().all(|c|c.is_ascii_lowercase()));
 let mut form=reqwest::multipart::Form::new().part("file",part).text("model","whisper-large-v3-turbo").text("response_format","json").text("temperature","0");
 // Auto mode lets each utterance switch languages; explicit Hindi/English still pins it.
 if let Some(language)=language { form=form.text("language",language.to_string()); }
 let client=reqwest::Client::builder().timeout(Duration::from_secs(30)).redirect(reqwest::redirect::Policy::none()).build().map_err(|_|"Cannot initialize transcription")?;
 let response=client.post("https://api.groq.com/openai/v1/audio/transcriptions").bearer_auth(key).multipart(form).send().await.map_err(|_|"Groq transcription connection failed. Check network; your recording was not saved.")?;
 if !response.status().is_success(){return Err(format!("Groq transcription HTTP {}. Check the saved key, quota and provider availability.",response.status().as_u16()));}
 let result:Value=response.json().await.map_err(|_|"Invalid transcription response")?;
 result.get("text").and_then(Value::as_str).map(|s|s.trim().to_string()).ok_or("Transcription returned no text".into())
}
