export interface ElementHandle<T extends Element = Element> {
  element: T;
  dispose(): void;
  click(): Promise<void>;
  // Add other methods as needed
}

export function assertDone(result: 'done'): void {
  if (result !== 'done') {
    throw new Error(`Expected 'done', but got '${result}'`);
  }
}
