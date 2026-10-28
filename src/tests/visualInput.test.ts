import {it} from 'node:test';
import assert from 'node:assert/strict';
import {validateVisualInput} from '../utils/visualInput.ts';
it('rejects invalid or oversized image payloads before invoking a provider',()=>{
 for(const data of ['', 'not base64!', 'a'.repeat(2000001)]) assert.throws(()=>validateVisualInput({mimeType:'image/jpeg',data}));
 assert.throws(()=>validateVisualInput({mimeType:'image/jpeg',data:'aGVsbG8=',codeContext:'a'.repeat(6001)}));
});
