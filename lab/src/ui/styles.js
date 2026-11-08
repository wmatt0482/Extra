// The Lab's stylesheet, as one string (installStyles() puts it in a <style>): the house look of the other games (deep navy panels, chunky buttons with
// a hard edge, big rounded type) with the Lab's teal as its own accent. Everything is scoped under .lab-root so it can sit on top of any game page.
export const CSS = `
.lab-root{--ink:#0d1230;--ink-2:#151c45;--panel:#1b2357;--panel-2:#24307a;--line:#34418f;--text:#fff;--muted:#aab4ee;--dim:#7d89cc;
--accent:#ffcf1a;--accent-edge:#b98200;--accent-ink:#2a1a00;--lab:#37e0c0;--lab-edge:#12806f;--lab-ink:#04271f;--hot:#ff3b5c;--hot-edge:#a8173a;
--go:#2fd36b;--go-edge:#13803c;--cyan:#22d3ff;--cyan-edge:#0a7fa6;--violet:#8f6bff;
--font-display:'Bungee','Arial Black','Trebuchet MS',system-ui,-apple-system,'Segoe UI',sans-serif;
--font-body:'Rubik',ui-rounded,'SF Pro Rounded',system-ui,-apple-system,'Segoe UI',sans-serif;
--r:16px;--r-sm:11px;--edge:5px;
--pad-t:max(10px,env(safe-area-inset-top,0px));--pad-r:max(14px,env(safe-area-inset-right,0px));--pad-b:max(8px,env(safe-area-inset-bottom,0px));--pad-l:max(14px,env(safe-area-inset-left,0px));
font-family:var(--font-body);font-weight:500;color:var(--text);-webkit-text-size-adjust:100%;line-height:1.25}
:where(.lab-root),:where(.lab-root) *,:where(.lab-root) *::before,:where(.lab-root) *::after{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.lab-root [hidden]{display:none!important}
:where(.lab-root) button{font:inherit;color:inherit;border:0;background:none;padding:0;cursor:pointer;touch-action:manipulation;text-align:inherit}
.lab-root button:focus-visible,.lab-root a:focus-visible,.lab-root input:focus-visible+.lab-switch-ui{outline:3px solid var(--cyan);outline-offset:3px}
:where(.lab-root) svg{flex:none}
:where(.lab-root) :is(h1,h2,h3,h4,p,figure){margin:0}
:where(.lab-root) canvas{display:block}

/* ---------- the page ---------- */
.lab-page{position:fixed;inset:0;overflow:hidden;background:radial-gradient(70% 40% at 85% 6%,rgba(255,244,190,.75) 0%,transparent 60%),linear-gradient(180deg,#4f86e6 0%,#7cc3ee 34%,#bfe9e0 66%,#f7dfae 100%);user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.lab-page-in{height:100%;display:flex;flex-direction:column}
.lab-overlay{position:fixed;inset:0;height:100vh;height:100dvh;max-height:100%;z-index:99999;outline:none;user-select:none;-webkit-user-select:none;overscroll-behavior:contain;
background-image:radial-gradient(70% 40% at 85% 6%,rgba(255,244,190,.75) 0%,transparent 60%),linear-gradient(180deg,#4f86e6 0%,#7cc3ee 34%,#bfe9e0 66%,#f7dfae 100%);background-color:#7cc3ee}
html.lab-open,html.lab-open body{overscroll-behavior:none}

/* ---------- buttons, cards, bars ---------- */
.lab-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 18px;border-radius:var(--r-sm);text-decoration:none;white-space:nowrap;
font:400 15px/1 var(--font-display);letter-spacing:.02em;color:#fff;background:var(--panel-2);box-shadow:0 4px 0 #070a22,inset 0 -3px 0 rgba(0,0,0,.18),inset 0 2px 0 rgba(255,255,255,.14);transition:transform .06s,box-shadow .06s}
.lab-btn:active{transform:translateY(3px);box-shadow:0 1px 0 #070a22,inset 0 -3px 0 rgba(0,0,0,.18)}
.lab-btn[disabled]{filter:grayscale(.7) brightness(.8);cursor:default}
.lab-btn[disabled]:active{transform:none;box-shadow:0 4px 0 #070a22}
.lab-btn svg{width:20px;height:20px}
.lab-btn .coin{width:20px;height:20px}
.lab-btn-sm{min-height:44px;padding:0 13px;font-size:13px}
.lab-btn-go{background:var(--go);color:#062a12;box-shadow:0 4px 0 var(--go-edge),inset 0 2px 0 rgba(255,255,255,.4)}
.lab-btn-gold{background:var(--accent);color:var(--accent-ink);box-shadow:0 4px 0 var(--accent-edge),inset 0 2px 0 rgba(255,255,255,.5)}
.lab-btn-hot{background:var(--hot);box-shadow:0 4px 0 var(--hot-edge),inset 0 2px 0 rgba(255,255,255,.35)}
.lab-btn-on{background:var(--lab);color:var(--lab-ink);box-shadow:0 4px 0 var(--lab-edge),inset 0 2px 0 rgba(255,255,255,.4)}
.lab-icon-btn{width:48px;min-width:48px;padding:0}
.lab-btn-row{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;align-items:center}
.lab-card{background:var(--panel);border:2px solid var(--line);border-radius:var(--r);box-shadow:0 5px 0 rgba(0,0,0,.35);padding:12px}
.lab-h{font:400 17px/1.1 var(--font-display);letter-spacing:.02em;text-transform:uppercase;color:var(--lab);margin-bottom:8px}
.lab-small{font-size:13px;font-weight:600;color:var(--muted)}
.lab-p{font-size:14px;line-height:1.4;color:var(--muted);margin:6px 0}
.lab-empty{padding:26px 10px;text-align:center;color:var(--muted);font-weight:600}
.lab-empty-card{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;padding:26px 16px;color:var(--muted);font-weight:600;max-width:460px;margin:20px auto}
.lab-empty-ic svg{width:48px;height:48px;color:var(--lab)}
.lab-bar{display:block;height:10px;border-radius:6px;background:rgba(0,0,0,.35);overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,.4)}
.lab-bar>i{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,var(--lab),#7bf0d6);transition:width .5s ease}
.lab-check{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;background:var(--go);color:#062a12;flex:none}
.lab-check svg{width:18px;height:18px}
.lab-check.big{width:38px;height:38px}
.lab-note-ok{display:inline-flex;align-items:center;gap:8px;color:#8ff0b3;font-weight:700}
.lab-note-ok svg{width:20px;height:20px}
.lab-pips{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:var(--muted)}
.lab-pips i{width:16px;height:16px;border-radius:50%;border:3px solid var(--dim);flex:none}
.lab-pips i.on{background:var(--accent);border-color:var(--accent);box-shadow:0 0 10px rgba(255,207,26,.6)}
.lab-pips.big i{width:26px;height:26px}
.lab-rarity{display:inline-block;padding:3px 9px 2px;border-radius:999px;font:700 11px/1.2 var(--font-body);letter-spacing:.06em;text-transform:uppercase;background:#2c3678;color:#cfd6ff}
.lab-rarity.r-r{background:#164f7c;color:#9fe0ff}
.lab-rarity.r-e{background:#5a2a9c;color:#ffd6ff;box-shadow:0 0 0 1px #ffcf1a inset}

/* ---------- shell ---------- */
.lab-shell{position:relative;width:100%;height:100%;max-width:1320px;margin:0 auto;display:flex;flex-direction:column;padding:var(--pad-t) var(--pad-r) 0 var(--pad-l)}
.lab-top{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;padding:8px 10px;margin-bottom:6px;border-radius:20px;background:rgba(13,18,48,.88);box-shadow:0 4px 0 rgba(13,40,80,.25)}
.lab-chip{display:inline-flex;align-items:center;gap:8px;min-height:48px;padding:0 14px 0 4px;border-radius:999px;background:var(--ink-2);border:3px solid var(--c,var(--line));max-width:180px;min-width:0;font:400 14px/1 var(--font-display)}
.lab-chip-cv{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.08);flex:none}
.lab-chip-name{white-space:normal;overflow-wrap:break-word;line-height:1.05;font-size:13px;min-width:0}
.lab-lvblock{flex:1 1 240px;min-width:170px;display:flex;flex-direction:column;gap:5px}
.lab-lvrow{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap}
.lab-lv{font:400 15px/1 var(--font-display);text-transform:uppercase;letter-spacing:.02em}
.lab-xp-tx{font-size:13px;font-weight:700;color:var(--muted)}
.lab-bar-xp{height:12px}
.lab-purse{display:inline-flex;align-items:center;gap:6px;height:44px;padding:0 14px 0 8px;border-radius:999px;background:var(--ink);border:2px solid var(--line);font:400 17px/1 var(--font-display);color:var(--accent)}
.lab-purse .coin{width:26px;height:26px}
.lab-streak{display:inline-flex;align-items:center;gap:6px;height:44px;padding:0 10px;border-radius:999px;background:var(--ink);border:2px solid var(--line);font:400 16px/1 var(--font-display)}
.lab-flame svg{width:24px;height:24px;color:#5a6292}
.lab-flame.on svg{color:#ff9a3c;filter:drop-shadow(0 0 5px rgba(255,150,50,.7))}
.lab-freeze svg{width:20px;height:20px}
.lab-freeze.ready svg{color:var(--cyan)}
.lab-freeze.used svg{color:#445090;opacity:.7}
.lab-main{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:6px 2px 16px;touch-action:pan-y;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;outline:none}
.lab-nav{flex:none;display:flex;gap:6px;padding:8px 0 var(--pad-b);border-top:2px solid rgba(13,18,48,.14)}
.lab-tab{position:relative;flex:1 1 0;min-width:44px;height:56px;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;background:var(--panel);border:2px solid var(--line);color:var(--muted);box-shadow:0 3px 0 rgba(0,0,0,.35)}
.lab-tab-ic svg{width:22px;height:22px}
.lab-tab-tx{font:700 10.5px/1 var(--font-body);letter-spacing:.01em;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lab-tab[data-view=parent]{flex-grow:1.35}
.lab-tab.on{background:var(--lab);border-color:var(--lab);color:var(--lab-ink);box-shadow:0 3px 0 var(--lab-edge)}
.lab-dot{position:absolute;top:-6px;right:-3px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:var(--accent);color:var(--accent-ink);font:700 12px/20px var(--font-body);text-align:center;font-style:normal;box-shadow:0 0 0 2px var(--ink)}
.lab-dot:empty{min-width:14px;height:14px;padding:0}
.lab-toast{pointer-events:none;position:absolute;left:50%;bottom:calc(76px + var(--pad-b));transform:translateX(-50%);max-width:min(90%,420px);padding:11px 18px;border-radius:14px;background:var(--lab);color:var(--lab-ink);font:700 15px/1.2 var(--font-body);text-align:center;box-shadow:0 6px 0 rgba(0,0,0,.4);z-index:5}
.lab-toast.in{animation:labPop .28s ease-out}

/* ---------- home ---------- */
.lab-home{display:grid;gap:12px;grid-template-columns:minmax(0,1fr);grid-template-areas:'notes' 'room' 'today' 'games'}
.lab-notes{grid-area:notes;display:flex;flex-direction:column;gap:6px}.lab-notes:empty{display:none}
.lab-note{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:12px;background:linear-gradient(90deg,#126a5c,#1b8f7d);font:700 15px/1.2 var(--font-body);box-shadow:0 4px 0 rgba(0,0,0,.3)}
.lab-note.freeze{background:linear-gradient(90deg,#0c6a88,#1286ad)}
.lab-note-ic svg{width:22px;height:22px;color:#fff7b0}
.lab-room{grid-area:room;position:relative;width:100%;aspect-ratio:16/9;border-radius:var(--r);overflow:hidden;border:3px solid var(--line);box-shadow:0 6px 0 rgba(13,40,80,.3);background:#f0d4a2;border-color:#c99a5a}
.lab-room-cv{width:100%;height:100%}
.lab-hot{position:absolute;min-width:44px;min-height:44px;background:transparent;border-radius:14px}
.lab-hot:active{background:rgba(255,255,255,.12)}
.lab-today{grid-area:today;display:flex;flex-direction:column;gap:10px}
.lab-mini-quests{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.lab-mq{display:flex;align-items:center;gap:10px;min-height:34px;font-size:14px;font-weight:600}
.lab-mq-tx{flex:1;min-width:0}
.lab-mq-n{font-weight:700;color:var(--muted);font-size:13px}
.lab-mq.done .lab-mq-tx{color:var(--dim);text-decoration:line-through}
.lab-mq .lab-check{width:24px;height:24px}
.lab-mq .lab-check svg{width:14px;height:14px}
.lab-goalmini{display:flex;flex-direction:column;gap:6px;text-align:left;padding:10px 12px;min-height:44px;border-radius:12px;background:var(--ink-2);border:2px solid var(--line)}
.lab-goal-tx{font-size:13px;font-weight:700}
.lab-goal-n{font-size:13px;font-weight:700;color:var(--muted)}

/* ---------- quests ---------- */
.lab-quests{display:grid;gap:12px;max-width:760px;margin:0 auto}
.lab-quest-list{display:flex;flex-direction:column;gap:12px}
.lab-quest{display:flex;align-items:center;gap:8px;padding:10px}
.lab-quest.nudge{border-color:#6b58d6}
.lab-quest.done{border-color:#1d8a4d;background:#173a4a}
.lab-quest-main{flex:1;min-width:0;display:flex;align-items:center;gap:12px;min-height:64px;text-align:left}
.lab-quest-badge{flex:none}
.lab-quest-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.lab-tag{align-self:flex-start;padding:2px 8px;border-radius:999px;background:#4a3aa8;color:#e1d9ff;font:700 11px/1.3 var(--font-body);letter-spacing:.05em;text-transform:uppercase}
.lab-quest-tx{font:700 17px/1.2 var(--font-body)}
.lab-bar-q{height:12px}
.lab-quest-hint{display:block;font:600 13px/1.25 var(--font-body);color:var(--muted)}
.lab-quest-n{font-size:13px;font-weight:700;color:var(--muted)}
.lab-quest-reward{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:54px;font:400 14px/1 var(--font-display);color:var(--accent)}
.lab-quest-reward .coin{width:26px;height:26px}
.lab-quest.done .lab-quest-reward{color:#8ff0b3}
.lab-swap{flex:none;padding:0 10px}
.lab-quest-crate{display:flex;align-items:center;gap:16px}
.lab-qc-art{width:96px;flex:none}
.lab-qc-art.ready{filter:none;animation:labWiggle 1.6s ease-in-out infinite}
.lab-qc-body{flex:1;display:flex;flex-direction:column;gap:10px;align-items:flex-start}
.lab-qc-tx{font:700 16px/1.2 var(--font-body)}

/* ---------- the crate ---------- */
.lab-crate-view{max-width:620px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center}
.lab-crate-stage{position:relative;width:100%;min-height:230px;display:grid;place-items:center}
.lab-crate-btn{display:grid;place-items:center;width:230px;max-width:70vw;border-radius:24px;padding:10px}
.lab-crate-btn:not([disabled]){animation:labWiggle 2s ease-in-out infinite}
.lab-crate-stage:not(.shake) .lab-crate-btn[disabled] .lab-crate-art{filter:none}
.lab-crate-art svg{width:100%;height:auto;overflow:visible}
.lab-crate-art .crate-lid{transform-origin:20% 50%;transform-box:fill-box}
.lab-crate-stage.shake .lab-crate-art{animation:labShake .45s linear 2}
.lab-crate-stage.shake .crate-lid{animation:labLid .9s ease-in .3s forwards}
.lab-crate-tx{font-size:16px;font-weight:600;color:var(--muted)}
.lab-reveal{position:relative;width:min(100%,380px);padding:22px 16px 16px;border-radius:22px;border:3px solid var(--lab);background:linear-gradient(#1d2a7a,#142060);box-shadow:0 8px 0 rgba(0,0,0,.4);display:flex;flex-direction:column;align-items:center;gap:8px;animation:labRise .55s cubic-bezier(.2,1.3,.4,1)}
.lab-reveal.r-r{border-color:var(--cyan)}.lab-reveal.r-e{border-color:var(--accent);box-shadow:0 8px 0 rgba(0,0,0,.4),0 0 40px rgba(255,207,26,.4)}
.lab-reveal-art{position:relative;z-index:1}
.lab-reveal-art .lab-prev{border:3px solid rgba(255,255,255,.25)}
.lab-reveal-name{position:relative;z-index:1;font:400 24px/1.1 var(--font-display);text-transform:uppercase}
.lab-reveal-note{position:relative;z-index:1;font:700 17px/1.2 var(--font-body);color:var(--accent)}
.lab-bigcoin .coin{width:96px;height:96px}
.lab-rays{position:absolute;inset:0;pointer-events:none;overflow:hidden;border-radius:19px}
.lab-rays i{position:absolute;left:50%;top:38%;width:5px;height:60%;margin-left:-2.5px;transform-origin:50% 0;transform:rotate(var(--a)) scaleY(0);background:linear-gradient(rgba(255,255,255,.9),transparent);animation:labRay .9s ease-out var(--d) both}
.lab-rays.r-r i{background:linear-gradient(rgba(150,230,255,.95),transparent)}.lab-rays.r-e i{background:linear-gradient(rgba(255,226,120,1),transparent)}

/* ---------- shop ---------- */
.lab-shop{display:flex;flex-direction:column;gap:10px;max-width:1000px;margin:0 auto}
.lab-seg{display:flex;flex-wrap:wrap;gap:4px;padding:4px;border-radius:12px;background:var(--ink);border:2px solid var(--line)}
.lab-seg-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;min-width:44px;padding:0 12px;border-radius:8px;font:700 13px/1 var(--font-body);color:var(--muted);white-space:nowrap}
.lab-seg-btn.on{background:var(--lab);color:var(--lab-ink)}
.lab-seg-btn svg{width:20px;height:20px}
.lab-shop-body{display:flex;flex-direction:column;gap:10px}
.lab-shop-head{display:flex;flex-direction:column;gap:2px;padding:10px 14px;border-radius:12px;background:linear-gradient(90deg,#1b3a8a,#1b2357);font-size:14px;font-weight:600;color:var(--muted)}
.lab-shop-head b{font:400 16px/1.1 var(--font-display);text-transform:uppercase;color:var(--cyan)}
.lab-slot-h{font:400 14px/1.1 var(--font-display);text-transform:uppercase;letter-spacing:.04em;color:#12204f;margin-top:6px;display:flex;gap:10px;align-items:baseline}
.lab-slot-open{font:700 12px/1 var(--font-body);color:var(--dim);text-transform:none}
.lab-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}
.lab-item{display:flex;align-items:center;gap:12px;padding:10px;position:relative}
.lab-item.s-owned{border-color:#2b5f6d}
.lab-card-prev{position:relative}
.lab-lock-badge{position:absolute;right:3px;bottom:3px;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:var(--ink);border:2px solid var(--muted);color:#fff}
.lab-lock-badge svg{width:13px;height:13px}
.lab-nw{white-space:nowrap}
.lab-price{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:36px;padding:0 12px;border-radius:var(--r-sm);background:rgba(8,12,40,.55);border:2px solid var(--line);font:700 14px/1 var(--font-body);white-space:nowrap}
.lab-price svg{width:18px;height:18px}
.lab-item.confirming{border-color:var(--go);background:#16355a}
.lab-item.fresh{border-color:var(--accent)}
.lab-card-prev{flex:none;width:76px;height:76px;border-radius:12px;overflow:hidden}
.lab-prev{display:block;border-radius:10px}
.lab-swatch{display:grid;place-items:center;border:2px solid rgba(255,255,255,.2)}
.lab-item-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
.lab-item-name{font:700 16px/1.15 var(--font-body);display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.lab-new{padding:1px 7px;border-radius:6px;background:var(--accent);color:var(--accent-ink);font:700 11px/1.4 var(--font-body);text-transform:uppercase}
.lab-state{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:var(--muted)}
.lab-state svg{width:16px;height:16px}
.lab-state.ok{color:#8ff0b3}.lab-state.gift{color:#ffe28a}.lab-state.locked{color:var(--muted)}.lab-state.poor{color:var(--muted)}
.lab-card-act{flex:none;display:flex;flex-direction:column;gap:6px;align-items:stretch}

.lab-levelup{position:absolute;inset:0;z-index:7;display:grid;place-items:center;padding:16px;background:rgba(5,8,28,.82);animation:labFade .25s ease-out}
.lab-levelup-card{position:relative;width:min(100%,360px);max-height:100%;overflow:auto;padding:22px 18px 18px;border-radius:24px;border:3px solid var(--accent);background:linear-gradient(#3a2a9c,#1d1a63);box-shadow:0 8px 0 rgba(0,0,0,.4),0 0 44px rgba(255,207,26,.35);display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;animation:labRise .45s cubic-bezier(.2,1.3,.4,1)}
.lab-levelup-card.calm{animation:labFade .3s ease-out}
.lab-lv-rays{position:absolute;left:0;right:0;top:0;height:200px;pointer-events:none;overflow:hidden;border-radius:21px}
.lab-lv-rays i{position:absolute;left:50%;top:58px;width:6px;height:140px;margin-left:-3px;transform-origin:50% 0;transform:rotate(var(--a)) scaleY(0);background:linear-gradient(rgba(255,226,120,1),transparent);animation:labRay 1s ease-out .1s both}
.lab-lv-badge{position:relative;width:92px;height:92px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 35% 30%,#ffe680,#e0a800);border:4px solid #fff3b0;color:#2a1a00;animation:labBurst .6s cubic-bezier(.2,1.4,.4,1) both}
.lab-lv-badge svg{position:absolute;width:84px;height:84px;color:rgba(255,255,255,.35)}
.lab-lv-badge b{position:relative;font:400 38px/1 var(--font-display)}
.lab-levelup-card.calm .lab-lv-badge{animation:none}
.lab-lv-kicker{margin-top:6px;font:700 14px/1 var(--font-body);color:var(--muted)}
.lab-lv-title{font:400 30px/1.05 var(--font-display);text-transform:uppercase}
.lab-lv-name{font:400 20px/1.1 var(--font-display);text-transform:uppercase;color:var(--accent)}
.lab-lv-list{list-style:none;margin:8px 0 4px;padding:0;display:flex;flex-direction:column;gap:6px;align-items:center;font:700 16px/1.2 var(--font-body)}
.lab-lv-list li{display:flex;gap:8px;align-items:center;justify-content:center}
.lab-lv-list svg{width:18px;height:18px;color:var(--accent)}
.lab-levelup .lab-btn{margin-top:10px;min-width:150px}
@keyframes labBurst{0%{transform:scale(.3);opacity:0}100%{transform:scale(1);opacity:1}}

/* ---------- me ---------- */
.lab-me{display:flex;flex-direction:column;gap:12px;max-width:1000px;margin:0 auto}
.lab-me-top{display:grid;gap:12px}
.lab-me-stage{padding:0;overflow:hidden}
.lab-me-cv{width:100%;aspect-ratio:8/5;height:auto}
.lab-species-row{display:flex;gap:8px;flex-wrap:wrap}
.lab-species{flex:1 1 70px;min-height:94px;display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px;border-radius:12px;background:var(--ink-2);border:2px solid var(--line);font:700 12px/1 var(--font-body)}
.lab-species.on{border-color:var(--lab);background:#10425a}
.lab-species-cv{width:64px;height:64px}
.lab-petname-row{display:flex;align-items:center;gap:12px;margin-top:10px}
.lab-petname{font:400 22px/1.1 var(--font-display);flex:1;min-width:0;overflow-wrap:break-word}
.lab-namer{position:fixed;left:0;right:0;bottom:0;top:auto;z-index:100001;border-radius:var(--r) var(--r) 0 0;border-bottom:0;background:var(--panel);display:flex;flex-direction:column;gap:10px;margin:0 auto;max-width:760px;padding:12px 12px max(12px,env(safe-area-inset-bottom,0px));box-shadow:0 -10px 40px rgba(0,0,0,.6)}
.lab-namer-scrim{position:fixed;inset:0;z-index:100000;background:rgba(5,8,28,.7)}
.lab-namer-top{display:flex;align-items:center;justify-content:space-between;gap:10px}
.lab-namebox,.lab-namebox-x{height:52px;display:flex;align-items:center;padding:0 16px;border-radius:14px;background:var(--ink);border:3px solid var(--accent);font:400 24px/1 var(--font-display);min-width:0;flex:1}
.lab-namebox .ph{color:var(--dim);font-size:18px}
.lab-namebox .caret{width:3px;height:26px;margin-left:3px;background:var(--accent);animation:labCaret 1s steps(1) infinite}
.lab-me-rows{display:flex;flex-direction:column;gap:10px}
.lab-slot-row{display:flex;flex-direction:column;gap:8px}
.lab-slot-row.closed{opacity:1}
.lab-slot-title{display:flex;align-items:center;justify-content:space-between;gap:10px;font:400 15px/1.1 var(--font-display);text-transform:uppercase}
.lab-chips{display:flex;flex-wrap:wrap;gap:8px}
.lab-chip-btn{width:60px;height:60px;border-radius:12px;display:grid;place-items:center;background:var(--ink-2);border:3px solid var(--line);overflow:hidden}
.lab-chip-btn.on{border-color:var(--lab);box-shadow:0 0 0 2px rgba(55,224,192,.35)}
.lab-chip-btn .lab-prev{width:100%!important;height:100%!important}
.lab-none{font:700 12px/1 var(--font-body);color:var(--muted)}

/* on-screen keyboard (the shared one, car-jump/src/spelling/keyboard.js) */
.lab-root .kb{--kgap:6px;--kh:46px;width:min(100%,720px);display:flex;flex-direction:column;gap:var(--kgap);margin:0 auto;touch-action:none}
.lab-root .kb-row{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:var(--kgap)}
.lab-root .kb-key{height:var(--kh);min-width:0;border-radius:10px;background:#f4f6ff;color:var(--ink);font:700 22px/1 var(--font-body);box-shadow:0 4px 0 #8d97cf,inset 0 -2px 0 rgba(0,0,0,.06);display:grid;place-items:center;touch-action:none;text-align:center}
.lab-root .kb-key.is-down{transform:translateY(3px);box-shadow:0 1px 0 #8d97cf;background:#fff6c9}
.lab-root .kb-key svg{width:26px;height:26px}
.lab-root .kb-back{background:#c9d0f5}
.lab-root .kb-space{font:800 13px/1 var(--font-body);color:#4a5390;letter-spacing:.1em;text-transform:uppercase}
.lab-root .kb-enter{background:var(--go);color:#062a12;font:400 18px/1 var(--font-display);letter-spacing:.04em;text-transform:uppercase;box-shadow:0 4px 0 var(--go-edge)}
.lab-root .kb-enter:disabled{background:#5a6292;color:#b9c0e8;box-shadow:0 4px 0 #2f3563}
.lab-root .kb.is-disabled .kb-key:not(.kb-enter){opacity:.45}

/* ---------- family ---------- */
.lab-family{display:flex;flex-direction:column;gap:12px;max-width:900px;margin:0 auto}
.lab-goal{display:flex;flex-direction:column;gap:10px}
.lab-goal-text{font:700 19px/1.2 var(--font-body)}
.lab-meter{height:26px;border-radius:14px;background:rgba(0,0,0,.4);overflow:hidden;box-shadow:inset 0 2px 4px rgba(0,0,0,.4);border:2px solid var(--line)}
.lab-meter-fill{height:100%;display:flex;border-radius:12px;overflow:hidden;transition:width .6s ease;min-width:0}
.lab-meter-fill i{display:block;height:100%;min-width:4px}
.lab-claim{align-self:flex-start}
.lab-board{display:flex;flex-direction:column;gap:8px}
.lab-board-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}
.lab-person{display:flex;align-items:center;gap:12px;border-color:var(--c)}
.lab-person.has-crown{box-shadow:0 5px 0 rgba(0,0,0,.35),0 0 18px color-mix(in srgb,var(--c) 45%,transparent)}
.lab-board-cv{width:68px;height:68px;border-radius:50%;background:rgba(255,255,255,.08);border:3px solid var(--c);flex:none}
.lab-person-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.lab-person-name{display:flex;align-items:center;gap:8px;font:400 18px/1.1 var(--font-display)}
.lab-badge-crown svg{width:26px;height:26px;color:var(--accent);filter:drop-shadow(0 2px 0 rgba(0,0,0,.4))}
.lab-badge-star svg{width:24px;height:24px;color:var(--cyan)}
.lab-person-bar{display:flex;align-items:center;gap:10px}
.lab-person-bar .lab-bar{flex:1}
.lab-person-bar .lab-bar>i{background:var(--c)}
.lab-person-xp{font-size:13px;font-weight:700;color:var(--muted);min-width:64px;text-align:right}
.lab-improved{font-size:13px;font-weight:700;color:#9fe0ff}
.lab-stickers{display:flex;gap:6px}
.lab-sticker svg{width:18px;height:18px}
.lab-sticker.most svg{color:var(--accent)}.lab-sticker.imp svg{color:var(--cyan)}

/* ---------- gallery ---------- */
.lab-gallery{max-width:1000px;margin:0 auto;position:relative}
.lab-gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
.lab-build{display:flex;flex-direction:column;gap:8px;padding:10px;text-align:left;border-color:var(--c)}
.lab-build-pics{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.lab-bp{display:block;width:100%;height:auto}
.lab-build-cap{display:flex;flex-direction:column;gap:2px}
.lab-build-title{font:700 16px/1.2 var(--font-body)}
.lab-build-by{font-size:13px;font-weight:600;color:var(--muted)}
.lab-dot-c{display:none}
.lab-bigview{position:fixed;inset:0;z-index:20;background:rgba(5,8,28,.92);display:grid;place-items:center;padding:14px;overflow:auto}
.lab-bigview-in{width:min(100%,760px);display:flex;flex-direction:column;gap:12px}
.lab-bigview-top{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:19px}
.lab-bigview-pics{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
.lab-bigview figure{margin:0}.lab-bigview figcaption{text-align:center;font-size:13px;font-weight:700;color:var(--muted);margin-top:4px}

/* ---------- grown-ups ---------- */
.lab-parent-wrap{max-width:760px;margin:0 auto}
.lab-parent{display:flex;flex-direction:column;gap:12px}
.lab-parent-head{display:flex;align-items:center;gap:12px}
.lab-parent-head svg{width:40px;height:40px;color:var(--lab)}
.lab-parent-head h2{font:400 24px/1.1 var(--font-display);text-transform:uppercase}
.lab-psec{display:flex;flex-direction:column;gap:6px}
.lab-odds{width:100%;border-collapse:collapse;font-size:15px}
.lab-odds th,.lab-odds td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line)}
.lab-odds th{font:700 12px/1 var(--font-body);text-transform:uppercase;color:var(--muted);letter-spacing:.06em}
.lab-switch{position:relative;display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:58px;padding:8px 4px;border-bottom:1px solid rgba(255,255,255,.06);cursor:pointer}
.lab-switch-tx{display:flex;flex-direction:column;gap:2px;min-width:0}
.lab-switch-tx b{font:700 16px/1.2 var(--font-body)}.lab-switch-tx small{font-size:13px;font-weight:500;color:var(--muted)}
.lab-switch-in{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
.lab-switch-ui{flex:none;width:58px;height:34px;border-radius:17px;background:#3a4590;position:relative;transition:background .15s}
.lab-switch-ui::after{content:'';position:absolute;top:4px;left:4px;width:26px;height:26px;border-radius:50%;background:#fff;transition:transform .15s}
.lab-switch-in:checked+.lab-switch-ui{background:var(--go)}.lab-switch-in:checked+.lab-switch-ui::after{transform:translateX(24px)}
.lab-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center}
.lab-stats div{padding:10px 4px;border-radius:12px;background:var(--ink-2);display:flex;flex-direction:column;gap:3px}
.lab-stats b{font:400 20px/1 var(--font-display);color:var(--accent)}.lab-stats span{font-size:12px;font-weight:600;color:var(--muted)}
.lab-history{list-style:none;margin:4px 0 0;padding:0;display:flex;flex-direction:column;gap:4px;font-size:14px}
.lab-history li{display:flex;justify-content:space-between;gap:10px;padding:6px 8px;border-radius:8px;background:var(--ink-2)}
.lab-history b{font-variant-numeric:tabular-nums}
.lab-reset{display:flex;flex-direction:column;gap:10px;align-items:flex-start}
.lab-pin-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;padding:10px 0 6px}
.lab-lock-ic svg{width:44px;height:44px;color:var(--lab)}
.lab-pin-title{font:400 22px/1.1 var(--font-display);text-transform:uppercase;text-align:center}
.lab-pin-dots{display:flex;gap:14px}
.lab-pin-dots i{width:20px;height:20px;border-radius:50%;border:3px solid var(--muted)}
.lab-pin-dots i.on{background:var(--accent);border-color:var(--accent)}
.lab-pin-err{font-weight:800;color:#ff8aa0}
.lab-pinpad{display:grid;grid-template-columns:repeat(3,78px);gap:8px}
.lab-pin-key{min-height:52px;padding:0;font-size:22px}

/* ---------- the players page ---------- */
.lab-pl-top{flex:none;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;padding:var(--pad-t) var(--pad-r) 6px var(--pad-l)}
.lab-pl-top>:first-child{justify-self:start}.lab-pl-top>:last-child{justify-self:end}
.lab-logo{font:400 clamp(26px,5vw,42px)/1 var(--font-display);text-transform:uppercase;color:var(--lab);text-shadow:0 4px 0 #04271f;text-align:center}
.lab-pl-body{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:10px var(--pad-r) var(--pad-b) var(--pad-l)}
.lab-pl-grid{display:flex;flex-wrap:wrap;justify-content:center;gap:14px}
.lab-pl-tile{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;width:150px;min-height:184px;padding:10px 8px;border-color:var(--c,var(--line))}
.lab-pl-tile:active{transform:translateY(3px)}
.lab-pl-cv{width:96px;height:96px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--c,#fff) 35%,transparent),transparent 72%)}
.lab-pl-name{font:400 17px/1.1 var(--font-display);max-width:100%;text-align:center;white-space:normal;overflow-wrap:break-word;word-break:normal}
.lab-pl-level{padding:4px 9px 3px;border-radius:999px;background:var(--ink);border:2px solid var(--c,var(--line));font:700 11px/1.2 var(--font-body);max-width:100%;text-align:center;white-space:normal;overflow-wrap:break-word}
.lab-pl-add{border-style:dashed;background:rgba(27,35,87,.7)}
.lab-pl-plus{display:grid;place-items:center;width:64px;height:64px;border-radius:50%;background:var(--lab);color:var(--lab-ink);font:400 40px/1 var(--font-display);box-shadow:0 4px 0 var(--lab-edge)}
.lab-pl-empty{font:400 22px/1.2 var(--font-display);text-align:center;text-transform:uppercase}
.lab-sync-chip{display:inline-flex;align-items:center;gap:7px;min-height:44px;padding:0 12px;border-radius:999px;background:var(--ink-2);border:2px solid var(--line);font:700 12px/1 var(--font-body)}
.lab-sync-chip i{width:10px;height:10px;border-radius:50%;background:var(--go)}
.lab-np{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:12px;padding:6px var(--pad-r) var(--pad-b) var(--pad-l);max-width:760px;width:100%;margin:0 auto}
.lab-np-row{display:flex;flex-wrap:wrap;align-items:center;gap:12px}
.lab-np-cv{width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,.08);flex:none}
.lab-colours{display:flex;gap:8px;flex-wrap:wrap}
.lab-colour{width:46px;height:46px;border-radius:50%;background:var(--c);border:3px solid rgba(255,255,255,.25);box-shadow:0 3px 0 rgba(0,0,0,.4)}
.lab-colour.taken{opacity:.55}.lab-colour.on{border-color:#fff;outline:3px solid var(--c);outline-offset:2px;opacity:1}
.lab-np-kb{flex:1;display:flex;align-items:flex-end}

/* ---------- inside a game: the pill, the banner, the strip ---------- */
.lab-hud{appearance:none;-webkit-appearance:none;background:none;border:0;margin:0;font:inherit;display:inline-flex;align-items:center;min-height:44px;min-width:44px;padding:4px 0;color:#fff;font-family:var(--font-body);cursor:pointer;pointer-events:auto}
.lab-hud-in{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 10px 0 8px;border-radius:999px;background:rgba(13,18,48,.86);border:2px solid var(--lab);font:400 12px/1 var(--font-display);text-transform:uppercase;white-space:nowrap}
.lab-hud-lab svg{width:16px;height:16px;color:var(--lab)}
.lab-hud-bar{width:58px;height:8px}
.lab-hud.compact .lab-hud-bar{width:44px}
/* a compact pill (Trail Blazer's 120 px slot) stays that wide while the combo flame shows: the Lab glyph steps aside and the bar shortens */
.lab-hud.compact.flaming .lab-hud-lab{display:none}
.lab-hud.compact.flaming .lab-hud-bar{width:16px}
.lab-hud.compact .lab-hud-flame.on{max-width:46px}
.lab-hud-flame{display:inline-flex;align-items:center;gap:2px;max-width:0;opacity:0;overflow:hidden;transition:opacity 1s ease,max-width .3s ease}
.lab-hud-flame svg{width:18px;height:18px;color:#ff9a3c;filter:drop-shadow(0 0 4px rgba(255,150,50,.8));transition:width .3s ease}
/* hidden, the flame takes no room at all (an 18 px glyph clipped by its own 0-width box still counts as overflow at the edge of a narrow screen) */
.lab-hud-flame:not(.on) svg{width:0}
.lab-hud-flame b{font:400 12px/1 var(--font-display);color:#ffd23c}
.lab-hud-flame.on{max-width:60px;opacity:1;transition:opacity .15s ease,max-width .3s ease}
.lab-hud-flame.on:not(.big) svg{transform:scale(.8)}
.lab-hud-flame.big svg{animation:labFlicker .5s ease-in-out infinite alternate}
.lab-banner{position:fixed;left:50%;top:max(12px,env(safe-area-inset-top,0px));transform:translate(-50%,-140%);z-index:100000;min-width:200px;max-width:min(92vw,420px);padding:12px 20px;border-radius:16px;background:linear-gradient(#1b8f7d,#126a5c);border:3px solid #7bf0d6;box-shadow:0 8px 0 rgba(0,0,0,.35);text-align:center;cursor:pointer;opacity:0;transition:transform .35s cubic-bezier(.2,1.3,.4,1),opacity .25s}
.lab-banner.in{transform:translate(-50%,0);opacity:1}
.lab-banner.level{background:linear-gradient(#5a3fd0,#3a2a9c);border-color:#b9a6ff}
.lab-banner.crate{background:linear-gradient(#e0a800,#b07a00);border-color:#ffe066;color:#2a1a00}
.lab-banner-main{font:400 19px/1.15 var(--font-display);text-transform:uppercase}
.lab-banner-sub{font:700 14px/1.2 var(--font-body);margin-top:3px;opacity:.95}
.lab-strip{display:flex;flex-direction:column;align-items:center;gap:8px;max-width:520px;margin:8px auto 0;padding:12px 14px;border-radius:16px;background:rgba(13,18,48,.88);border:2px solid var(--lab);color:#fff;font-family:var(--font-body);text-align:center}
.lab-strip-welcome{display:flex;align-items:center;gap:8px;font:400 15px/1 var(--font-display);text-transform:uppercase;color:#fff7b0}
.lab-strip-welcome svg{width:20px;height:20px}
.lab-strip-line{font:700 16px/1.3 var(--font-body)}
.lab-strip-level{display:flex;align-items:center;gap:8px;font:400 14px/1 var(--font-display);text-transform:uppercase;color:var(--accent)}
.lab-strip-level svg{width:20px;height:20px}
.lab-strip-bar{width:100%;max-width:340px}
.lab-strip-quests{display:flex;gap:10px}
.lab-qchip{position:relative;display:inline-grid;place-items:center;width:44px;height:44px;border-radius:12px;background:var(--ink-2);border:2px dashed var(--line)}
.lab-qchip.done{border-style:solid;border-color:var(--go);background:#13403a}
.lab-qmark{position:absolute;right:-5px;bottom:-5px;width:20px;height:20px;border-radius:50%;background:var(--go);color:#062a12;display:grid;place-items:center}
.lab-qchip:not(.done) .lab-qmark{display:none}
.lab-qmark svg{width:12px;height:12px}
.lab-strip-crate{min-width:200px}
.lab-strip-capped{font-size:13px;font-weight:600;color:var(--muted)}
/* a short landscape screen (a phone on its side): the strip lays itself out in rows so the coins, the level bar and the quest chips fit in about 100 px */
@media (orientation:landscape) and (max-height:500px){
.lab-strip{flex-direction:row;flex-wrap:wrap;justify-content:center;align-items:center;gap:4px 12px;margin:4px auto 0;padding:6px 10px;max-width:none}
.lab-strip-line{flex:1 1 100%;font-size:14px;line-height:1.2}
.lab-strip-welcome{flex:1 1 100%;justify-content:center;font-size:13px}
.lab-strip-level{font-size:12px}
.lab-strip-bar{flex:1 1 100%;max-width:none;height:8px}
.lab-qchip{width:36px;height:36px}
}

/* ---------- wide screens and phones on their side ---------- */
@media (min-width:760px) and (min-aspect-ratio:1/1){
 .lab-home{grid-template-columns:minmax(0,1fr) clamp(260px,28vw,340px);grid-template-areas:'notes notes' 'room today' 'games games';align-items:start}
 .lab-room{width:min(100%,calc((100vh - 230px) * 16 / 9))}
 .lab-me-top{grid-template-columns:1.4fr 1fr;align-items:start}
 .lab-overlay{display:flex;align-items:center;justify-content:center}
 .lab-overlay>.lab-shell{flex:0 1 auto;height:min(100%,860px);max-height:100%;border-radius:24px;background:rgba(255,255,255,.22);box-shadow:0 0 0 2px rgba(255,255,255,.35)}
}
@media (max-width:640px){
 .lab-top{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;grid-template-areas:'lead chip games streak' 'lv lv lv purse';gap:8px}
 #lab-lead{grid-area:lead}.lab-chip{grid-area:chip;max-width:none}.lab-streak{grid-area:streak}.lab-games-btn{grid-area:games}.lab-lvblock{grid-area:lv;min-width:0}.lab-purse{grid-area:purse}
 .lab-nav{gap:4px}.lab-tab{min-width:0;border-width:1px;padding:0}.lab-tab-tx{font-size:9px;letter-spacing:-.02em;text-overflow:clip}
 .lab-seg-btn{padding:0 9px;font-size:12px}.lab-seg-btn svg{display:none}
 .lab-grid{grid-template-columns:1fr}
 .lab-board-grid,.lab-gallery-grid{grid-template-columns:1fr}
 .lab-kb-note{display:none}
 .lab-pl-tile{width:44%;min-width:136px}
}
@media (max-height:520px) and (min-aspect-ratio:3/2){
 .lab-shell{padding-top:max(6px,env(safe-area-inset-top,0px))}
 .lab-top{display:flex;flex-wrap:nowrap;padding-bottom:4px}
 .lab-chip{min-height:44px;max-width:150px}
 .lab-lvblock{order:0;flex-basis:auto;min-width:130px}
 .lab-xp-tx{font-size:12px}
 .lab-nav{padding:5px 0 max(4px,env(safe-area-inset-bottom,0px))}
 .lab-tab{height:48px;flex-direction:row;gap:5px}
 .lab-tab-ic svg{width:19px;height:19px}
 .lab-tab-tx{font-size:11px}
 .lab-home{grid-template-columns:minmax(0,1.4fr) minmax(220px,1fr);grid-template-areas:'room notes' 'room today' 'games games';grid-template-rows:auto 1fr auto;align-items:start}
 .lab-room{width:min(100%,calc((100vh - 130px) * 16 / 9))}
 .lab-note{padding:6px 12px;font-size:14px}
 .lab-me-top{grid-template-columns:1.2fr 1fr;align-items:start}
 .lab-me-cv{aspect-ratio:2/1}
 .lab-toast{bottom:calc(60px + var(--pad-b))}
 .lab-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
 .lab-board-grid,.lab-gallery-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
 .lab-pl-tile{width:128px;min-height:150px}
 .lab-pl-cv{width:72px;height:72px}
 .lab-crate-stage{min-height:180px}
 .lab-crate-btn{width:170px}
 .lab-root .kb{--kh:40px;--kgap:4px}
 .lab-np-cv{width:60px;height:60px}
}
@media (max-height:520px) and (min-aspect-ratio:3/2) and (max-width:700px){.lab-tab-tx{display:none}}


/* ---------- the purse says what the coins are ---------- */
.lab-purse-unit{font:700 11px/1 var(--font-body);color:var(--muted);letter-spacing:.02em}
.lab-purse .coin,.lab-btn .coin,.lab-price .coin{filter:drop-shadow(0 1px 0 rgba(0,0,0,.25))}
.lab-games-btn svg{width:24px;height:24px}
.lab-main>.lab-empty,.lab-shop-body>.lab-empty,.lab-quest-list>.lab-empty,.lab-shop-body>.lab-small,.lab-quest-list>.lab-small{color:#12204f}

/* ---------- the Lab chip and the Games button (one component, every game) ---------- */
.lab-chipx{--labchip-bg:rgba(13,18,48,.88);--labchip-fg:#fff;--labchip-muted:#aab4ee;--labchip-edge:rgba(255,255,255,.32);--labchip-accent:#ffcf1a;--labchip-flame:#ff9a3c;--labchip-bar:#37e0c0;--labchip-bartrack:rgba(255,255,255,.22);
--labchip-shadow:0 3px 0 rgba(0,0,0,.35),0 6px 14px rgba(0,0,0,.25);--labchip-cv:rgba(127,160,230,.28);
display:inline-flex;align-items:stretch;gap:6px;font-family:var(--font-body);max-width:calc(100vw - 16px)}
.lab-chipx[data-theme=light]{--labchip-bg:rgba(255,255,255,.95);--labchip-fg:#14204f;--labchip-muted:#4a5694;--labchip-edge:rgba(20,32,79,.38);--labchip-accent:#7a4f00;--labchip-flame:#d9540c;--labchip-bar:#0c8f79;--labchip-bartrack:rgba(20,32,79,.16);
--labchip-shadow:0 3px 0 rgba(20,32,79,.25),0 6px 14px rgba(20,32,79,.15);--labchip-cv:rgba(80,120,200,.2)}
.lab-chipx.fixed{position:fixed;z-index:9000;top:max(8px,env(safe-area-inset-top,0px));left:max(8px,env(safe-area-inset-left,0px))}
.lab-chipx-main{display:inline-flex;align-items:center;gap:8px;min-height:44px;min-width:44px;padding:3px 12px 3px 3px;border-radius:999px;background:var(--labchip-bg);color:var(--labchip-fg);border:2px solid var(--labchip-edge);box-shadow:var(--labchip-shadow);text-align:left}
.lab-chipx-main:active,.lab-chipx-games:active{transform:translateY(2px)}
.lab-chipx-cv{width:38px;height:38px;border-radius:50%;background:var(--labchip-cv);flex:none}
.lab-chipx-stack{display:flex;flex-direction:column;gap:3px;min-width:0}
.lab-chipx-lv{font:400 12px/1 var(--font-display);letter-spacing:.03em;text-transform:uppercase;white-space:nowrap}
.lab-chipx-bar{display:block;height:4px;border-radius:3px;background:var(--labchip-bartrack);overflow:hidden}
.lab-chipx-bar>i{display:block;height:100%;border-radius:3px;background:var(--labchip-bar);transition:width .4s ease}
.lab-chipx-row{display:flex;align-items:center;gap:5px;font:400 14px/1 var(--font-display);white-space:nowrap}
.lab-chipx-coin{display:inline-flex}
.lab-chipx-coin .coin{width:18px;height:18px;display:block}
.lab-chipx-coins{color:var(--labchip-accent);font-weight:400}
.lab-chipx-flame{display:inline-flex;align-items:center;gap:1px;margin-left:4px;color:var(--labchip-muted)}
.lab-chipx-flame svg{width:17px;height:17px}
.lab-chipx-flame.on{color:var(--labchip-flame)}
.lab-chipx-flame b{font:400 13px/1 var(--font-display)}
.lab-chipx-games{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;min-width:46px;min-height:44px;padding:2px 6px;border-radius:16px;background:var(--labchip-bg);color:var(--labchip-fg);border:2px solid var(--labchip-edge);box-shadow:var(--labchip-shadow)}
.lab-chipx-games svg{width:22px;height:22px}
.lab-chipx-games-tx{font:700 10px/1 var(--font-body);letter-spacing:.02em}
.lab-chipx.compact{gap:4px}
.lab-chipx.compact .lab-chipx-main{gap:6px;padding:2px 9px 2px 2px}
.lab-chipx.compact .lab-chipx-cv{width:32px;height:32px}
.lab-chipx.compact .lab-chipx-lv{font-size:10.5px}
.lab-chipx.compact .lab-chipx-row{font-size:12.5px;gap:4px}
.lab-chipx.compact .lab-chipx-coin .coin{width:16px;height:16px}
.lab-chipx.compact .lab-chipx-flame{margin-left:2px}
.lab-chipx.compact .lab-chipx-flame svg{width:15px;height:15px}
.lab-chipx.compact .lab-chipx-games{min-width:44px;padding:2px 4px}
.lab-chipx.compact .lab-chipx-games-tx{display:none}
@media (max-width:420px){.lab-chipx:not(.compact) .lab-chipx-games-tx{display:none}.lab-chipx:not(.compact){gap:4px}}

/* ---------- the picker button ("The Lab" next to the family's players) ---------- */
.lab-pickbtn{display:inline-flex;align-items:center;gap:12px;min-height:64px;min-width:44px;padding:8px 20px 8px 12px;border-radius:18px;background:var(--lab);color:var(--lab-ink);text-align:left;
box-shadow:0 5px 0 var(--lab-edge),inset 0 2px 0 rgba(255,255,255,.45),0 8px 16px rgba(0,0,0,.25);font-family:var(--font-body)}
.lab-pickbtn:active{transform:translateY(3px);box-shadow:0 2px 0 var(--lab-edge),inset 0 2px 0 rgba(255,255,255,.45)}
.lab-pickbtn-ic{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:rgba(4,39,31,.14);flex:none}
.lab-pickbtn-ic svg{width:28px;height:28px}
.lab-pickbtn-tx{display:flex;flex-direction:column;gap:3px}
.lab-pickbtn-tx b{font:400 18px/1 var(--font-display);letter-spacing:.02em;text-transform:uppercase}
.lab-pickbtn-tx small{font:700 12px/1.1 var(--font-body);opacity:.8}

/* ---------- the Games panel (slides in from the left) ---------- */
.lab-gp{position:fixed;inset:0;z-index:100001;pointer-events:none}
.lab-gp-scrim{position:absolute;inset:0;background:rgba(5,8,28,.55);opacity:0;transition:opacity .18s}
.lab-gp-panel{position:absolute;top:0;bottom:0;left:0;width:min(90vw,390px);display:flex;flex-direction:column;gap:10px;overflow-y:auto;background:var(--ink-2);border-right:3px solid var(--line);box-shadow:6px 0 0 rgba(0,0,0,.25);
padding:max(14px,env(safe-area-inset-top,0px)) 14px max(14px,env(safe-area-inset-bottom,0px)) max(14px,env(safe-area-inset-left,0px));transform:translateX(-106%);transition:transform .2s ease}
.lab-gp.in{pointer-events:auto}.lab-gp.in .lab-gp-scrim{opacity:1}.lab-gp.in .lab-gp-panel{transform:none}
.lab-gp-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
.lab-gp-head h2{font:400 20px/1 var(--font-display);text-transform:uppercase;letter-spacing:.03em;color:var(--lab)}
.lab-gp-close{display:grid;place-items:center;width:48px;height:48px;border-radius:14px;background:var(--panel-2);color:#fff;box-shadow:0 4px 0 #070a22}
.lab-gp-close svg{width:22px;height:22px}
.lab-gp-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.lab-gp-row{display:flex;align-items:center;gap:12px;min-height:62px;padding:8px 12px 8px 10px;border-radius:14px;background:var(--panel);border:2px solid var(--line);border-left:7px solid var(--gc,var(--line));color:#fff;text-decoration:none}
.lab-gp-row:active{transform:translateY(2px)}
.lab-gp-row.here{background:var(--panel-2);border-color:var(--gc);box-shadow:0 0 0 2px var(--gc),0 0 18px -2px var(--gc)}
.lab-gp-art{flex:none;display:grid;place-items:center}
.lab-gp-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.lab-gp-tx b{font:400 15px/1.1 var(--font-display);letter-spacing:.02em}
.lab-gp-tx small{font:600 13px/1.2 var(--font-body);color:var(--muted);overflow-wrap:anywhere}
.lab-gp-here{flex:none;padding:4px 9px 3px;border-radius:999px;background:var(--gc);color:#12102a;font:700 11px/1.2 var(--font-body);letter-spacing:.03em;text-transform:uppercase}
.lab-gp-go{flex:none;color:var(--muted)}.lab-gp-go svg{width:18px;height:18px;transform:scaleX(-1)}

/* ---------- the six progress cards ---------- */
.lab-games-sec{grid-area:games;display:flex;flex-direction:column;gap:8px}
.lab-games-sec>.lab-h{color:#0b3a52;text-shadow:0 1px 0 rgba(255,255,255,.4);margin:2px 0 0}
.lab-gcards{display:grid;grid-template-columns:minmax(0,1fr);gap:10px}
@media (min-width:560px){.lab-gcards{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (min-width:980px){.lab-gcards{grid-template-columns:repeat(3,minmax(0,1fr))}}
.lab-gcard{--gc:#8f6bff;display:flex;align-items:flex-start;gap:12px;min-height:84px;padding:12px;border-radius:16px;background:var(--panel);border:2px solid var(--line);border-left:7px solid var(--gc);box-shadow:0 5px 0 rgba(0,0,0,.3);color:#fff;text-decoration:none}
a.lab-gcard:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(0,0,0,.3)}
.lab-gcard.g-sj{--gc:#ffcf1a}.lab-gcard.g-tb{--gc:#ff8a1f}.lab-gcard.g-ff{--gc:#5fd38d}.lab-gcard.g-ww{--gc:#d9653b}.lab-gcard.g-bc{--gc:#22d3ff}.lab-gcard.g-cf{--gc:#e0b24a}
.lab-gcard-badge{flex:none;display:grid;place-items:center}
.lab-gcard-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.lab-gcard-name{font:400 13px/1.1 var(--font-display);letter-spacing:.03em;text-transform:uppercase;color:var(--muted)}
.lab-gcard-level{font:400 17px/1.15 var(--font-display);color:#fff;overflow-wrap:anywhere}
.lab-gcard-line{font:600 14px/1.25 var(--font-body);color:#dfe4ff;overflow-wrap:anywhere}
.lab-gcard-today{align-self:flex-start;margin-top:2px;padding:3px 9px;border-radius:999px;background:rgba(55,224,192,.18);border:1px solid var(--lab);color:#aaf5e6;font:700 12.5px/1.2 var(--font-body)}
.lab-gcard-last{margin-top:2px;font:600 12.5px/1.2 var(--font-body);color:var(--muted)}
.lab-gcard-try{align-self:flex-start;padding:4px 11px 3px;border-radius:999px;background:var(--accent);color:var(--accent-ink);font:400 13px/1.2 var(--font-display);letter-spacing:.03em;text-transform:uppercase}
.lab-gcard.fresh{background:var(--ink-2);border-style:dashed;border-left-style:solid}
.lab-familycode{font-weight:700;color:#e8ecff;padding:10px 12px;border-radius:12px;background:var(--ink-2);border:2px dashed var(--line)}

/* ---------- motion ---------- */
@keyframes labPop{0%{transform:translateX(-50%) scale(.85);opacity:0}100%{transform:translateX(-50%) scale(1);opacity:1}}
@keyframes labWiggle{0%,100%{transform:rotate(0)}8%{transform:rotate(-3deg)}16%{transform:rotate(3deg)}24%{transform:rotate(-2deg)}32%{transform:rotate(0)}}
@keyframes labShake{0%,100%{transform:translateX(0) rotate(0)}25%{transform:translateX(-8px) rotate(-4deg)}75%{transform:translateX(8px) rotate(4deg)}}
@keyframes labLid{0%{transform:translate(0,0) rotate(0)}100%{transform:translate(40px,-120px) rotate(35deg);opacity:0}}
@keyframes labRise{0%{transform:translateY(60px) scale(.5);opacity:0}100%{transform:none;opacity:1}}
@keyframes labRay{0%{transform:rotate(var(--a)) scaleY(0);opacity:0}30%{opacity:1}100%{transform:rotate(var(--a)) scaleY(1);opacity:.0}}
@keyframes labCaret{50%{opacity:0}}
@keyframes labFlicker{to{transform:scale(1.12) rotate(4deg)}}
@media (prefers-reduced-motion:reduce){
 .lab-root *,.lab-root *::before,.lab-root *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
 .lab-reveal{animation:labFade .3s ease-out!important}
 .lab-rays,.lab-lv-rays{display:none}
 .lab-lv-badge{animation:none!important}
 .lab-levelup-card{animation:labFade .3s ease-out!important}
 .lab-crate-btn,.lab-qc-art.ready{animation:none!important}
}
@keyframes labFade{from{opacity:0}to{opacity:1}}
`;
