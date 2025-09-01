/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

import type { IDisposable } from 'vs/base/common/lifecycle';
import type { Event } from 'vs/base/common/event';
import type { Progress } from '../core/progress';
import type * as types from '../utilities/types';

class Helper {
  static completeUserURL(urlString: string): string {
    if (urlString.startsWith('localhost') || urlString.startsWith('127.0.0.1'))
      urlString = 'http://' + urlString;
    return urlString;
  }

  static enclosingIntRect(rect: types.Rect): types.Rect {
    const x = Math.floor(rect.x + 1e-3);
    const y = Math.floor(rect.y + 1e-3);
    const x2 = Math.ceil(rect.x + rect.width - 1e-3);
    const y2 = Math.ceil(rect.y + rect.height - 1e-3);
    return { x, y, width: x2 - x, height: y2 - y };
  }

  static enclosingIntSize(size: types.Size): types.Size {
    return { width: Math.floor(size.width + 1e-3), height: Math.floor(size.height + 1e-3) };
  }

  static getViewportSizeFromWindowFeatures(features: string[]): types.Size | null {
    const widthString = features.find(f => f.startsWith('width='));
    const heightString = features.find(f => f.startsWith('height='));
    const width = widthString ? parseInt(widthString.substring(6), 10) : NaN;
    const height = heightString ? parseInt(heightString.substring(7), 10) : NaN;
    if (!Number.isNaN(width) && !Number.isNaN(height)) return { width, height };
    return null;
  }

  static waitForEvent<T>(
    progress: Progress,
    event: Event<T>,
    predicate?: (e: T) => boolean,
  ): { promise: Promise<T>; dispose: () => void } {
    let disposable: IDisposable;
    const promise = new Promise<T>((resolve, reject) => {
      disposable = event(e => {
        try {
          if (predicate && !predicate(e)) {
            return;
          }
          disposable.dispose();
          resolve(e);
        } catch (error) {
          disposable.dispose();
          reject(error);
        }
      });
    });

    const dispose = () => {
      if (disposable) {
        disposable.dispose();
      }
    };
    progress.cleanupWhenAborted(dispose);
    return { promise: progress.race(promise), dispose };
  }

  static secondsToRoundishMillis(value: number): number {
    return ((value * 1000000) | 0) / 1000;
  }

  static millisToRoundishMillis(value: number): number {
    return ((value * 1000) | 0) / 1000;
  }
}

export const helper = Helper;
