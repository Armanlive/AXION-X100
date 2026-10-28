use serde::Serialize;
use std::{path::Path,process::{Command,Stdio},io::Read,time::{Duration,Instant}};
use tauri::{Manager,WebviewWindow};
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct Snapshot {root:String,head:Option<String>,diff_stat:String,files:Vec<(String,String)>,truncated:bool,git_error:Option<String>}
fn git(root:&Path,args:&[&str])->Result<String,String>{
 let mut command=Command::new("git");
 command.current_dir(root).args(["-c","core.fsmonitor=false","-c","init.templateDir=","-c","core.hooksPath=/dev/null","--no-pager"]).args(args).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null());
 for (key,_) in std::env::vars_os(){if key.to_string_lossy().starts_with("GIT_"){command.env_remove(key);}}
 command.env("GIT_TERMINAL_PROMPT","0").env("GIT_CONFIG_NOSYSTEM","1");
 #[cfg(windows)] {use std::os::windows::process::CommandExt;command.creation_flags(0x08000000);}
 let mut child=command.spawn().map_err(|_|"Git is unavailable. Install Git to enable commit metadata.")?;
 let stdout=child.stdout.take().ok_or("Git output unavailable")?;
 let reader=std::thread::spawn(move||{let mut bytes=Vec::new();let _=stdout.take(100_000).read_to_end(&mut bytes);bytes});
 let start=Instant::now();let status=loop{if let Some(status)=child.try_wait().map_err(|_|"Git status failed")?{break status;}if start.elapsed()>Duration::from_secs(10){let _=child.kill();let _=child.wait();let _=reader.join();return Err("Git operation timed out".into());}std::thread::sleep(Duration::from_millis(20));};
 let bytes=reader.join().map_err(|_|"Git output interrupted")?;
 if !status.success(){return Err("Git operation failed".into());}Ok(String::from_utf8_lossy(&bytes).trim().to_string())
}
pub fn included(path:&str)->bool{
 let lower=path.replace('\\',"/").to_lowercase();
 !lower.split('/').any(|p|matches!(p,"node_modules"|".git"|"dist"|"build"|".ecc"|"target"|".venv"|"artifacts"|"__pycache__")||p.starts_with(".env")||p.ends_with(".lock")||p.ends_with("-lock.json")||p.ends_with("lock.yaml")||p.contains("credential")||p.contains("secret"))
}
#[tauri::command]
pub async fn ecc_snapshot(window:WebviewWindow,repo_path:String,initialize:bool)->Result<Snapshot,String>{
 crate::terminal::trusted(&window)?;
 tauri::async_runtime::spawn_blocking(move||{
  let state=window.state::<crate::AppState>();let mgr=state.workspace_manager.lock().map_err(|_|"Workspace busy")?;
  let info=mgr.get_workspace_info().map_err(|e|e.to_string())?;let root=Path::new(&info.canonical_root);
  if Path::new(&repo_path).canonicalize().map_err(|_|"Invalid ECC workspace")?!=root.canonicalize().map_err(|_|"Invalid active workspace")?{return Err("ECC workspace changed; retry the request".into());}
  let mut git_error=None;
  if initialize&&!root.join(".git").exists(){if let Err(e)=git(root,&["init","--quiet"]){git_error=Some(e);}}
  let head=git(root,&["rev-parse","--verify","HEAD"]).ok();
  let diff_stat=if head.is_some(){match git(root,&["diff","--no-ext-diff","--stat","HEAD","--"]){Ok(s)=>s,Err(e)=>{git_error=Some(e);String::new()}}}else{String::new()};
  let entries=mgr.list_files(Some(12)).map_err(|e|e.to_string())?;
  let mut files=Vec::new();let mut size=0;let mut truncated=false;
  for file in entries {if file.is_directory||!included(&file.relative_path){continue;}if files.len()>=160 {truncated=true;break;}
   let ext=Path::new(&file.relative_path).extension().and_then(|e|e.to_str()).unwrap_or("");
   let content=if matches!(ext,"ts"|"tsx"|"js"|"jsx"|"rs"|"py"|"go"|"java"|"cs")&&file.size_bytes<100_000&&size<1_000_000{mgr.read_text_file(&file.relative_path).unwrap_or_default()}else{String::new()};
   size+=content.len();files.push((file.relative_path,content));
  }
  files.sort_by(|a,b|a.0.cmp(&b.0));
  Ok(Snapshot{root:info.canonical_root,head,diff_stat,files,truncated,git_error})
 }).await.map_err(|_|"ECC task interrupted")?
}
#[cfg(test)]mod tests{use super::*;
 #[test]fn exclusions(){for p in ["node_modules/a.ts",".git/config","dist/x.js","x/package-lock.json",".env.local",".ecc/a","Cargo.lock"]{assert!(!included(p));}assert!(included("src/app.tsx"));}
 #[test]fn unborn_repository_and_diff(){let dir=tempfile::tempdir().unwrap();git(dir.path(),&["init","--quiet"]).unwrap();assert!(git(dir.path(),&["rev-parse","--verify","HEAD"]).is_err());std::fs::write(dir.path().join("app.ts"),"export const count=1;\n").unwrap();git(dir.path(),&["add","app.ts"]).unwrap();git(dir.path(),&["-c","user.name=ECC Test","-c","user.email=ecc@example.invalid","commit","--no-gpg-sign","-qm","test"]).unwrap();assert!(!git(dir.path(),&["rev-parse","HEAD"]).unwrap().is_empty());std::fs::write(dir.path().join("app.ts"),"export const count=2;\n").unwrap();assert!(git(dir.path(),&["diff","--stat","HEAD"]).unwrap().contains("app.ts"));}
}
