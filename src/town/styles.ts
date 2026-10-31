export const TOWN_SCENE_STYLES = `
.h3-town-scene {
  position: absolute;
  inset: 0;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
  color: #f8f2df;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  isolation: isolate;
  background: #283e3b;
}
.h3-town-scene *, .h3-town-scene *::before, .h3-town-scene *::after { box-sizing: border-box; }
.h3-town-scene [hidden] { display: none !important; }
.h3-town-scene canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  outline: none;
}
.h3-town-scene canvas:focus-visible { box-shadow: inset 0 0 0 3px #f6d67c; }
.h3-town-scene__vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(13, 25, 28, .32), transparent 22%, transparent 72%, rgba(13, 25, 28, .3));
  z-index: 1;
}
.h3-town-scene__header {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 4;
  max-width: calc(100% - 270px);
  padding: 11px 16px 12px;
  border: 1px solid rgba(245, 221, 157, .34);
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(25, 38, 39, .93), rgba(33, 49, 45, .8));
  box-shadow: 0 8px 25px rgba(0, 0, 0, .22);
  pointer-events: none;
}
.h3-town-scene__header h2 { margin: 0; font: 700 21px/1.15 Georgia, serif; letter-spacing: .02em; }
.h3-town-scene__header p { margin: 4px 0 0; color: #d7dec9; font-size: 12px; }
.h3-town-scene__toolbar {
  position: absolute;
  z-index: 5;
  top: 14px;
  right: 14px;
  display: flex;
  gap: 5px;
  padding: 5px;
  border-radius: 10px;
  background: rgba(23, 36, 37, .88);
  border: 1px solid rgba(245, 221, 157, .25);
}
.h3-town-scene__toolbar button {
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid rgba(245, 221, 157, .24);
  border-radius: 7px;
  background: #354b48;
  color: #fff4d4;
  font: 700 18px/1 sans-serif;
  cursor: pointer;
}
.h3-town-scene__toolbar button:hover { background: #4a635b; border-color: #e7ca78; }
.h3-town-scene__toolbar button:focus-visible, .h3-town-scene__building:focus-visible {
  outline: 2px solid #ffe293;
  outline-offset: 2px;
}
.h3-town-scene__buildings {
  position: absolute;
  z-index: 4;
  top: 70px;
  right: 14px;
  bottom: 14px;
  width: 224px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 12px;
  border: 1px solid rgba(245, 221, 157, .3);
  border-radius: 12px;
  background: linear-gradient(160deg, rgba(24, 37, 38, .94), rgba(27, 43, 40, .88));
  box-shadow: 0 10px 28px rgba(0, 0, 0, .24);
}
.h3-town-scene__buildings h3 {
  margin: 0 0 9px;
  color: #f5d988;
  font: 700 13px/1.2 Georgia, serif;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.h3-town-scene__building-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  margin: 0;
  padding: 0;
  overflow: auto;
  list-style: none;
  scrollbar-width: thin;
}
.h3-town-scene__building {
  width: 100%;
  min-height: 47px;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 7px;
  padding: 7px 9px;
  text-align: left;
  color: #f7f1dd;
  border: 1px solid rgba(224, 219, 189, .16);
  border-radius: 8px;
  background: rgba(78, 96, 84, .28);
  cursor: pointer;
}
.h3-town-scene__building:hover, .h3-town-scene__building[aria-pressed="true"] {
  border-color: #e5ca7d;
  background: rgba(116, 126, 87, .42);
}
.h3-town-scene__building-name { font-size: 12px; font-weight: 650; line-height: 1.25; }
.h3-town-scene__building-status {
  color: #e6bd75;
  font-size: 9px;
  font-weight: 750;
  letter-spacing: .04em;
  text-transform: uppercase;
  white-space: nowrap;
}
.h3-town-scene__building[data-built="true"] .h3-town-scene__building-status { color: #9de1b1; }
.h3-town-scene__labels { position: absolute; inset: 0; z-index: 2; pointer-events: none; overflow: hidden; }
.h3-town-scene__label {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  max-width: 150px;
  padding: 4px 7px;
  border: 1px solid rgba(255, 239, 196, .52);
  border-radius: 6px;
  background: rgba(24, 35, 35, .86);
  box-shadow: 0 3px 10px rgba(0, 0, 0, .25);
  color: #fff8e6;
  font-size: 10px;
  font-weight: 650;
  line-height: 1.15;
  white-space: nowrap;
  will-change: transform;
}
.h3-town-scene__label::before {
  content: "";
  width: 6px;
  height: 6px;
  flex: 0 0 6px;
  border-radius: 50%;
  background: #e6ad67;
  box-shadow: 0 0 7px rgba(230, 173, 103, .55);
}
.h3-town-scene__label[data-built="true"]::before { background: #8fe1ab; box-shadow: 0 0 7px rgba(143, 225, 171, .6); }
.h3-town-scene__label[data-selected="true"] { border-color: #ffe28b; box-shadow: 0 0 0 2px rgba(255, 226, 139, .25), 0 4px 12px rgba(0,0,0,.3); }
.h3-town-scene__label[data-hover="true"] { background: rgba(57, 80, 64, .95); }
.h3-town-scene__label-status { color: #c9d2bd; font-size: 8px; font-weight: 500; }
.h3-town-scene__tooltip {
  position: absolute;
  z-index: 7;
  width: 235px;
  padding: 11px 12px;
  pointer-events: none;
  border: 1px solid #d7bd76;
  border-radius: 9px;
  background: rgba(22, 33, 35, .96);
  box-shadow: 0 8px 24px rgba(0, 0, 0, .35);
  font-size: 11px;
  line-height: 1.4;
}
.h3-town-scene__tooltip strong { display: block; margin-bottom: 4px; color: #ffe19a; font: 700 15px/1.2 Georgia, serif; }
.h3-town-scene__tooltip p { margin: 3px 0; }
.h3-town-scene__tooltip .h3-town-scene__muted { color: #b7c6b7; }
.h3-town-scene__hint {
  position: absolute;
  z-index: 3;
  left: 14px;
  bottom: 14px;
  max-width: calc(100% - 260px);
  padding: 7px 10px;
  border-radius: 7px;
  background: rgba(24, 37, 38, .78);
  color: #e1e6d4;
  font-size: 10px;
  pointer-events: none;
}
.h3-town-scene__empty {
  position: absolute;
  z-index: 8;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 18px 24px;
  border: 1px solid rgba(245, 221, 157, .35);
  border-radius: 12px;
  background: rgba(24, 37, 38, .92);
  color: #ede4c8;
  text-align: center;
}
.h3-town-scene__status {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@media (max-width: 760px) {
  .h3-town-scene__header { top: 8px; left: 8px; max-width: calc(100% - 205px); padding: 8px 10px; }
  .h3-town-scene__header h2 { font-size: 16px; }
  .h3-town-scene__header p { font-size: 10px; }
  .h3-town-scene__toolbar { top: 8px; right: 8px; gap: 3px; padding: 4px; }
  .h3-town-scene__toolbar button { width: 29px; height: 29px; font-size: 15px; }
  .h3-town-scene__buildings {
    top: auto;
    right: 8px;
    bottom: 8px;
    left: 8px;
    width: auto;
    max-height: 31%;
    padding: 8px;
  }
  .h3-town-scene__buildings h3 { margin-bottom: 6px; font-size: 11px; }
  .h3-town-scene__building-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; }
  .h3-town-scene__building { min-height: 40px; display: block; padding: 5px 6px; }
  .h3-town-scene__building-name { display: block; font-size: 10px; }
  .h3-town-scene__building-status { display: block; margin-top: 2px; font-size: 8px; }
  .h3-town-scene__label { max-width: 110px; padding: 3px 5px; font-size: 8px; }
  .h3-town-scene__label-status { display: none; }
  .h3-town-scene__hint { display: none; }
}
`;
