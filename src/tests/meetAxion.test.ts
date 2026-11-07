import {it} from 'node:test';
import assert from 'node:assert/strict';
import {parseLanguageAnswer, parseHindiScript, languageRule, voiceSettingFor, preferenceLocale, LANGUAGES} from '../utils/languagePreference.ts';
import {startMeet, answerMeet, parseName, translateQuestions, builtInQuestions, GREETING, type MeetState} from '../utils/meetAxionFlow.ts';

it('recognizes languages said in English, Hinglish or their own script', () => {
  const cases: [string, object | null][] = [
    ['English', {id: 'en'}], ['I prefer english please', {id: 'en'}], ['hindi', {id: 'hi'}], ['हिंदी में', {id: 'hi'}],
    ['roman hindi', {id: 'hi', script: 'latn'}], ['Roman', {id: 'hi', script: 'latn'}], ['pure hindi', {id: 'hi', script: 'deva'}], ['शुद्ध हिंदी', {id: 'hi', script: 'deva'}],
    ['Kannada', {id: 'kn'}], ['ಕನ್ನಡ', {id: 'kn'}], ['कन्नड़ में बात करो', {id: 'kn'}], ['tamil', {id: 'ta'}], ['Telugu', {id: 'te'}],
    ['Chinese', {id: 'zh'}], ['中文', {id: 'zh'}], ['French', {id: 'fr'}], ['Japanese', {id: 'ja'}], ['日本語', {id: 'ja'}],
    ['not english, hindi', {id: 'hi'}], ['English nahi, Kannada', {id: 'kn'}], ['banana', null], ['', null],
  ];
  for (const [text, want] of cases) assert.deepEqual(parseLanguageAnswer(text), want, text);
  assert.equal(parseHindiScript('roman wali'), 'latn');
  assert.equal(parseHindiScript('प्योर हिंदी'), 'deva');
  assert.equal(parseHindiScript('pata nahi'), null);
  assert.ok(LANGUAGES.length >= 20);
});

it('maps the choice to replies, the recognizer and the voice selector', () => {
  assert.match(languageRule({id: 'hi', script: 'latn'}), /Roman Hindi/);
  assert.match(languageRule({id: 'hi', script: 'deva'}), /Devanagari/);
  assert.match(languageRule({id: 'kn'}), /Kannada/);
  assert.equal(languageRule(null), '');
  assert.equal(voiceSettingFor({id: 'hi', script: 'latn'}), 'hinglish');
  assert.equal(voiceSettingFor({id: 'hi', script: 'deva'}), 'hi');
  assert.equal(voiceSettingFor({id: 'ta'}), 'auto');
  assert.equal(preferenceLocale({id: 'kn'}), 'kn-IN');
});

it('reads a name or form of address from the answer', () => {
  assert.equal(parseName('call me Arman'), 'Arman');
  assert.equal(parseName('Mujhe Boss bulao'), 'Boss');
  assert.equal(parseName('my name is arman khan.'), 'Arman Khan');
  assert.equal(parseName('मुझे सर कहकर बुलाओ'), 'सर');
  assert.equal(parseName('skip'), 'Sir');
});

it('runs the whole Hindi conversation: language, script, name, four questions, done', () => {
  let {state, say} = startMeet();
  assert.equal(say, GREETING);
  assert.match(say, /^Hello Sir, I am AXION/);
  let r = answerMeet(state, 'Hindi');
  assert.equal(r.state.stage, 'hindiScript'); assert.match(r.say, /pure Hindi.*Roman Hindi/);
  r = answerMeet(r.state, 'roman hindi');
  assert.equal(r.needsQuestions, true); assert.deepEqual(r.state.pref, {id: 'hi', script: 'latn'});
  const q = builtInQuestions(r.state.pref!)!;
  assert.match(q.name, /Main aapko kya bulaun/);
  r = answerMeet(r.state, 'Arman', q);
  assert.equal(r.state.name, 'Arman'); assert.match(r.say, /^Shukriya Arman/);
  for (const answer of ['MIS manager at a Hyundai dealership', 'skip', 'coding aur reports', 'short aur technical']) r = answerMeet(r.state, answer, q);
  assert.equal(r.state.stage, 'done');
  assert.deepEqual(r.state.answers, {role: 'MIS manager at a Hyundai dealership', projects: '', help: 'coding aur reports', style: 'short aur technical'});
  assert.match(r.say, /Shukriya Arman/);
});

it('asks again for an unclear language, then falls back to English', () => {
  let state: MeetState = startMeet().state;
  let r = answerMeet(state, 'umm');
  assert.equal(r.state.stage, 'language'); assert.match(r.say, /did not catch/);
  r = answerMeet(r.state, 'hmm'); r = answerMeet(r.state, 'pata nahi');
  assert.equal(r.state.stage, 'name'); assert.deepEqual(r.state.pref, {id: 'en'}); assert.match(r.say, /What should I call you/);
  state = answerMeet(startMeet().state, 'kannada').state;
  assert.deepEqual(state.pref, {id: 'kn'}); assert.equal(state.stage, 'name');
});

it('translates questions with the brain for other languages, English if that fails', async () => {
  const kn = await translateQuestions({id: 'kn'}, async () => JSON.stringify({name: 'ನಿಮ್ಮನ್ನು ಏನೆಂದು ಕರೆಯಲಿ?', role: 'ಧನ್ಯವಾದ {name}. ನಿಮ್ಮ ಕೆಲಸ?', projects: 'p', help: 'h', style: 's', done: 'ಧನ್ಯವಾದ {name}.'}));
  assert.match(kn.role, /\{name\}/); assert.match(kn.name, /ಕರೆಯಲಿ/);
  const broken = await translateQuestions({id: 'fr'}, async () => 'Désolé');
  assert.match(broken.name, /we will speak in French/);
  const failing = await translateQuestions({id: 'ja'}, async () => { throw new Error('rate limited'); });
  assert.match(failing.role, /\{name\}/);
  assert.equal(await translateQuestions({id: 'en'}, async () => { throw new Error('not called'); }), builtInQuestions({id: 'en'}));
});
