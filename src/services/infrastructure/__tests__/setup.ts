// Polyfill DOMMatrix for PDF.js compatibility in happy-dom environment
if (typeof window !== 'undefined' && !window.DOMMatrix) {
  window.DOMMatrix = class DOMMatrix {
    constructor() {}
  } as any;
}

if (typeof globalThis !== 'undefined' && !(globalThis as any).DOMMatrix) {
  (globalThis as any).DOMMatrix = class DOMMatrix {
    constructor() {}
  } as any;
}
