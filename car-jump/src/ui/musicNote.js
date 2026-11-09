// The child's Music button when a grown-up has turned background music off for the whole family
// (Parent Zone → Options → "Background music in all games"; src/spelling/profiles.js familyMusicOff, src/audio.js lockMusic).
// bindMusicButton(button, getPref): paints "Music: On/Off" from the child's own preference, or, while the family switch
// is off, "Music: Off" disabled with the note "Music is off (set by a grown-up)" under it. Returns repaint().
// When the parent turns music back on, the child's own preference applies again (it was never touched).
import { Audio } from '../audio.js';

export const MUSIC_LOCK_NOTE = 'Music is off (set by a grown-up)';

export function bindMusicButton(btn, getPref, label = 'Music') {
  if (!btn) return () => {};
  let note = null;
  const repaint = () => {
    const locked = Audio.musicLocked;
    btn.textContent = `${label}: ${!locked && getPref() ? 'On' : 'Off'}`;
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
  Audio.onMusicLock(repaint);
  repaint();
  return repaint;
}
