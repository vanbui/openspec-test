import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom does not implement browser scrolling; individual tests can replace this when they assert scroll behavior.
if (typeof Element !== 'undefined') Element.prototype.scrollIntoView ??= () => {};

afterEach(() => {
  cleanup();
});
