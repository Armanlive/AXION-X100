import {it} from 'node:test';
import assert from 'node:assert/strict';
import {parseWakePhrase,localGreeting,wakeAcknowledgement,detectSleepCommand,sleepAcknowledgement} from '../utils/voiceActivation.ts';
import {detectAppIntent,detectBrowserCommand,rememberBrowser,preferredBrowser} from '../services/commandService.ts';

it('wakes on greetings, wake verbs, and a sentence that starts with the name',()=>{
 for(const phrase of ['Hello AXION','Jaago AXION','utho axion','AXION jaago','जागो एक्सॉन','उठो एक्सॉन','हेलो एक्सॉन','wake up axion','उठो एक्शन'])
  assert.deepEqual(parseWakePhrase(phrase),{matched:true,remainder:''},phrase);
 assert.deepEqual(parseWakePhrase('AXION, Chrome kholo'),{matched:true,remainder:'Chrome kholo'});
 assert.deepEqual(parseWakePhrase('एक्सॉन क्रोम ओपन करो'),{matched:true,remainder:'क्रोम ओपन करो'});
 assert.deepEqual(parseWakePhrase('Jaago AXION, YouTube kholo'),{matched:true,remainder:'YouTube kholo'});
});
it('never wakes on the everyday word "action" alone or on the name mid-sentence',()=>{
 for(const phrase of ['action','एक्शन','एक्शन लो','take action now','tell me about axion','hello axionics','utho'])
  assert.equal(parseWakePhrase(phrase).matched,false,phrase);
});
it('greets on a bare wake, in English, and leaves other-language greetings to the model',()=>{
 assert.equal(localGreeting('Jaago AXION'),"I'm up. What do you need?");
 assert.ok(localGreeting('Hello AXION'));
 assert.equal(localGreeting('AXION Chrome kholo'),null,'a command is not a greeting');
 assert.equal(wakeAcknowledgement('उठो एक्सॉन'),"I'm up. What do you need?");
 assert.equal(localGreeting('नमस्ते'),null,'answered by the model in Hindi');
 assert.doesNotMatch(wakeAcknowledgement('Hello AXION'),/[ऀ-ॿ]/u);
});
it('"Chrome kholo" launches Chrome without asking web-or-desktop',()=>{
 for(const phrase of ['Chrome kholo','open chrome','क्रोम ओपन करो','एक्सॉन क्रोम ओपन करो','AXION google chrome open karo','edge chalao'])
  assert.equal(detectAppIntent(phrase)?.target,'desktop',phrase);
 assert.equal(detectAppIntent('क्रोम ओपन करो')?.app.id,'chrome');
});
it('in-browser commands open allowlisted sites and searches; chat stays chat',()=>{
 assert.deepEqual(detectBrowserCommand('YouTube kholo'),{target:'youtube',browser:undefined});
 assert.deepEqual(detectBrowserCommand('chrome mein gmail kholo'),{target:'gmail',browser:'chrome'});
 assert.deepEqual(detectBrowserCommand('google kholo'),{target:'google',browser:undefined});
 assert.deepEqual(detectBrowserCommand('google pe weather in Delhi search karo'),{target:'search',query:'weather in delhi',browser:undefined});
 assert.deepEqual(detectBrowserCommand('tauri v2 docs search karo'),{target:'search',query:'tauri v2 docs',browser:undefined});
 assert.deepEqual(detectBrowserCommand('YouTube pe lofi beats chalao'),{target:'youtube_search',query:'lofi beats',browser:undefined});
 assert.deepEqual(detectBrowserCommand('search for rust borrow checker'),{target:'search',query:'rust borrow checker',browser:undefined});
 for(const chat of ['what is youtube','how do I search an array in js?','explain the google maps api to me','refactor the header'])
  assert.equal(detectBrowserCommand(chat),null,chat);
});
it('follow-up commands land in the browser Sir just opened',()=>{
 rememberBrowser('chrome');
 assert.equal(preferredBrowser(detectBrowserCommand('YouTube kholo')!),'chrome');
 assert.equal(preferredBrowser(detectBrowserCommand('edge mein youtube kholo')!),'edge');
});

it('goes to sleep on "so jao" / "chup" / "go to sleep" in any language, and nowhere else',()=>{
  for(const t of ['AXION so jao','axion sleep','Exxon, go to sleep','chup ho jao','bhai abhi baat mat karo','सो जाओ','एक्सॉन सो जाओ','चुप हो जाओ','अभी बात मत करो','be quiet','stop listening','AXION bas','khamosh raho','AXION thodi der chup raho','मत बोलो'])
    assert.equal(detectSleepCommand(t),true,t);
  for(const t of ['sleep function kaise likhe','so what is react','chup chap ye file fix karo','bas','so','is project ko analyse karo','what is sleep apnea','bye bye world program likho'])
    assert.equal(detectSleepCommand(t),false,t);
  assert.match(sleepAcknowledgement('AXION so jao').text,/Going quiet/);
  assert.match(sleepAcknowledgement('go to sleep').text,/Going quiet/);
});
