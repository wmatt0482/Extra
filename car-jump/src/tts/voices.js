// The natural (cloud) voices Spell Jump offers: Google Cloud Text-to-Speech voices on the server's allowlist
// (src/tts/server.mjs) with the friendly names shown in Parents → Options. Shared by the server and the browser.
export const CLOUD_VOICES = [
  { id: 'en-US-Neural2-F', name: 'Ava', desc: 'warm female' },
  { id: 'en-US-Neural2-D', name: 'Daniel', desc: 'calm male' },
  { id: 'en-US-Neural2-C', name: 'Clara', desc: 'bright female' },
  { id: 'en-US-Neural2-J', name: 'James', desc: 'friendly male' },
  { id: 'en-US-Studio-O', name: 'Olivia', desc: 'studio female' },
  { id: 'en-US-Studio-Q', name: 'Quinn', desc: 'studio male' },
];
export const CLOUD_VOICE_IDS = CLOUD_VOICES.map((v) => v.id);
export const DEFAULT_CLOUD_VOICE = 'en-US-Neural2-F';
export const isCloudVoice = (id) => typeof id === 'string' && CLOUD_VOICE_IDS.includes(id);
export const cloudVoiceInfo = (id) => CLOUD_VOICES.find((v) => v.id === id) || null;
