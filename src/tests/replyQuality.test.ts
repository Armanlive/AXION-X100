import {it} from 'node:test';
import assert from 'node:assert/strict';
import {assessReply} from '../utils/replyQuality.ts';
import {isNoiseTranscript} from '../utils/voiceActivation.ts';

const ask = 'bhai html css js se ek calculator banao wo bhi modern glass look me single page me';

it('catches a tool call AXION does not have (the silent "On it.")', () => {
  const p = assessReply('<|tool_call_start|>[create_file(path="calculator.html")]<|tool_call_end|>', ask, {editsAllowed: false});
  assert.equal(p?.kind, 'unsupported-tool');
  assert.match(p!.followUp, /"create_file"/);
  assert.match(p!.followUp, /full working code in a Markdown code block/);
});

it('catches "Creating it now" with no code and no edits', () => {
  const raw = JSON.stringify({text: "Sorry, I didn't act on it earlier — I need to propose the file first. Creating a single-file glassmorphism calculator now.", speechText: 'x'});
  const p = assessReply(raw, ask, {editsAllowed: true});
  assert.equal(p?.kind, 'empty-promise');
  assert.match(p!.followUp, /Deliver it now/);
  assert.match(p!.followUp, /"edits"/);
});

it('accepts real deliveries and ordinary chat', () => {
  const code = JSON.stringify({text: 'Here it is:\n```html\n<!doctype html><html><body><div class="calc">…lots of calculator markup here…</div></body></html>\n```', speechText: 'Here it is.'});
  assert.equal(assessReply(code, ask, {editsAllowed: false}), null);
  const edits = JSON.stringify({text: 'Creating calculator.html now.', speechText: 'x', edits: [{path: 'calculator.html', content: '<!doctype html>'}]});
  assert.equal(assessReply(edits, ask, {editsAllowed: true}), null);
  const action = JSON.stringify({text: 'Opening Excel now.', speechText: 'x', action: {type: 'open_app', name: 'Excel'}});
  assert.equal(assessReply(action, 'excel kholo', {editsAllowed: false}), null);
  const chat = JSON.stringify({text: "I'll explain: closures capture variables from their scope.", speechText: 'x'});
  assert.equal(assessReply(chat, 'what is a closure?', {editsAllowed: false}), null, 'not a build request');
});

it('ignores misheard one-word fragments but keeps real short answers', () => {
  for (const t of ['Ech.', 'hm', 'Ah']) assert.equal(isNoiseTranscript(t), true, t);
  for (const t of ['yes', 'no', 'ok', 'हाँ', 'Chrome kholo', 'fix']) assert.equal(isNoiseTranscript(t), false, t);
});
