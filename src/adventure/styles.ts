export const ADVENTURE_STYLES = `
  .h3-adventure {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: #142b30;
    color: #f6f0da;
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    user-select: none;
  }
  .h3-adventure canvas {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
    outline: none;
    cursor: default;
  }
  .h3-adventure canvas:focus-visible { box-shadow: inset 0 0 0 2px #edce7b; }
  .h3-adventure__vignette {
    position: absolute;
    inset: 0;
    pointer-events: none;
    box-shadow: inset 0 0 100px #07141688;
  }
  .h3-adventure__toolbar {
    position: absolute;
    top: 14px;
    right: 14px;
    display: flex;
    gap: 5px;
    padding: 5px;
    border: 1px solid #e3c77c55;
    border-radius: 10px;
    background: #10211edb;
    box-shadow: 0 6px 24px #0005;
  }
  .h3-adventure__toolbar button {
    width: 34px;
    height: 34px;
    padding: 0;
    border: 1px solid #dbc47b55;
    border-radius: 6px;
    background: #ffffff0a;
    color: #f5e7ba;
    font: 20px/1 ui-sans-serif, system-ui, sans-serif;
    cursor: pointer;
  }
  .h3-adventure__toolbar button:hover,
  .h3-adventure__toolbar button:focus-visible { background: #dbc47b2b; outline: none; }
  .h3-adventure__hero {
    position: absolute;
    left: 14px;
    bottom: 14px;
    max-width: min(360px, calc(100% - 28px));
    padding: 10px 14px;
    border: 1px solid #e3c77c55;
    border-radius: 9px;
    background: #10211edb;
    box-shadow: 0 6px 24px #0004;
    pointer-events: none;
  }
  .h3-adventure__hero strong { display: block; color: #f0d58e; font: 600 15px Georgia, serif; }
  .h3-adventure__hero span { color: #c8d8c6; font-size: 12px; }
  .h3-adventure__hint {
    position: absolute;
    top: 14px;
    left: 14px;
    padding: 6px 10px;
    border-radius: 6px;
    background: #0d1b19a8;
    color: #c8d8c6;
    font-size: 11px;
    white-space: nowrap;
    pointer-events: none;
  }
  .h3-adventure__tooltip {
    position: absolute;
    z-index: 3;
    width: max-content;
    max-width: min(290px, calc(100% - 20px));
    padding: 10px 12px;
    border: 1px solid #e3c77c88;
    border-radius: 8px;
    background: #10211ef2;
    box-shadow: 0 8px 28px #0007;
    pointer-events: none;
  }
  .h3-adventure__tooltip[hidden] { display: none; }
  .h3-adventure__tooltip strong { display: block; margin-bottom: 4px; color: #f0d58e; font: 600 15px Georgia, serif; }
  .h3-adventure__tooltip div { color: #d8e0d0; font-size: 12px; line-height: 1.45; }
  .h3-adventure__tooltip .h3-adventure__muted { margin-top: 4px; color: #9fb8aa; }
  .h3-adventure__status {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  @media (max-width: 700px) {
    .h3-adventure__hint { display: none; }
    .h3-adventure__hero { bottom: 10px; left: 10px; }
    .h3-adventure__toolbar { top: 10px; right: 10px; }
  }
`;
