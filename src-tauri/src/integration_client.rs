use std::time::Duration;
use serde::{Serialize,Deserialize};
use serde_json::Value;
use crate::integration_plan::plan;
#[derive(Clone,Serialize,Deserialize)]
pub struct Connection {pub service:String,pub token:String,pub project:String,pub resource:String}
#[derive(Serialize)]
pub struct Item {id:String,title:String}
#[derive(Serialize)]
pub struct ResultData {pub summary:String,items:Vec<Item>}
pub async fn execute(connection:&Connection,operation:&str,resource:&str,title:&str,content:&str)->Result<Value,String>{
 let p=plan(&connection.service,operation,&connection.project,resource,title,content)?;
 let client=reqwest::Client::builder().redirect(reqwest::redirect::Policy::none()).timeout(Duration::from_secs(20)).build().map_err(|_|"Cannot initialize integration client")?;
 let method=reqwest::Method::from_bytes(p.method.as_bytes()).map_err(|_|"Invalid method")?;
 let mut request=client.request(method,p.url).bearer_auth(&connection.token).header("User-Agent","AXION-X100/1.0");
 if connection.service=="supabase"{request=request.header("apikey",&connection.token);}
 if connection.service=="notion"{request=request.header("Notion-Version","2022-06-28");}
 for (name,value) in p.headers{request=request.header(name,value);}
 if let Some(body)=p.body{request=request.json(&body);}
 if let Some(raw)=p.raw{request=request.header("Content-Type","application/octet-stream").body(raw);}
 let mut response=request.send().await.map_err(|_|"Integration connection failed. Check network access and reconnect.")?;
 if !response.status().is_success(){return Err(format!("{} API returned HTTP {}. Check token permissions or reconnect; no success was confirmed.",connection.service,response.status().as_u16()));}
 let mut bytes=Vec::new();
 while let Some(chunk)=response.chunk().await.map_err(|_|"Incomplete API response")?{if bytes.len()+chunk.len()>2_000_000{return Err("API response exceeds limit".into());}bytes.extend_from_slice(&chunk);}
 let value:Value=serde_json::from_slice(&bytes).map_err(|_|"API returned an unreadable response")?;
 if value.get("error").is_some() || value["object"]=="error"{return Err("The service rejected this operation; reconnect or check permissions".into());}
 if operation=="verify" && !valid_identity(&connection.service,&value){return Err("The service did not return a verifiable identity or table response".into());}
 Ok(value)
}
fn valid_identity(service:&str,value:&Value)->bool{
 match service{
 "github"=>value["login"].as_str().is_some(),"gmail"=>value["emailAddress"].as_str().is_some(),
 "drive"=>value["user"].is_object(),"notion"=>value["object"]=="user" && value["id"].as_str().is_some(),
 "canva"=>value["profile"].is_object(),"dropbox"=>value["account_id"].as_str().is_some(),"supabase"=>value.is_array(),_=>false
 }
}
pub fn summarize(service:&str,operation:&str,value:Value)->ResultData{
 let rows=value.as_array().cloned().or_else(||["files","messages","results","items","entries"].iter().find_map(|key|value[*key].as_array().cloned())).unwrap_or_else(||if operation=="read"{vec![]}else{vec![value]});
 let items=rows.iter().take(10).map(|row|Item{id:row["id"].as_str().map(str::to_string).unwrap_or_else(||row["id"].to_string()).chars().take(150).collect(),title:row["name"].as_str().or(row["title"].as_str()).or(row["full_name"].as_str()).or(row["emailAddress"].as_str()).or(row["login"].as_str()).unwrap_or("Accessible resource").chars().take(200).collect()}).collect();
 ResultData{summary:format!("{} {} succeeded.",service,if operation=="verify"{"authentication"}else if operation=="write"{"creation"}else{"read"}),items}
}

/// Unread inbox mail for proactive alerts: sender, subject and Gmail's IMPORTANT label only.
#[derive(Serialize,Debug,PartialEq)]
#[serde(rename_all="camelCase")]
pub struct MailAlert {pub id:String,pub from:String,pub subject:String,pub important:bool,pub received_ms:i64}
async fn gmail_json(client:&reqwest::Client,token:&str,url:&str)->Result<Value,String>{
 let response=client.get(url).bearer_auth(token).header("User-Agent","AXION-X100/1.0").send().await.map_err(|_|"Gmail check failed. Check network access.")?;
 if !response.status().is_success(){return Err(format!("Gmail returned HTTP {}. Reconnect Gmail in Plugins.",response.status().as_u16()));}
 let bytes=response.bytes().await.map_err(|_|"Incomplete Gmail response")?;
 if bytes.len()>1_000_000{return Err("Gmail response exceeds limit".into());}
 serde_json::from_slice(&bytes).map_err(|_|"Gmail returned an unreadable response".into())
}
/// Parses one `format=metadata` message; None when it is malformed.
pub fn mail_alert(value:&Value)->Option<MailAlert>{
 let id=value["id"].as_str().filter(|id|!id.is_empty()&&id.len()<=64&&id.chars().all(|c|c.is_ascii_alphanumeric()))?;
 let header=|name:&str|value["payload"]["headers"].as_array().and_then(|h|h.iter().find(|x|x["name"].as_str().is_some_and(|n|n.eq_ignore_ascii_case(name)))).and_then(|x|x["value"].as_str()).unwrap_or("").chars().filter(|c|!c.is_control()).take(200).collect::<String>();
 let important=value["labelIds"].as_array().is_some_and(|l|l.iter().any(|x|x=="IMPORTANT"));
 let received_ms=value["internalDate"].as_str().and_then(|d|d.parse().ok()).unwrap_or(0);
 Some(MailAlert{id:id.into(),from:header("From"),subject:header("Subject"),important,received_ms})
}
pub async fn gmail_unread(token:&str)->Result<Vec<MailAlert>,String>{
 let client=reqwest::Client::builder().redirect(reqwest::redirect::Policy::none()).timeout(Duration::from_secs(20)).build().map_err(|_|"Cannot initialize Gmail client")?;
 let list=gmail_json(&client,token,"https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is%3Aunread%20in%3Ainbox%20newer_than%3A1d&maxResults=10").await?;
 let mut alerts=Vec::new();
 for id in list["messages"].as_array().into_iter().flatten().filter_map(|m|m["id"].as_str()).take(10){
  if !id.chars().all(|c|c.is_ascii_alphanumeric())||id.len()>64{continue;}
  let url=format!("https://gmail.googleapis.com/gmail/v1/users/me/messages/{id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject");
  if let Some(alert)=mail_alert(&gmail_json(&client,token,&url).await?){alerts.push(alert);}
 }
 Ok(alerts)
}

#[cfg(test)]mod tests{use super::*;#[test]fn invalid_identity_does_not_count_as_authenticated(){assert!(!valid_identity("github",&serde_json::json!({"message":"not authorized"})));assert!(valid_identity("supabase",&serde_json::json!([])));}
#[test]fn mail_alerts_keep_only_sender_subject_and_importance(){
 let msg=serde_json::json!({"id":"18c2abc","labelIds":["UNREAD","IMPORTANT"],"internalDate":"1700000000000","snippet":"secret body","payload":{"headers":[{"name":"From","value":"Boss <boss@example.com>"},{"name":"subject","value":"Need\r\nthis today"}]}});
 assert_eq!(mail_alert(&msg),Some(MailAlert{id:"18c2abc".into(),from:"Boss <boss@example.com>".into(),subject:"Needthis today".into(),important:true,received_ms:1700000000000}));
 assert!(!serde_json::to_string(&mail_alert(&msg)).unwrap().contains("secret body"));
 assert_eq!(mail_alert(&serde_json::json!({"id":"../x"})),None);}
#[test]fn summaries_never_return_raw_api_bodies(){let result=summarize("github","read",serde_json::json!([{ "id":1,"name":"project","token":"must-not-be-exposed" }]));let text=serde_json::to_string(&result).unwrap();assert!(text.contains("project"));assert!(!text.contains("must-not-be-exposed"));}}
