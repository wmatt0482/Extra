p='dev.html'
s=open(p).read()
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt, (s.count(a), a[:80])
    s=s.replace(a,b)
rep("""import { TRACKS, TRACK_BY_ID } from './src/data/tracks.js';""","""import { TRACKS, TRACK_BY_ID } from './src/data/tracks.js';
import { SKY_TRACKS, SKY_TRACK_BY_ID } from './src/data/skyTracks.js';
import { SKY_RIDES, SKY_RIDE_BY_ID } from './src/data/skyRides.js';""")
rep("""for (const c of CARS) $('car').add(new Option(c.name + ' (' + c.id + ')', c.id));
for (const t of TRACKS) $('track').add(new Option(t.name + ' (' + t.id + ')', t.id));""","""for (const c of CARS.concat(SKY_RIDES)) $('car').add(new Option(c.name + ' (' + c.id + ')', c.id));
for (const t of TRACKS.concat(SKY_TRACKS)) $('track').add(new Option(t.name + ' (' + t.id + ')', t.id));
const carById = (id) => CAR_BY_ID[id] || SKY_RIDE_BY_ID[id];
const trackById = (id) => TRACK_BY_ID[id] || SKY_TRACK_BY_ID[id];""")
rep("""    <button id="powerBtn" title="game.setLaunchPower(power, nitro tank): only while parked at the ramp top">Set launch power</button>""","""    <button id="powerBtn" title="game.setLaunchPower(power, nitro tank): only while parked at the ramp top">Set launch power</button>
    <hr>
    <label>Boost word <input id="bword" type="text" placeholder="rings after the boost" autocomplete="off"></label>
    <label>Spell Boost <select id="sb"><option value="1">gate on</option><option value="0">off</option></select></label>
    <button id="b10" title="game.boost({power:1, word}) while frozen at the gate">Boost 1.0</button> <button id="b05">Boost 0.5</button> <button id="unfreeze">Unfreeze</button>""")
rep("""  const car = CAR_BY_ID[$('car').value];
  const track = TRACK_BY_ID[$('track').value];""","""  const car = carById($('car').value);
  const track = trackById($('track').value);""")
rep("""  game.start({ skin: look.skin, sticker: look.sticker, car, stats: resolveStats(car, levels), track, seed: Number($('seed').value) | 0, bestDistance: best, shake,
    letters: word ? [...word] : null, powerScale: Number($('power').value), nitroScale: Number($('nitroS').value) });""","""  game.start({ skin: look.skin, sticker: look.sticker, car, stats: resolveStats(car, levels), track, seed: Number($('seed').value) | 0, bestDistance: best, shake,
    letters: word ? [...word] : null, powerScale: Number($('power').value), nitroScale: Number($('nitroS').value), spellBoost: $('sb').value !== '0' });""")
rep("""$('letters').value = q.get('letters') || '';""","""$('letters').value = q.get('letters') || '';
// v4.0 Sky Era: ?spellboost=0 (no gate), ?bword=friend (letters of the Spell Boost rings), ?autoboost=1|0.5|none (the harness answers the
// gate by itself after ?boostdelay=<ms> of the freeze; "none" just unfreezes), the panel's buttons do the same by hand
$('bword').value = q.get('bword') || 'friend';
$('sb').value = q.get('spellboost') === '0' ? '0' : '1';""")
rep("""function onEvent(evt) {
  rr.events.push(evt);""","""function boostNow(power) {
  const ok = game.boost({ power, word: $('bword').value.trim() });
  game.freeze(false);
  return ok;
}
rr.boost = boostNow;
$('b10').onclick = () => boostNow(1);
$('b05').onclick = () => boostNow(0.5);
$('unfreeze').onclick = () => game.freeze(false);
function onEvent(evt) {
  rr.events.push(evt);
  if (evt.type === 'spellBoost' && q.get('autoboost') != null) {
    const a = q.get('autoboost'), delay = Number(q.get('boostdelay') || 900);
    setTimeout(() => { if (a === 'none') game.freeze(false); else boostNow(Number(a)); }, delay);
  }""")
open(p,'w').write(s)
