//! Manual interactive terminals. Agent command execution deliberately does not call this module.
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, ChildKiller, PtySize};
use serde::Serialize;
use std::{collections::HashMap, io::{Read, Write}, sync::{Arc, Condvar, Mutex}, time::Duration};
use tauri::{ipc::Channel, Manager, State, WebviewWindow};
use crate::AppState;

#[derive(Serialize, Clone)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum TerminalEvent { Data { bytes: Vec<u8> }, Exit { code: Option<u32> }, Error { message: String } }
#[derive(Serialize)]
pub struct Opened { id: String, cwd: String }
#[derive(Default)]
struct Credit { pending: usize, closed: bool }
struct Session {
    owner: String,
    master: Box<dyn MasterPty + Send>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    killer: Box<dyn ChildKiller + Send + Sync>,
    flow: Arc<(Mutex<Credit>, Condvar)>,
    #[cfg(windows)]
    _job: process_job::Job,
}
impl Drop for Session {
    fn drop(&mut self) {
        if let Ok(mut credit) = self.flow.0.lock() { credit.closed = true; }
        self.flow.1.notify_all();
        #[cfg(windows)]
        self._job.terminate();
        let _ = self.killer.kill();
    }
}
#[derive(Default)]
pub struct TerminalManager { sessions: Mutex<HashMap<String, Session>>, opening: Mutex<bool> }
impl TerminalManager {
    pub fn close_all(&self) { if let Ok(mut sessions) = self.sessions.lock() { sessions.clear(); } }
}
pub(crate) fn trusted(window: &WebviewWindow) -> Result<(), String> {
    let url = window.url().map_err(|e| e.to_string())?;
    let local = url.scheme() == "tauri" || matches!(url.host_str(), Some("tauri.localhost"));
    let dev = cfg!(debug_assertions) && matches!(url.host_str(),Some("localhost" | "127.0.0.1")) && url.port() == Some(3000);
    if window.label() != "main" || !(local || dev) { return Err("Terminal access is limited to the local main window".into()); }
    Ok(())
}
fn size(cols: u16, rows: u16) -> Result<PtySize, String> {
    if !(2..=500).contains(&cols) || !(1..=200).contains(&rows) { return Err("Invalid terminal dimensions".into()); }
    Ok(PtySize { cols, rows, pixel_width: 0, pixel_height: 0 })
}
/// Normalizes a Windows verbatim path (`\\?\E:\...` / `\\?\UNC\host\share`)
/// into the classic form `cmd.exe` accepts as a current directory. PowerShell
/// tolerates verbatim prefixes, but `cmd` prints "'\\?\…' UNC paths are not
/// supported" and silently falls back to the Windows directory.
fn normalize_dir(path: &str) -> String {
    if let Some(rest) = path.strip_prefix(r"\\?\UNC\") { return format!(r"\\{}", rest); }
    if let Some(rest) = path.strip_prefix(r"\\?\") { return rest.to_string(); }
    path.to_string()
}
fn shell(profile: &str) -> Result<CommandBuilder, String> {
    #[cfg(windows)]
    let (exe, args): (String, &[&str]) = {
        // System shell paths, never a frontend-supplied executable or command string.
        let system = std::env::var("SystemRoot").map_err(|_| "SystemRoot is unavailable")?;
        match profile {
            "powershell" => (format!("{}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", system), &["-NoLogo", "-NoProfile"]),
            "cmd" => (format!("{}\\System32\\cmd.exe", system), &["/D"]),
            _ => return Err("This shell profile is not supported by the Windows terminal host".into()),
        }
    };
    #[cfg(not(windows))]
    let (exe, args): (String, &[&str]) = match profile {
        "bash" => ("/bin/bash".into(), &["--noprofile", "--norc", "-i"]),
        _ => return Err("Select the Bash profile on this platform".into()),
    };
    let mut command = CommandBuilder::new(exe); command.args(args); command.env("TERM", "xterm-256color"); Ok(command)
}

#[tauri::command]
pub async fn terminal_open(window: WebviewWindow, app: tauri::AppHandle, state: State<'_, AppState>, terminals: State<'_, TerminalManager>, profile: String, cols: u16, rows: u16, output: Channel<TerminalEvent>) -> Result<Opened,String> {
    trusted(&window)?;
    let dimensions = size(cols, rows)?;
    let mut command = shell(&profile)?;
    let cwd = normalize_dir(&state.workspace_manager.lock().map_err(|e| e.to_string())?.get_workspace_info().map_err(|e| e.to_string())?.canonical_root);
    { let mut opening=terminals.opening.lock().map_err(|e|e.to_string())?;
      if *opening { return Err("A terminal authorization is already open".into()); } *opening=true; }
    let description=format!("Open a manual {} shell in:\n{}\n\nThis shell runs as your OS user and can change files outside this workspace. It is not a workspace sandbox. AI proposals will not be executed automatically. Close the terminal to end this session.", profile,cwd);
    let consent = tauri::async_runtime::spawn_blocking(move || rfd::MessageDialog::new().set_title("AXION — Open local terminal").set_description(description).set_buttons(rfd::MessageButtons::OkCancel).show()).await;
    *terminals.opening.lock().map_err(|e|e.to_string())?=false;
    if consent.map_err(|e|e.to_string())? != rfd::MessageDialogResult::Ok { return Err("Terminal opening cancelled".into()); }
    trusted(&window)?;
    // Recheck after the native permission dialog; no frontend cwd can authorize a workspace.
    let workspace=state.workspace_manager.lock().map_err(|e|e.to_string())?;
    if normalize_dir(&workspace.get_workspace_info().map_err(|e|e.to_string())?.canonical_root) != cwd { return Err("Workspace changed; open the terminal again".into()); }    let mut sessions=terminals.sessions.lock().map_err(|e|e.to_string())?;
    if sessions.len()>=8 { return Err("Close a terminal before opening more (limit: 8)".into()); }
    command.cwd(&cwd);
    let pair=native_pty_system().openpty(dimensions).map_err(|e|e.to_string())?;
    let mut reader=pair.master.try_clone_reader().map_err(|e|e.to_string())?;
    let writer=pair.master.take_writer().map_err(|e|e.to_string())?;
    let mut child=pair.slave.spawn_command(command).map_err(|e|e.to_string())?;
    #[cfg(windows)]
    let pid=match child.process_id(){Some(pid)=>pid,None=>{let _=child.kill();return Err("Shell PID unavailable".into());}};
    #[cfg(windows)]
    let job=match process_job::Job::attach(pid) { Ok(job)=>job, Err(e)=>{let _=child.kill();return Err(e);} };
    drop(pair.slave);
    let id=uuid::Uuid::new_v4().to_string();
    let flow=Arc::new((Mutex::new(Credit::default()),Condvar::new()));
    sessions.insert(id.clone(),Session {owner:window.label().to_string(),master:pair.master,writer:Arc::new(Mutex::new(writer)),killer:child.clone_killer(),flow:flow.clone(),#[cfg(windows)] _job:job});
    drop(sessions);drop(workspace);
    let read_output=output.clone();let read_flow=flow.clone();let read_app=app.clone();let read_id=id.clone();
    let reader_thread=std::thread::spawn(move || {
        let mut buffer=[0u8;8192];
        loop {
            let n=match reader.read(&mut buffer) {Ok(0)=>break,Ok(n)=>n,Err(e)=>{let _=read_output.send(TerminalEvent::Error{message:e.to_string()});break;}};
            let (lock,ready)=&*read_flow;
            let Ok(credit)=lock.lock() else {break;};
            let Ok((mut credit,timeout))=ready.wait_timeout_while(credit,Duration::from_secs(30),|c|c.pending>=262144 && !c.closed) else {break;};
            if credit.closed || timeout.timed_out() {break;}
            credit.pending+=n;drop(credit);
            if read_output.send(TerminalEvent::Data{bytes:buffer[..n].to_vec()}).is_err(){break;}
        }
        // Close on channel failure, backpressure timeout, or EOF. No orphan shell.
        let manager=read_app.state::<TerminalManager>();
        if let Ok(mut sessions)=manager.sessions.lock(){sessions.remove(&read_id);};
    });
    let wait_id=id.clone();
    std::thread::spawn(move || {
        let result=child.wait();
        #[cfg(windows)]
        if let Ok(sessions)=app.state::<TerminalManager>().sessions.lock(){if let Some(session)=sessions.get(&wait_id){session._job.terminate();}}
        // Drain all output before announcing shell exit.
        let _=reader_thread.join();
        let event=match result {Ok(status)=>TerminalEvent::Exit{code:Some(status.exit_code())},Err(e)=>TerminalEvent::Error{message:e.to_string()}};
        let _=output.send(event);
    });
    Ok(Opened{id,cwd})
}
fn with_session<T>(window: &WebviewWindow, terminals: &TerminalManager, id: &str, f: impl FnOnce(&mut Session)->Result<T,String>)->Result<T,String>{
    trusted(window)?;
    let mut sessions=terminals.sessions.lock().map_err(|e|e.to_string())?;
    let session=sessions.get_mut(id).ok_or("Terminal is closed")?;
    if session.owner!=window.label(){return Err("Terminal belongs to another window".into());} f(session)
}
#[tauri::command]
pub async fn terminal_write(window:WebviewWindow,terminals:State<'_,TerminalManager>,id:String,data:String)->Result<(),String>{
    if data.len()>65536{return Err("Input exceeds terminal chunk limit".into());}
    let writer=with_session(&window,&terminals,&id,|s|Ok(s.writer.clone()))?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut writer=writer.lock().map_err(|e|e.to_string())?;
        writer.write_all(data.as_bytes()).and_then(|_|writer.flush()).map_err(|e|e.to_string())
    }).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub fn terminal_resize(window:WebviewWindow,terminals:State<'_,TerminalManager>,id:String,cols:u16,rows:u16)->Result<(),String>{
    let dimensions=size(cols,rows)?;with_session(&window,&terminals,&id,|s|s.master.resize(dimensions).map_err(|e|e.to_string()))
}
#[tauri::command]
pub fn terminal_ack(window:WebviewWindow,terminals:State<'_,TerminalManager>,id:String,bytes:usize)->Result<(),String>{
    with_session(&window,&terminals,&id,|s|{let mut credit=s.flow.0.lock().map_err(|e|e.to_string())?;if bytes>credit.pending{return Err("Invalid output acknowledgement".into());}credit.pending-=bytes;s.flow.1.notify_all();Ok(())})
}
#[tauri::command]
pub fn terminal_close(window:WebviewWindow,terminals:State<'_,TerminalManager>,id:String)->Result<(),String>{
    trusted(&window)?;let mut sessions=terminals.sessions.lock().map_err(|e|e.to_string())?;
    if let Some(s)=sessions.get(&id){if s.owner!=window.label(){return Err("Terminal belongs to another window".into());}}
    sessions.remove(&id);Ok(())
}

#[cfg(windows)]
mod process_job {
    use windows_sys::Win32::{Foundation::{CloseHandle,HANDLE},System::{JobObjects::*,Threading::{OpenProcess,PROCESS_SET_QUOTA,PROCESS_TERMINATE}}};
    pub struct Job(HANDLE);
    unsafe impl Send for Job {}
    impl Job {
        pub fn terminate(&self){unsafe{TerminateJobObject(self.0,1);}}
        pub fn attach(pid:u32)->Result<Self,String>{unsafe{
            let job=CreateJobObjectW(std::ptr::null(),std::ptr::null());
            if job.is_null(){return Err(std::io::Error::last_os_error().to_string());}
            let owned=Self(job);let mut limits:JOBOBJECT_EXTENDED_LIMIT_INFORMATION=std::mem::zeroed();
            limits.BasicLimitInformation.LimitFlags=JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            if SetInformationJobObject(job,JobObjectExtendedLimitInformation,&limits as *const _ as *const _,std::mem::size_of_val(&limits) as u32)==0{return Err(std::io::Error::last_os_error().to_string());}
            let process=OpenProcess(PROCESS_SET_QUOTA|PROCESS_TERMINATE,0,pid);
            if process.is_null(){return Err(std::io::Error::last_os_error().to_string());}
            let ok=AssignProcessToJobObject(job,process);let err=std::io::Error::last_os_error();CloseHandle(process);
            if ok==0{return Err(err.to_string());}Ok(owned)
        }}
    }
    impl Drop for Job {fn drop(&mut self){unsafe{CloseHandle(self.0);}}}
}
#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(windows)]
    #[test]
    fn powershell_pty_uses_workspace_directory() {
        let root = tempfile::tempdir().unwrap();
        let mut workspace = crate::workspace::WorkspaceManager::new();
        let info = workspace.set_workspace_root(root.path().to_str().unwrap()).unwrap();
        let mut command = shell("powershell").unwrap();
        command.cwd(&info.canonical_root);
        command.args(["-NonInteractive", "-Command", "[Console]::WriteLine('AXION_CWD=' + (Get-Location).Path)"]);
        let pair = native_pty_system().openpty(size(120, 24).unwrap()).unwrap();
        let mut reader = pair.master.try_clone_reader().unwrap();
        let mut child = pair.slave.spawn_command(command).unwrap();
        drop(pair.slave);
        let mut writer = pair.master.take_writer().unwrap();
        let (tx, rx) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let mut bytes = [0; 4096];
            while let Ok(count) = reader.read(&mut bytes) {
                if count == 0 { break; }
                if tx.send(String::from_utf8_lossy(&bytes[..count]).into_owned()).is_err() { break; }
            }
        });
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(20);
        let mut output = String::new();
        while std::time::Instant::now() < deadline {
            if let Ok(chunk) = rx.recv_timeout(std::time::Duration::from_millis(100)) {
                // Emulate the terminal's cursor-position response used by ConPTY.
                if chunk.contains("\x1b[6n") { let _ = writer.write_all(b"\x1b[1;1R"); }
                output.push_str(&chunk);
            }
            if child.try_wait().unwrap().is_some() { break; }
        }
        if child.try_wait().unwrap().is_none() { let _ = child.kill(); panic!("PowerShell PTY timed out: {}", output); }
        drop(writer);
        drop(pair.master);
        while let Ok(chunk) = rx.recv_timeout(std::time::Duration::from_millis(100)) { output.push_str(&chunk); }
        assert!(child.wait().unwrap().success());
        assert!(output.contains("AXION_CWD="), "{}", output);
        assert!(output.contains(root.path().to_str().unwrap()), "{}", output);
    }
    #[test] fn reject_invalid_sizes(){assert!(size(0,24).is_err());assert!(size(80,0).is_err());assert!(size(501,24).is_err());assert!(size(80,24).is_ok());}
    #[test] fn reject_command_as_profile(){assert!(shell("powershell; Remove-Item .").is_err());assert!(shell("custom").is_err());}
    #[test] fn verbatim_workspace_paths_are_normalized_for_shells(){
        #[cfg(windows)]
        {
            assert_eq!(normalize_dir(r"\\?\E:\insuredesk-portal"), r"E:\insuredesk-portal");
            assert_eq!(normalize_dir(r"\\?\UNC\server\share\proj"), r"\\server\share\proj");
            assert_eq!(normalize_dir(r"E:\insuredesk-portal"), r"E:\insuredesk-portal");
            let mut workspace = crate::workspace::WorkspaceManager::new();
            let root = tempfile::tempdir().unwrap();
            let info = workspace.set_workspace_root(root.path().to_str().unwrap()).unwrap();
            assert!(!info.canonical_root.starts_with(r"\\?\"), "canonical_root must be the classic path: {}", info.canonical_root);
            assert_eq!(normalize_dir(&info.canonical_root), info.canonical_root);
        }
        #[cfg(not(windows))]
        assert_eq!(normalize_dir("/tmp/proj"), "/tmp/proj");
    }
}
