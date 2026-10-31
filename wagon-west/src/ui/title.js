// The title (SPEC §12): the map with the trail drawn to the party's position and the next stop named, "Hit the trail"
// (or "Keep going" mid-leg, "Pack the wagon" before the first leg, "A new season" in the valley), Journal, Outfit,
// Parents; the streak flame (Spell Jump's streak rule: a day counts once a leg is finished) and the week's words count
// (the child's Spell Jump list, practised at the rivers and in the letters). The player chip goes back to the picker.
// v1.1: the daily trail challenge under the map ("Today's challenge: …", a check mark once done: the token and the
// card are given the moment it is done, main.js app.daily()); a tap reads it aloud.
// v1.2: the wagon's name and what the three companions are good at under the logo ("Ada fixes wheels · Eli scouts · Rosa
// stretches the food"), and the family's other wagons as small wagons at their stops on the map (tap one: whose it is).
import { $, h, money } from '../../../spell-jump/src/ui/dom.js';
import { streakNow } from '../../../spell-jump/src/meta/engagement.js';
import { drawMap } from './map.js';
import { drawAvatar } from './players.js';

export function createTitle(app) {
  const map = $('#title-map');
  const line = $('#title-next');
  const go = $('#btn-trail');
  function show() {
    const p = app.player;
    if (!p) return;
    $('#title-player').textContent = p.name;
    drawAvatar($('#title-avatar'), p.color);
    const save = app.save, J = save.journey;
    const st = streakNow(save.streak, Date.now());
    const flame = $('#title-streak');
    flame.dataset.count = String(st);
    $('#title-streak-n').textContent = String(st);
    flame.setAttribute('aria-label', st ? `${st}-day streak` : 'Streak: finish a leg today to start one');
    const words = app.weekWords();
    $('#title-words-n').textContent = String(words);
    $('#title-words').setAttribute('aria-label', `${words} spelling words this week`);
    const legs = app.legs;
    const inLeg = !!(save.trip && J && save.trip.legId === J.legId);
    const r = drawMap(map, { legs, J, inLeg, paint: app.paintColor(), family: app.familyWagons(), onFamily: (f) => app.toast(`${f.name}'s wagon`) });
    const season = app.season();
    let label = 'Hit the trail', text = '';
    if (!J) { label = 'Pack the wagon'; text = `${season.year}: ${legs.length} stops from ${(legs[0] && legs[0].from) || 'Independence'} to the valley`; }
    else if (J.done) { label = 'A new season'; text = `${save.homestead ? `${save.homestead} · ` : ''}You made it to the valley!`; }
    else if (inLeg) {
      const leg = legs[J.legIndex] || {};
      label = 'Keep going';
      text = save.trip.stage === 'stop' ? `At ${leg.stop ? leg.stop.name : leg.name}` : `On the way to ${leg.stop ? leg.stop.name : leg.name} · ${money(Math.max(0, (leg.miles || 0) - (J.milesDone || 0)))} mi to go`;
    } else {
      const leg = legs[J.legIndex] || {};
      text = `Next: ${leg.stop ? leg.stop.name : leg.name} · ${money(leg.miles || 0)} mi`;
    }
    line.textContent = text;
    $('#btn-trail-label').textContent = label;
    go.dataset.action = !J ? 'outfit' : J.done ? 'season' : 'trail';
    map.setAttribute('aria-label', r.next ? `The trail map. Next stop: ${r.next.name}.` : 'The trail map.');
    $('#title-season').textContent = `${J && J.wagonName ? `${J.wagonName} · ` : ''}${season.year} · ${season.name}`;
    const crew = J ? (J.companions && J.companions.length ? J.companions : (J.party || []).map((p) => p.id)) : [];
    const skills = app.partyLine(crew);
    const sk = $('#title-skills');
    sk.hidden = !skills;
    sk.textContent = skills;
    $('#btn-outfit').disabled = false;
    const dc = app.daily();
    const ch = $('#title-challenge');
    ch.hidden = !dc;
    if (dc) {
      ch.dataset.done = String(!!dc.done);
      ch.replaceChildren(h('span', { class: 'tch-mark', 'aria-hidden': 'true', html: dc.done ? app.icon('check') : app.icon('target') }),
        h('span', { class: 'tch-text' }, h('b', {}, "Today's challenge: "), dc.text));
      ch.setAttribute('aria-label', `Today's challenge: ${dc.text}${dc.done ? '. Done!' : ''}`);
    }
  }
  $('#title-challenge').addEventListener('click', () => { const dc = app.daily(); if (dc) app.say(dc.say || dc.text); });
  return { show, hide() {} };
}

/** A face for a mood (inline SVG): happy / fine / tired; never a health bar. */
export function moodFace(mood = 'happy', color = '#d9653b') {
  const mouth = mood === 'happy' ? '<path d="M8 14.5q4 4 8 0" fill="none" stroke="#3a2416" stroke-width="2" stroke-linecap="round"/>'
    : mood === 'fine' ? '<path d="M8.5 15h7" stroke="#3a2416" stroke-width="2" stroke-linecap="round"/>'
      : '<path d="M8.5 15.5q3.5-2 7 0" fill="none" stroke="#3a2416" stroke-width="2" stroke-linecap="round"/>';
  const eyes = mood === 'tired' ? '<path d="M7 10h3M14 10h3" stroke="#3a2416" stroke-width="2" stroke-linecap="round"/>' : '<circle cx="8.5" cy="10" r="1.6" fill="#3a2416"/><circle cx="15.5" cy="10" r="1.6" fill="#3a2416"/>';
  return h('span', { class: `face m-${mood}`, html: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="#f4d3ad" stroke="${color}" stroke-width="3"/>${eyes}${mouth}</svg>` });
}
