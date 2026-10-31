// Register before the shared client is constructed, so existing family sync carries this game's document.
import { registerSyncKind } from '../../../spell-jump/src/sync/client.js';
import { localWrite } from '../../../spell-jump/src/sync/notify.js';
import { saveKey, normalize, mergeBc } from './save.mjs';
export function registerSync(){registerSyncKind('bc',{storageKey:saveKey,merge:(_,a,b)=>mergeBc(a,b),canon:normalize});}
export function writeSave(id,save){if(!id)return false;try{localStorage.setItem(saveKey(id),JSON.stringify(normalize(save)));localWrite(saveKey(id));return true;}catch{return false;}}
