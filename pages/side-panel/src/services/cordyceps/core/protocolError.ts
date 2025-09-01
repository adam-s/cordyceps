/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { rewriteErrorMessage } from '@injected/isomorphic/stackTrace';

export class ProtocolError extends Error {
  type: 'error' | 'closed' | 'crashed';
  method: string | undefined;
  logs: string | undefined;

  constructor(type: 'error' | 'closed' | 'crashed', method?: string, logs?: string) {
    super();
    this.type = type;
    this.method = method;
    this.logs = logs;
  }

  static from(e: unknown, method: string): ProtocolError {
    const message = e instanceof Error ? e.message : String(e);

    // Check for specific error messages that indicate a closed or invalid target.
    if (
      message.includes('No tab with id') ||
      message.includes('No frame with id') ||
      message.includes('Cannot access a closed tab') ||
      message.includes('The tab was closed')
    ) {
      const error = new ProtocolError('closed', method);
      error.setMessage(`Target closed during ${method}: ${message}`);
      return error;
    }

    const error = new ProtocolError('error', method);
    error.setMessage(message);
    return error;
  }

  setMessage(message: string) {
    rewriteErrorMessage(this, `Protocol error (${this.method}): ${message}`);
  }

  browserLogMessage() {
    return this.logs ? '\nBrowser logs:\n' + this.logs : '';
  }
}

export function isProtocolError(e: Error): e is ProtocolError {
  return e instanceof ProtocolError;
}

export function isSessionClosedError(e: Error): e is ProtocolError {
  return e instanceof ProtocolError && (e.type === 'closed' || e.type === 'crashed');
}
