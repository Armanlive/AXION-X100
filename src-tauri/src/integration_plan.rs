//! Fixed service destinations and narrow operations; callers cannot supply arbitrary URLs.
use serde_json::{json, Value};
use reqwest::Url;

pub const SERVICES: [&str; 7] = ["github", "supabase", "gmail", "drive", "notion", "canva", "dropbox"];
pub struct Plan { pub method: &'static str, pub url: String, pub body: Option<Value>, pub raw: Option<String>, pub headers: Vec<(String,String)> }
fn text(value: &str, max: usize) -> Result<&str,String> {
 if value.trim().is_empty() || value.len()>max || value.chars().any(|c| c=='\0') {return Err("Invalid or missing operation field".into());} Ok(value)
}
fn identifier(value:&str)->Result<&str,String>{
 text(value,200)?;
 if !value.chars().all(|c|c.is_ascii_alphanumeric() || "_-".contains(c)){return Err("Invalid resource identifier".into());} Ok(value)
}
fn base64url(bytes:&[u8])->String{
 const CHARS:&[u8]=b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
 let mut output=String::new();
 for chunk in bytes.chunks(3){let a=chunk[0] as usize;let b=*chunk.get(1).unwrap_or(&0) as usize;let c=*chunk.get(2).unwrap_or(&0) as usize;
 output.push(CHARS[a>>2] as char);output.push(CHARS[((a&3)<<4)|(b>>4)] as char);
 if chunk.len()>1{output.push(CHARS[((b&15)<<2)|(c>>6)] as char);}if chunk.len()>2{output.push(CHARS[c&63] as char);}}
 output
}
pub fn plan(service:&str, operation:&str, project:&str, resource:&str, title:&str, content:&str)->Result<Plan,String>{
 if !SERVICES.contains(&service){return Err("Unknown integration".into());}
 let mut p=Plan{method:"GET",url:String::new(),body:None,raw:None,headers:vec![]};
 if operation=="verify" {
  p.url=match service {
   "github"=>"https://api.github.com/user", "gmail"=>"https://gmail.googleapis.com/gmail/v1/users/me/profile",
   "drive"=>"https://www.googleapis.com/drive/v3/about?fields=user", "notion"=>"https://api.notion.com/v1/users/me",
   "canva"=>"https://api.canva.com/rest/v1/users/me/profile", "dropbox"=>"https://api.dropboxapi.com/2/users/get_current_account",
   "supabase"=>"", _=>unreachable!()
  }.into();
  if service=="dropbox"{p.method="POST";p.body=Some(Value::Null);}
 } else if operation!="read" && operation!="write" {return Err("Unsupported operation".into());}
 if service=="supabase" {
  let url=Url::parse(project).map_err(|_|"Use your HTTPS Supabase project URL")?;
  let host=url.host_str().ok_or("Missing project host")?;
  if url.scheme()!="https" || !host.ends_with(".supabase.co") || host.split('.').count()!=3 || !url.username().is_empty() || url.password().is_some() || url.port().is_some() || url.path()!="/" || url.query().is_some() || url.fragment().is_some(){return Err("Use https://PROJECT.supabase.co without paths, credentials or ports".into());}
  identifier(resource)?;
  p.url=format!("https://{host}/rest/v1/{resource}");
  if operation=="write"{
   let row:Value=serde_json::from_str(content).map_err(|_|"Enter one JSON row object")?;
   if !row.is_object(){return Err("Enter one JSON row object".into());}
   p.method="POST";p.body=Some(row);p.headers.push(("Prefer".into(),"return=representation".into()));
  } else {p.url.push_str("?select=*&limit=10");}
 }
 if operation=="verify" {return Ok(p);}
 if operation=="read" {
  match service {
   "github"=>p.url="https://api.github.com/user/repos?per_page=10&sort=updated".into(),
   "gmail"=>p.url="https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10".into(),
   "drive"=>p.url="https://www.googleapis.com/drive/v3/files?pageSize=10&fields=files(id,name,mimeType)".into(),
   "notion"=>{p.url="https://api.notion.com/v1/search".into();p.method="POST";p.body=Some(json!({"page_size":10}));},
   "canva"=>p.url="https://api.canva.com/rest/v1/designs".into(),
   "dropbox"=>{p.url="https://api.dropboxapi.com/2/files/list_folder".into();p.method="POST";p.body=Some(json!({"path":"","limit":10}));},
   _=>{}
  }
  return Ok(p);
 }
 text(title,200)?;text(content,20000)?;
 p.method="POST";
 match service {
  "github"=>{let parts:Vec<_>=resource.split('/').collect();if parts.len()!=2{return Err("Use owner/repository".into());}identifier(parts[0])?;identifier(parts[1])?;p.url=format!("https://api.github.com/repos/{}/issues",resource);p.body=Some(json!({"title":title,"body":content}));},
  "gmail"=>{
   if resource.len()>254 || !resource.contains('@') || resource.chars().any(|c|c.is_whitespace() || c.is_control()) || title.contains(['\r','\n']){return Err("Enter one recipient email and a single-line subject".into());}
   let mime=format!("To: {}\r\nSubject: {}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n{}",resource,title,content);
   p.url="https://gmail.googleapis.com/gmail/v1/users/me/drafts".into();p.body=Some(json!({"message":{"raw":base64url(mime.as_bytes())}}));
  },
  "drive"=>{p.url="https://www.googleapis.com/drive/v3/files".into();p.body=Some(json!({"name":title,"mimeType":"application/vnd.google-apps.folder","description":content}));},
  "notion"=>{identifier(resource)?;if content.chars().count()>2000{return Err("Notion page content is limited to 2,000 characters per request".into());}p.url="https://api.notion.com/v1/pages".into();p.body=Some(json!({"parent":{"page_id":resource},"properties":{"title":{"type":"title","title":[{"type":"text","text":{"content":title}}]}},"children":[{"object":"block","type":"paragraph","paragraph":{"rich_text":[{"type":"text","text":{"content":content}}]}}]}));},
  "canva"=>{p.url="https://api.canva.com/rest/v1/designs".into();p.body=Some(json!({"design_type":{"type":"custom","width":1080,"height":1080},"title":title}));},
  "dropbox"=>{identifier(title)?;p.url="https://content.dropboxapi.com/2/files/upload".into();p.raw=Some(content.into());p.headers.push(("Dropbox-API-Arg".into(),json!({"path":format!("/AXION/{}.txt",title),"mode":"add","autorename":true,"mute":false}).to_string()));},
  _=>{}
 }
 Ok(p)
}
#[cfg(test)] mod tests {
 use super::*;
 #[test]fn mime_encoding(){assert_eq!(base64url(b"hello"),"aGVsbG8");assert!(plan("gmail","write","","a@example.com","Injected\r\nBcc: b@example.com","body").is_err());}
 #[test]fn fixed_destinations(){for service in SERVICES{let p=plan(service,"verify","https://example.supabase.co","records","","").unwrap();assert!(p.url.starts_with("https://"));}}
 #[test]fn rejects_ssrf_and_unknown_operations(){for url in ["http://example.supabase.co","https://example.supabase.co.evil.test","https://user@example.supabase.co","https://example.supabase.co/path","https://127.0.0.1"]{assert!(plan("supabase","read",url,"records","","").is_err());}assert!(plan("github","delete","","","","").is_err());assert!(plan("github","write","","../repo","title","body").is_err());}
 #[test]fn writes_are_narrow_and_gmail_only_drafts(){for service in SERVICES{let content=if service=="supabase"{"{}"}else{"Ym9keQ"};let resource=if service=="github"{"owner/repo"}else if service=="gmail"{"user@example.com"}else{"records"};let p=plan(service,"write","https://example.supabase.co",resource,"Title",content).unwrap();assert_eq!(p.method,"POST");if service=="gmail"{assert!(p.url.ends_with("/drafts"));}if service=="dropbox"{assert!(p.headers[0].1.contains("autorename"));}}}
}
