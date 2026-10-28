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

#[cfg(test)]mod tests{use super::*;#[test]fn invalid_identity_does_not_count_as_authenticated(){assert!(!valid_identity("github",&serde_json::json!({"message":"not authorized"})));assert!(valid_identity("supabase",&serde_json::json!([])));}
#[test]fn summaries_never_return_raw_api_bodies(){let result=summarize("github","read",serde_json::json!([{ "id":1,"name":"project","token":"must-not-be-exposed" }]));let text=serde_json::to_string(&result).unwrap();assert!(text.contains("project"));assert!(!text.contains("must-not-be-exposed"));}}
