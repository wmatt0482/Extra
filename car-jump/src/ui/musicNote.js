// The child's Music button when a grown-up has turned background music off for the whole family
// (Parent Zone → Options → "Background music in all games"; src/spelling/profiles.js familyMusicOff, src/audio.js lockMusic).
// bindMusicButton(button, getPref): paints "Music: On/Off" from the child's own preference, or, while the family switch
// is off, "Music: Off" disabled with the note "Music is off (set by a grown-up)" under it. Returns repaint().
// When the parent turns music back on, the child's own preference applies again (it was never touched).
import { Audio } from '../audio.js';
import { familyMusicOff, setFamilyMusicOff, writeFamily } from '../spelling/profiles.js';

export const MUSIC_LOCK_NOTE = 'Music is off (set by a grown-up)';

export function bindMusicButton(btn, getPref, fmt = (on) => `Music: ${on ? 'On' : 'Off'}`) {
  if (!btn) return () => {};
  let note = null;
  const repaint = () => {
    const locked = Audio.musicLocked;
    btn.textContent = fmt(!locked && !!getPref());
    btn.disabled = locked;
    btn.setAttribute('aria-disabled', String(locked));
    if (locked && !note && btn.parentNode) {
      note = document.createElement('div');
      note.className = 'music-lock-note';
      note.setAttribute('data-music-lock-note', '');
      note.style.cssText = 'flex-basis:100%;width:100%;font-size:12px;opacity:.75;margin:4px 0 0;text-align:center;line-height:1.3';
      note.textContent = MUSIC_LOCK_NOTE;
      btn.parentNode.appendChild(note);
    } else if (!locked && note) { note.remove(); note = null; }
  };
  const off = Audio.onMusicLock(() => { if (btn.isConnected) repaint(); else { off(); if (note) note.remove(); } });   // a rebuilt menu button unsubscribes itself
  repaint();
  return repaint;
}

export const FAMILY_MUSIC_LABEL = 'Background music in all games';
export const FAMILY_MUSIC_HELP = 'Turns off the music in every game on every device in the family. Sound effects and the voice stay on.';

/** Parent Zone row helper for every game: is the family music switch On (music allowed)? */
export const familyMusicIsOn = (family) => !familyMusicOff(family);
/** The Parent Zone toggle's handler: stamp + save the family record (synced), stop / allow the music at once. */
export function setFamilyMusic(family, on) {
  setFamilyMusicOff(family, !on);
  writeFamily(family);
  Audio.lockMusic(!on);
}
