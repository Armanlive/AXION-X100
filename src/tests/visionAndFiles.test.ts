import {it} from 'node:test';
import assert from 'node:assert/strict';
import {zipSync, strToU8} from 'fflate';
import {parseWakePhrase, isNoiseTranscript} from '../utils/voiceActivation.ts';
import {detectVisualIntent, parseConsentAnswer, VisualConsentSession} from '../services/visionCapture.ts';
import {xlsxToText, docxToText, pptxToText, zipToText, asText} from '../utils/attachmentReader.ts';
import {validateAttachments} from '../utils/visualInput.ts';

it('wakes on the many ways a recognizer spells AXION', () => {
  for (const phrase of ['Hello Axon', 'hello exxon', 'Axion jaago', 'एक्सॉन जागो', 'एक्सॉन उठो', 'हेलो एक्सन', 'अरे एक्सियन', 'हैलो ऐक्शन', 'hey aksion', 'Axon suno', 'जाग जाओ एक्सॉन'])
    assert.equal(parseWakePhrase(phrase).matched, true, phrase);
  assert.deepEqual(parseWakePhrase('Axon, screen pe kya dikh raha hai?'), {matched: true, remainder: 'screen pe kya dikh raha hai?'});
  for (const phrase of ['action movie dikhao', 'एक्शन लो', 'oxen are big', 'taxonomy']) assert.equal(parseWakePhrase(phrase).matched, false, phrase);
});

it('recognizes "what is on my screen" and camera requests, not ordinary chat', () => {
  for (const ask of ['screen pe kya dikh raha hai', 'tumhe screen par kya dikh raha hai', 'स्क्रीन पे क्या दिख रहा है', 'meri screen dekho', 'look at my screen', "what's on my screen", 'what am I using right now', 'ye error dekho aur fix batao', 'screenshot leke dekho'])
    assert.equal(detectVisualIntent(ask), 'screen', ask);
  for (const ask of ['camera se dekho maine haath mein kya rakha hai', 'कैमरा से देखो', 'maine kya pehna hai', 'what am I holding', 'use the camera and look at me', 'हाथ में क्या है'])
    assert.equal(detectVisualIntent(ask), 'camera', ask);
  for (const chat of ['make the screen reader accessible', 'screen size responsive check karo css mein', 'camera component banao react mein', 'fix the login error', 'what is a screen?'])
    assert.equal(detectVisualIntent(chat), null, chat);
});

it('catches "can you see my screen" questions exactly as Sir asked them', () => {
  for (const ask of ['क्या तुम स्क्रीन देख सकते हो', 'एक्सान क्या तुम स्क्रीन देख सकते हो', 'kya tum screen dekh sakte ho', 'screen padh sakte ho?', 'can you see my screen'])
    assert.equal(detectVisualIntent(parseWakePhrase(ask).matched ? parseWakePhrase(ask).remainder : ask), 'screen', ask);
});

it('silence and noise transcripts never reach the model', () => {
  for (const noise of ['.', ' ', 'So', 'so.', 'you', 'Thank you.', 'Thanks for watching!', '…']) assert.equal(isNoiseTranscript(noise), true, noise);
  for (const real of ['ok', 'haan', 'Chrome kholo', 'हाँ', 'no']) assert.equal(isNoiseTranscript(real), false, real);
});

it('consent: yes sends once, always remembers, no sends nothing, stale answers expire', () => {
  assert.equal(parseConsentAnswer('haan'), 'once');
  assert.equal(parseConsentAnswer('हाँ भेजो'), 'once');
  assert.equal(parseConsentAnswer('hamesha'), 'always');
  assert.equal(parseConsentAnswer('nahi'), 'no');
  assert.equal(parseConsentAnswer('explain the architecture of this project please'), null);
  let now = 0; const session = new VisualConsentSession(1000, () => now);
  session.ask('screen', 'screen pe kya hai');
  assert.deepEqual(session.resolve('haan'), {source: 'screen', prompt: 'screen pe kya hai'});
  assert.equal(session.resolve('haan'), null, 'consumed once');
  session.ask('camera', 'camera se dekho'); assert.equal(session.resolve('nahi'), 'declined');
  session.ask('camera', 'camera se dekho'); now = 5000; assert.equal(session.resolve('haan'), null, 'expired');
});

it('reads Excel, Word, PowerPoint and ZIP contents as text', () => {
  const xlsx = zipSync({
    'xl/workbook.xml': strToU8('<workbook><sheets><sheet name="Sales" sheetId="1"/></sheets></workbook>'),
    'xl/sharedStrings.xml': strToU8('<sst><si><t>Item</t></si><si><t>Qty, units</t></si><si><t>Pens &amp; ink</t></si></sst>'),
    'xl/worksheets/sheet1.xml': strToU8('<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>42</v></c></row></sheetData></worksheet>'),
  });
  assert.equal(xlsxToText(xlsx), '## Sheet: Sales\nItem,"Qty, units"\nPens & ink,,42');
  const docx = zipSync({'word/document.xml': strToU8('<w:document><w:body><w:p><w:r><w:t>Hello</w:t></w:r><w:r><w:t xml:space="preserve"> Sir</w:t></w:r></w:p><w:p><w:r><w:t>Line 2</w:t></w:r></w:p></w:body></w:document>')});
  assert.equal(docxToText(docx), 'Hello Sir\nLine 2');
  const pptx = zipSync({'ppt/slides/slide2.xml': strToU8('<p:sld><a:t>Second</a:t></p:sld>'), 'ppt/slides/slide1.xml': strToU8('<p:sld><a:t>Title</a:t><a:t>Sub</a:t></p:sld>')});
  assert.equal(pptxToText(pptx), '## Slide 1\nTitle Sub\n\n## Slide 2\nSecond');
  const zip = zipSync({'src/app.ts': strToU8('export const x = 1;'), 'logo.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0]), 'node_modules/a/index.js': strToU8('ignored()')});
  const listing = zipToText(zip);
  assert.match(listing, /Archive with 3 file\(s\)/);
  assert.match(listing, /### src\/app\.ts\nexport const x = 1;/);
  assert.doesNotMatch(listing, /ignored\(\)/);
  assert.equal(asText(new Uint8Array([0x89, 0x50, 0, 1])), null, 'binary is not text');
});

it('attachment limits keep one request under the native 8 MB cap', () => {
  assert.doesNotThrow(() => validateAttachments([{name: 'a.pdf', mimeType: 'application/pdf', size: 10, data: 'QUJD'}, {name: 'b.csv', mimeType: 'text/csv', size: 3, text: 'a,b'}]));
  assert.throws(() => validateAttachments([{name: 'big.pdf', mimeType: 'application/pdf', size: 1, data: 'A'.repeat(7_000_000)}]), /too large/);
  assert.throws(() => validateAttachments([{name: 'x.exe', mimeType: 'application/x-msdownload', size: 1, data: 'QUJD'}]), /unsupported/);
  assert.throws(() => validateAttachments(Array.from({length: 9}, (_, i) => ({name: `f${i}.txt`, mimeType: 'text/plain', size: 1, text: 'x'}))), /at most 8/);
});
