/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const kAbortErrorSymbol = Symbol('kAbortError');

/**
 * Error thrown when a timeout is exceeded.
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

interface AbortError extends Error {
  [kAbortErrorSymbol]?: boolean;
}

/**
 * Check whether the given error was produced by an abort.
 */
export function isAbortError(error: Error): boolean {
  return Boolean((error as AbortError)[kAbortErrorSymbol]);
}

/**
 * Progress interface passed to tasks to enable logging, abort racing, and cleanup on abort.
 */
export interface Progress {
  /** Record a message for logging or debugging. */
  log(message: string): void;
  /** Register a cleanup callback that only runs if the operation is aborted. */
  cleanupWhenAborted(cleanup: (error?: Error) => void): void;
  /** Race your promise(s) against the internal abort signal. */
  race<T>(promise: Promise<T>): Promise<T>;
  race<T>(promises: Promise<T>[]): Promise<T>;
  /**
   * Race your promise against the internal abort signal,
   * and schedule a cleanup for the result if still running.
   */
  raceWithCleanup<T>(promise: Promise<T>, cleanup: (result: T) => void): Promise<T>;
  /** Wait for a specified timeout period, abortable by the progress signal. */
  wait(timeoutMs: number): Promise<void>;
  /** Abort the operation with an error; subsequent races will reject. */
  abort(error: Error): void;
}

/**
 * Controller for running tasks with timeout and abort semantics.
 * Implements the Progress interface.
 */
export class ProgressController implements Progress {
  private _state: 'before' | 'running' | 'aborted' | 'finished' = 'before';
  private _cleanupCallbacks: Array<(error?: Error) => void> = [];
  private _abortReject: (error: Error) => void;
  private _abortPromise: Promise<never>;
  private _timer?: NodeJS.Timeout;
  private _aborted = false;

  /**
   * @param timeout - maximum duration in milliseconds before automatic abort
   * @param parent - optional parent Progress to delegate logs to
   */
  constructor(
    private readonly _timeout: number,
    private readonly _parent?: Progress,
  ) {
    // Create an abort promise and capture its reject function.
    let abortRejectLocal: (error: Error) => void = () => {};
    this._abortPromise = new Promise<never>((_, reject) => {
      abortRejectLocal = (error: Error) => {
        (error as AbortError)[kAbortErrorSymbol] = true;
        reject(error);
      };
    });
    this._abortReject = abortRejectLocal;
    // Prevent unhandled rejection warnings.
    this._abortPromise.catch(() => {});
  }

  public log(message: string): void {
    if (this._parent) {
      this._parent.log(message);
    } else {
      console.debug(message);
    }
  }

  public cleanupWhenAborted(cleanup: (error?: Error) => void): void {
    if (this._state === 'running' || this._state === 'before') {
      this._cleanupCallbacks.push(cleanup);
    }
  }

  public race<T>(promise: Promise<T>): Promise<T>;
  public race<T>(promises: Promise<T>[]): Promise<T>;
  public race<T>(promiseOrPromises: Promise<T> | Promise<T>[]): Promise<T> {
    const promises = Array.isArray(promiseOrPromises) ? promiseOrPromises : [promiseOrPromises];
    return Promise.race([...promises, this._abortPromise]);
  }

  public raceWithCleanup<T>(promise: Promise<T>, cleanup: (result: T) => void): Promise<T> {
    return this.race(
      promise.then(result => {
        if (this._state === 'running') {
          this._cleanupCallbacks.push(() => cleanup(result));
        } else if (this._state === 'finished') {
          cleanup(result);
        }
        return result;
      }),
    );
  }

  public wait(timeoutMs: number): Promise<void> {
    return this.race(new Promise<void>(resolve => setTimeout(resolve, timeoutMs)));
  }

  /**
   * Run the provided task, aborting if it does not complete within the timeout.
   */
  public async run<T>(task: (progress: Progress) => Promise<T>): Promise<T> {
    if (this._state !== 'before') throw new Error('ProgressController can only be run once');
    this._state = 'running';

    let caughtError: Error | undefined;
    if (this._timeout > 0) {
      this._timer = setTimeout(() => {
        if (this._state === 'running')
          this.abort(new TimeoutError(`Timeout ${this._timeout}ms exceeded.`));
      }, this._timeout);
    }

    try {
      const result = await task(this);
      this._state = 'finished';
      return result;
    } catch (error) {
      caughtError = error as Error;
      if (this._state === 'running') this.abort(caughtError);
      throw caughtError;
    } finally {
      if (this._timer) clearTimeout(this._timer);
      // Run cleanup callbacks only if we ended up in an aborted state
      if (this._aborted && this._cleanupCallbacks.length > 0) {
        for (const cb of this._cleanupCallbacks) {
          try {
            cb(caughtError);
          } catch {
            // Ignore cleanup errors
          }
        }
        this._cleanupCallbacks.length = 0;
      }
    }
  }

  /**
   * Abort the operation with the given error. Subsequent .race() calls will reject.
   */
  public abort(error: Error): void {
    if (this._state !== 'running') return;
    this._state = 'aborted';
    this._aborted = true;
    this._abortReject(error);
  }
}

/**
 * Execute a function with progress handling, using either a provided Progress instance
 * or creating a new ProgressController with the given timeout.
 */
export function executeWithProgress<T>(
  fn: (p: Progress) => Promise<T>,
  options: { timeout?: number; progress?: Progress } = {},
): Promise<T> {
  const { timeout = 30000, progress } = options;
  if (progress) return progress.race(fn(progress));
  return new ProgressController(timeout).run(fn);
}
