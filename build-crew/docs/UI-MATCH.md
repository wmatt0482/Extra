# Build Crew 0.7: the family shell

Matt (Nov 2026): "the interface doesn't match the rest of the games." This is the audit behind 0.7. Spell Jump, Trail
Blazer, Fraction Fright and Wagon West were screenshotted at 390x844 and 844x390 (picker, new player, title, Parent
Zone PIN, the first in-game screen) next to Build Crew 0.6 (title, job board, new builder, PIN, job HUD, pause,
sandbox, tray). Only Build Crew's shell changed; the 3D world, machines, physics, missions and job names did not.

Theme: construction yellow on asphalt black with steel greys, Russo One (a bold, square industrial display face) over
Barlow Semi Condensed, vendored in `vendor/fonts/` (OFL) so the game still fetches no CDN. Matt asked for an older-kid
look, so the corners stay tight (6 px), there is no wobble or rotated logo bounce, and the yellow is used for the one
thing to press, like Fraction Fright's green.

| Screen | The family does | Build Crew 0.6 did | 0.7 fix |
| --- | --- | --- | --- |
| First screen | A "Who's playing?" picker every visit: a chunky "◀ Learning Lab" chip top-left, "🔒 Parents" chip top-right, the heading centred in the display face, one card per player and a dashed "New player" card with a round "+" | Opened straight on a dark editorial panel ("TAKE THE CONTROLS.", thin body text) with small outlined profile chips and "+ Add builder" | A "Who's building?" picker with the same top bar, cards (hard-hat avatar in the player's colour, jobs-done pill) and the dashed New player card; the family's players (made in any game) are listed |
| Cross-promo | "Also play: Spell Jump ▸" chips under the cards | None | The same chips (Spell Jump, Wagon West), same-origin links |
| New player | A full screen: back button, "New player", avatar, a name well with a caret, six colour swatches, the shared keyboard along the bottom | A small modal with a grey keyboard, no colour choice | The family's New player screen; the colour is the player's family colour |
| Title / home | Top bar: player chip (avatar, name, level pill) top-left, streak chip, Lab pill; the game's logo in the display face; one big primary button; a grid of beveled secondary buttons (incl. Parents and The Lab) | Header with a tiny "LEARNING LAB" wordmark and quiet buttons, a footer brand block and sound button; outlined buttons, "Job board 0 / 20" as a text link; in 844x390 the footer covered the Job board link | Family top bar (player chip with "n / 20" pill, streak chip, Lab pill, sound), "BUILD CREW" logo, big yellow "Start building", a 2- or 3-column grid: Sandbox, Job board (count on the button), Saved site, Parents, The Lab, Gallery; the 3D yard stays live behind it |
| Buttons | Chunky beveled `.btn`: display face, solid bottom edge (`box-shadow: 0 5px 0 <dark>`), press sinks | Flat outlined buttons, system font | `.btn`, `.btn-gold`, `.btn-big`, `.btn-sm`, `.icon-btn` copied from the family with the Build Crew tokens |
| Parent Zone | Dark panel in the game's colours, display-face heading, beveled PIN keys | A light cream sheet with grey keys | The family's Parent Zone skin (the shared module's classes), dark steel with yellow |
| Pause / settings | A `.card.sheet` with a heading row, a full-width primary "Resume", a row of small Sound / Music / Motion buttons | A modal with outlined buttons in a row | The same sheet: heading row with a close icon button, big Resume, Back to base, the three small toggles |
| Results / celebration | A results card: the heading in the display face, a card body, a footer row with the primary "Next" button biggest | "JOB COMPLETE" modal with outlined buttons | Same structure: heading, the reward plate on a card, the Lab strip, then Next job (primary) over Continue on site and Back to base |
| Job board | Trail Blazer's trail list: cards with the number in the accent colour, locks for what is not open yet | A modal of plain grey tiles | Card tiles with the job number in yellow, done ticks, locks; site rows as family section labels |
| In-game HUD | Translucent dark boxes with a 2 px light border, display-face numbers, beveled icon buttons for pause | Gradient slab, monospace counter, thin outlined icon buttons | Same sizes and positions (the touch layout is unchanged), restyled as family chips: beveled icon buttons, display-face job title, the count as a chip, the hint as a dark pill with a yellow edge |
| Toasts | A dark pill with an accent border in the display face, centred under the top bar | A slate box with a left accent stripe | The family toast (still placed under the hint line during a job) |
| Lab pill | In the title's top bar (and the HUD) | HUD only; the title had "The Lab" / "Gallery" text buttons in the header | In the title top bar too; The Lab and Gallery are menu buttons |
| Sound | Sound / Music / Motion in the pause sheet | A sound icon in the title footer, toggles in the pause modal | Toggles in the pause sheet as the family; the title keeps one sound icon button at the end of its top bar |
| Loading | (2D games draw at once) | "PREPARING THE SITE" editorial card | The logo and "Getting the site ready" in the family card |

Judgment calls: the 2D games put a painted backdrop behind the menus; Build Crew keeps its live 3D yard there, under a
light dark gradient so the cards read. The jobs-done pill on a player card stands in for the family's "Lv" pill. The
title keeps a sound button (0.6 had one there and a 3D game is loud), placed like the family's top-bar chips. The shared
Parent Zone draws Spell Jump's car avatars for players; that module is read-only here.
