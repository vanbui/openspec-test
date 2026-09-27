import { vi } from 'vitest';

/*
 * jsdom lays nothing out and has no ResizeObserver: every element measures 0 and nothing reports a
 * resize. These stubs give an element the horizontal scroll geometry a test needs and deliver
 * resize notifications on demand, so semantics that depend on measured overflow can be asserted.
 */

export type HorizontalGeometry = { scrollWidth: number; clientWidth: number; scrollLeft?: number };

/** Gives one element a scroll geometry; `scrollLeft` stays writable so a test can scroll it. */
export function stubHorizontalGeometry(element: Element, { clientWidth, scrollLeft = 0, scrollWidth }: HorizontalGeometry) {
  Object.defineProperty(element, 'scrollWidth', { configurable: true, value: scrollWidth });
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: clientWidth });
  Object.defineProperty(element, 'scrollLeft', { configurable: true, writable: true, value: scrollLeft });
}

/** Gives one element a rendered width, as a layout engine would report it. */
export function stubRenderedWidth(element: Element, width: number) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ x: 0, y: 0, top: 0, left: 0, right: width, bottom: 0, width, height: 0, toJSON: () => ({}) }),
  });
}

/**
 * A ResizeObserver that reports synchronously: once per target when observed, as a real observer
 * reports every new target, and again for every connected observer on `notifyAll()`.
 */
export class TestResizeObserver {
  static readonly connected = new Set<TestResizeObserver>();
  readonly targets = new Set<Element>();
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    this.targets.add(target);
    TestResizeObserver.connected.add(this);
    this.callback([], this as unknown as ResizeObserver);
  }

  unobserve(target: Element) {
    this.targets.delete(target);
  }

  disconnect() {
    this.targets.clear();
    TestResizeObserver.connected.delete(this);
  }

  static notifyAll() {
    for (const observer of TestResizeObserver.connected) observer.callback([], observer as unknown as ResizeObserver);
  }
}

/** Installs the synchronous observer for one test; `vi.unstubAllGlobals()` removes it. */
export function installTestResizeObserver() {
  TestResizeObserver.connected.clear();
  vi.stubGlobal('ResizeObserver', TestResizeObserver);
}
