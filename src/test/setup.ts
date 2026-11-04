import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// jsdom lacks matchMedia (used by framer-motion's reduced-motion hook)
if (!window.matchMedia) {
  window.matchMedia = (q: string) =>
    ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as MediaQueryList;
}
