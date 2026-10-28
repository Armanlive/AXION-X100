use crate::integration_client::{Connection,ResultData,execute,summarize};
// Native-only integration vault. Tokens never return to the renderer or the model.
use std::{collections::BTreeMap,io::Write,sync::Mutex};
use tauri::{Manager,WebviewWindow};
use crate::integration_plan::{plan,SERVICES};
static LOCK:Mutex<()>=Mutex::new(());
fn location(window:&WebviewWindow)->Result<std::path::PathBuf,String>{Ok(window.app_handle().path().app_config_dir().map_err(|_|"Configuration directory unavailable")?.join("integrations.dpapi"))}
fn load(window:&WebviewWindow)->Result<BTreeMap<String,Connection>,String>{
 match std::fs::read(location(window)?){
  Ok(bytes)=>serde_json::from_slice(&crate::providers::protect(&bytes,false)?).map_err(|_|"Integration vault is damaged".into()),
  Err(e) if e.kind()==std::io::ErrorKind::NotFound=>Ok(BTreeMap::new()),
  Err(_)=>Err("Cannot read integration vault".into())
 }
}
fn save(window:&WebviewWindow,entries:&BTreeMap<String,Connection>)->Result<(),String>{
 let path=location(window)?;let parent=path.parent().ok_or("Missing vault directory")?;
 let clear=serde_json::to_vec(entries).map_err(|_|"Cannot encode vault")?;
 let protected=crate::providers::protect(&clear,true)?;
 std::fs::create_dir_all(parent).map_err(|_|"Cannot create vault directory")?;
 let mut file=tempfile::NamedTempFile::new_in(parent).map_err(|_|"Cannot create vault")?;
 file.write_all(&protected).map_err(|_|"Cannot write vault")?;file.as_file().sync_all().map_err(|_|"Cannot flush vault")?;
 file.persist(path).map_err(|_|"Cannot replace vault")?;Ok(())
}
#[tauri::command]
pub fn integration_connections(window:WebviewWindow)->Result<Vec<String>,String>{crate::terminal::trusted(&window)?;let _lock=LOCK.lock().map_err(|_|"Vault busy")?;Ok(load(&window)?.keys().cloned().collect())}
#[tauri::command]
pub async fn integration_connect(window:WebviewWindow,service:String,token:String,project:String,resource:String)->Result<ResultData,String>{
 crate::terminal::trusted(&window)?;
 if !SERVICES.contains(&service.as_str()) || token.trim().is_empty() || token.len()>8192 || token.contains(['\r','\n']){return Err("Enter a valid service access token".into());}
 let connection=Connection{service:service.clone(),token:token.trim().into(),project,resource};
 let result=execute(&connection,"verify",&connection.resource,"","").await?;
 crate::terminal::trusted(&window)?;let _lock=LOCK.lock().map_err(|_|"Vault busy")?;
 let mut entries=load(&window)?;entries.insert(service.clone(),connection);save(&window,&entries)?;
 Ok(summarize(&service,"verify",result))
}
#[tauri::command]
pub fn integration_disconnect(window:WebviewWindow,service:String)->Result<(),String>{crate::terminal::trusted(&window)?;let _lock=LOCK.lock().map_err(|_|"Vault busy")?;let mut entries=load(&window)?;entries.remove(&service);save(&window,&entries)}
#[tauri::command]
pub async fn integration_request(window:WebviewWindow,service:String,operation:String,resource:String,title:String,content:String)->Result<ResultData,String>{
 crate::terminal::trusted(&window)?;
 if operation!="read" && operation!="write"{return Err("Unsupported integration operation".into());}
 if content.len()>5000{return Err("Content exceeds 5 KB".into());}
 let connection={let _lock=LOCK.lock().map_err(|_|"Vault busy")?;load(&window)?.get(&service).cloned().ok_or("Connect this integration first")?};
 let target=if resource.is_empty(){connection.resource.clone()}else{resource};
 plan(&service,&operation,&connection.project,&target,&title,&content)?;
 if operation=="write"{
  let description=format!("Create data in {}?\n\nResource: {}\nTitle: {}\n\nContent:\n{}",service,target,title,content);
  let approved=tauri::async_runtime::spawn_blocking(move||rfd::MessageDialog::new().set_title("AXION — Approve integration write").set_description(description).set_buttons(rfd::MessageButtons::OkCancel).show()).await.map_err(|_|"Approval window failed")?;
  if approved!=rfd::MessageDialogResult::Ok{return Err("Cancelled. No write request was sent.".into());}
 }
 crate::terminal::trusted(&window)?;
 let result=execute(&connection,&operation,&target,&title,&content).await?;
 Ok(summarize(&service,&operation,result))
}
