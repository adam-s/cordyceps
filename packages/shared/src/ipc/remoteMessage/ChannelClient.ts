/* eslint-disable @typescript-eslint/no-explicit-any */
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancelablePromise, createCancelablePromise } from 'vs/base/common/async';
import { VSBuffer } from 'vs/base/common/buffer';
import { CancellationToken, CancellationTokenSource } from 'vs/base/common/cancellation';
import { memoize } from 'vs/base/common/decorators';
import { CancellationError } from 'vs/base/common/errors';
import { Emitter, Event } from 'vs/base/common/event';
import { combinedDisposable, dispose, IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import {
  BufferReader,
  BufferWriter,
  deserialize,
  IIPCLogger,
  RequestInitiator,
  serialize,
} from 'vs/base/parts/ipc/common/ipc';
import { Protocol } from './Protocol';

const enum RequestType {
  Promise = 100,
  PromiseCancel = 101,
  EventListen = 102,
  EventDispose = 103,
}

function requestTypeToStr(type: RequestType): string {
  switch (type) {
    case RequestType.Promise:
      return 'req';
    case RequestType.PromiseCancel:
      return 'cancel';
    case RequestType.EventListen:
      return 'subscribe';
    case RequestType.EventDispose:
      return 'unsubscribe';
  }
}

type IRawPromiseRequest = {
  type: RequestType.Promise;
  id: number;
  channelName: string;
  name: string;
  arg: any;
};
type IRawRequest =
  | IRawPromiseRequest
  | { type: RequestType.PromiseCancel; id: number }
  | {
      type: RequestType.EventListen;
      id: number;
      channelName: string;
      name: string;
      arg: any;
    }
  | { type: RequestType.EventDispose; id: number };

export const enum ResponseType {
  Initialize = 200,
  PromiseSuccess = 201,
  PromiseError = 202,
  PromiseErrorObj = 203,
  EventFire = 204,
}

export function responseTypeToStr(type: ResponseType): string {
  switch (type) {
    case ResponseType.Initialize:
      return `init`;
    case ResponseType.PromiseSuccess:
      return `reply:`;
    case ResponseType.PromiseError:
    case ResponseType.PromiseErrorObj:
      return `replyErr:`;
    case ResponseType.EventFire:
      return `event:`;
  }
}

type IRawPromiseSuccessResponse = {
  type: ResponseType.PromiseSuccess;
  id: number;
  data: any;
};
type IRawPromiseErrorResponse = {
  type: ResponseType.PromiseError;
  id: number;
  data: { message: string; name: string; stack: string[] | undefined };
};
type IRawPromiseErrorObjResponse = {
  type: ResponseType.PromiseErrorObj;
  id: number;
  data: any;
};
type IRawEventFireResponse = {
  type: ResponseType.EventFire;
  id: number;
  data: any;
};
// Completing the type definition with an explicit initialization response
type IRawInitializeResponse = {
  type: ResponseType.Initialize;
};
type IRawResponse =
  | IRawInitializeResponse
  | IRawPromiseSuccessResponse
  | IRawPromiseErrorResponse
  | IRawPromiseErrorObjResponse
  | IRawEventFireResponse;

interface IHandler {
  (response: IRawResponse): void;
}

enum State {
  Uninitialized,
  Idle,
}

interface PendingRequest {
  request: IRawPromiseRequest | IRawEventListenRequest;
  timeoutTimer: any;
}

/**
 * An `IChannel` is an abstraction over a collection of commands.
 * You can `call` several commands on a channel, each taking at
 * most one single argument. A `call` always returns a promise
 * with at most one single return value.
 */
export interface IChannel {
  call<T>(command: string, arg?: any, cancellationToken?: CancellationToken): Promise<T>;
  listen<T>(event: string, arg?: any): Event<T>;
}

/**
 * An `IServerChannel` is the counter part to `IChannel`,
 * on the server-side. You should implement this interface
 * if you'd like to handle remote promises or events.
 */
export interface IServerChannel<TContext = string> {
  call<T>(
    ctx: TContext,
    command: string,
    arg?: any,
    cancellationToken?: CancellationToken,
  ): Promise<T>;
  listen<T>(ctx: TContext, event: string, arg?: any): Event<T>;
}

/**
 * An `IChannelServer` hosts a collection of channels. You are
 * able to register channels onto it, provided a channel name.
 */
export interface IChannelServer<TContext = string> {
  registerChannel(channelName: string, channel: IServerChannel<TContext>): void;
}

/**
 * An `IChannelClient` has access to a collection of channels. You
 * are able to get those channels, given their channel name.
 */
export interface IChannelClient {
  getChannel<T extends IChannel>(channelName: string): T;
}

export interface IMessagePassingProtocol {
  send(buffer: VSBuffer): void;
  onMessage: Event<VSBuffer>;
  /**
   * Wait for the write buffer (if applicable) to become empty.
   */
  drain?(): Promise<void>;
}

type IRawEventListenRequest = {
  type: RequestType.EventListen;
  id: number;
  channelName: string;
  name: string;
  arg: any;
};

export class ChannelServer<TContext = string> implements IChannelServer<TContext>, IDisposable {
  private channels = new Map<string, IServerChannel<TContext>>();
  private activeRequests = new Map<number, IDisposable>();
  private protocolListener: IDisposable | null;

  // Requests might come in for channels which are not yet registered.
  // They will timeout after `timeoutDelay`.
  private pendingRequests = new Map<string, PendingRequest[]>();

  constructor(
    private protocol: IMessagePassingProtocol,
    private ctx: TContext,
    private logger: IIPCLogger | null = null,
    private timeoutDelay: number = 1000,
  ) {
    this.protocolListener = this.protocol.onMessage(msg => this.onRawMessage(msg));
  }

  registerChannel(channelName: string, channel: IServerChannel<TContext>): void {
    this.channels.set(channelName, channel);

    // https://github.com/microsoft/vscode/issues/72531
    setTimeout(() => this.flushPendingRequests(channelName), 0);
  }

  private sendResponse(response: IRawResponse): void {
    switch (response.type) {
      case ResponseType.Initialize: {
        const msgLength = this.send([response.type]);
        this.logger?.logOutgoing(
          msgLength,
          0,
          RequestInitiator.OtherSide,
          responseTypeToStr(response.type),
        );
        return;
      }

      case ResponseType.PromiseSuccess:
      case ResponseType.PromiseError:
      case ResponseType.EventFire:
      case ResponseType.PromiseErrorObj: {
        const msgLength = this.send([response.type, response.id], response.data);
        this.logger?.logOutgoing(
          msgLength,
          response.id,
          RequestInitiator.OtherSide,
          responseTypeToStr(response.type),
          response.data,
        );
        return;
      }
    }
  }

  private send(header: any, body: any = undefined): number {
    const writer = new BufferWriter();
    serialize(writer, header);
    serialize(writer, body);
    return this.sendBuffer(writer.buffer);
  }

  private sendBuffer(message: VSBuffer): number {
    try {
      this.protocol.send(message);
      return message.byteLength;
    } catch (err) {
      // noop
      return 0;
    }
  }

  private onRawMessage(message: VSBuffer): void {
    const reader = new BufferReader(message);
    const header = deserialize(reader);
    const body = deserialize(reader);
    const type = header?.[0] as RequestType;
    switch (type) {
      case RequestType.Promise:
        this.logger?.logIncoming(
          message.byteLength,
          header[1],
          RequestInitiator.OtherSide,
          `${requestTypeToStr(type)}: ${header[2]}.${header[3]}`,
          body,
        );
        return this.onPromise({
          type,
          id: header[1],
          channelName: header[2],
          name: header[3],
          arg: body,
        });
      case RequestType.EventListen:
        this.logger?.logIncoming(
          message.byteLength,
          header[1],
          RequestInitiator.OtherSide,
          `${requestTypeToStr(type)}: ${header[2]}.${header[3]}`,
          body,
        );
        return this.onEventListen({
          type,
          id: header[1],
          channelName: header[2],
          name: header[3],
          arg: body,
        });
      case RequestType.PromiseCancel:
        this.logger?.logIncoming(
          message.byteLength,
          header[1],
          RequestInitiator.OtherSide,
          `${requestTypeToStr(type)}`,
        );
        return this.disposeActiveRequest({ type, id: header[1] });
      case RequestType.EventDispose:
        this.logger?.logIncoming(
          message.byteLength,
          header[1],
          RequestInitiator.OtherSide,
          `${requestTypeToStr(type)}`,
        );
        return this.disposeActiveRequest({ type, id: header[1] });
    }
  }

  private onPromise(request: IRawPromiseRequest): void {
    const channel = this.channels.get(request.channelName);

    if (!channel) {
      this.collectPendingRequest(request);
      return;
    }

    const cancellationTokenSource = new CancellationTokenSource();
    let promise: Promise<any>;

    try {
      promise = channel.call(this.ctx, request.name, request.arg, cancellationTokenSource.token);
    } catch (err) {
      promise = Promise.reject(err);
    }

    const id = request.id;

    promise
      .then(
        data => {
          this.sendResponse({ id, data, type: ResponseType.PromiseSuccess });
        },
        err => {
          if (err instanceof Error) {
            this.sendResponse({
              id,
              data: {
                message: err.message,
                name: err.name,
                stack: err.stack ? err.stack.split('\n') : undefined,
              },
              type: ResponseType.PromiseError,
            });
          } else {
            this.sendResponse({
              id,
              data: err,
              type: ResponseType.PromiseErrorObj,
            });
          }
        },
      )
      .finally(() => {
        disposable.dispose();
        this.activeRequests.delete(request.id);
      });

    const disposable = toDisposable(() => cancellationTokenSource.cancel());
    this.activeRequests.set(request.id, disposable);
  }

  private onEventListen(request: IRawEventListenRequest): void {
    const channel = this.channels.get(request.channelName);

    if (!channel) {
      this.collectPendingRequest(request);
      return;
    }

    const id = request.id;
    const event = channel.listen(this.ctx, request.name, request.arg);
    const disposable = event(data => {
      this.sendResponse({ id, data, type: ResponseType.EventFire });
    });

    this.activeRequests.set(request.id, disposable);
  }

  private disposeActiveRequest(request: IRawRequest): void {
    const disposable = this.activeRequests.get(request.id);

    if (disposable) {
      disposable.dispose();
      this.activeRequests.delete(request.id);
    }
  }

  private collectPendingRequest(request: IRawPromiseRequest | IRawEventListenRequest): void {
    let pendingRequests = this.pendingRequests.get(request.channelName);

    if (!pendingRequests) {
      pendingRequests = [];
      this.pendingRequests.set(request.channelName, pendingRequests);
    }

    const timer = setTimeout(() => {
      if (request.type === RequestType.Promise) {
        this.sendResponse({
          id: request.id,
          data: {
            name: 'Unknown channel',
            message: `Channel name '${request.channelName}' timed out after ${this.timeoutDelay}ms`,
            stack: undefined,
          },
          type: ResponseType.PromiseError,
        });
      }
    }, this.timeoutDelay);

    pendingRequests.push({ request, timeoutTimer: timer });
  }

  private flushPendingRequests(channelName: string): void {
    const requests = this.pendingRequests.get(channelName);

    if (requests) {
      for (const request of requests) {
        clearTimeout(request.timeoutTimer);

        switch (request.request.type) {
          case RequestType.Promise:
            this.onPromise(request.request);
            break;
          case RequestType.EventListen:
            this.onEventListen(request.request);
            break;
        }
      }

      this.pendingRequests.delete(channelName);
    }
  }

  public dispose(): void {
    if (this.protocolListener) {
      this.protocolListener.dispose();
      this.protocolListener = null;
    }
    dispose(this.activeRequests.values());
    this.activeRequests.clear();
  }
}

// Debug configuration interface
interface IDebugOptions {
  enabled: boolean;
  logEvents?: boolean;
  logRequests?: boolean;
  eventFilter?: (channelName: string, eventName: string) => boolean;
}

/**
 * Channel debugging utilities
 */
class ChannelDebugger {
  constructor(private options: IDebugOptions) {}

  logEvent(
    channelName: string,
    eventName: string,
    data: any,
    phase: 'raw' | 'processed' = 'processed',
  ) {
    if (!this.options.enabled || !this.options.logEvents) return;
    if (this.options.eventFilter?.(channelName, eventName) === false) return;

    console.group(`Channel Event: ${channelName}.${eventName} (${phase})`);
    console.log('Data:', data);
    console.trace('Event Stack');
    console.groupEnd();
  }

  logRequest(channelName: string, command: string, args: any) {
    if (!this.options.enabled || !this.options.logRequests) return;

    console.group(`Channel Request: ${channelName}.${command}`);
    console.log('Arguments:', args);
    console.trace('Request Stack');
    console.groupEnd();
  }
}
export class ChannelClient implements IChannelClient, IDisposable {
  private debugger_: ChannelDebugger; // Renamed to avoid readonly conflict
  private debugOptions: IDebugOptions;

  private isDisposed: boolean = false;
  private state: State = State.Uninitialized;
  private activeRequests = new Set<IDisposable>();
  private handlers = new Map<number, IHandler>();
  private lastRequestId: number = 0;
  private protocolListener: IDisposable | null;
  private logger: IIPCLogger | null;

  private readonly _onDidInitialize = new Emitter<void>();
  readonly onDidInitialize = this._onDidInitialize.event;

  constructor(
    private protocol: Protocol,
    logger: IIPCLogger | null = null,
    debugOptions: IDebugOptions = { enabled: false },
  ) {
    this.protocolListener = this.protocol.onMessage(this.onBuffer.bind(this));
    this.logger = logger;
    this.debugOptions = debugOptions;
    this.debugger_ = new ChannelDebugger(this.debugOptions);
  }

  getChannel<T extends IChannel>(channelName: string): T {
    const channel = {
      call: (command: string, arg?: any, cancellationToken?: CancellationToken) => {
        this.debugger_.logRequest(channelName, command, arg);
        return this.requestPromise(channelName, command, arg, cancellationToken);
      },
      listen: (event: string, arg: any) => {
        const baseEvent = this.requestEvent(channelName, event, arg);

        return Event.chain(baseEvent, $ =>
          $.map(data => {
            this.debugger_.logEvent(channelName, event, data, 'raw');
            return data;
          })
            .map(data => {
              // Filter if needed
              if (this.debugOptions?.eventFilter?.(channelName, event) === false) {
                return undefined;
              }
              return data;
            })
            .filter((data): data is any => data !== undefined)
            .map(data => {
              this.debugger_.logEvent(channelName, event, data, 'processed');
              return data;
            }),
        );
      },
    } as T;

    return channel;
  }

  private requestPromise(
    channelName: string,
    name: string,
    arg?: any,
    cancellationToken = CancellationToken.None,
  ): Promise<any> {
    const id = this.lastRequestId++;
    const type = RequestType.Promise;
    const request: IRawRequest = { id, type, channelName, name, arg };

    if (cancellationToken.isCancellationRequested) {
      return Promise.reject(new CancellationError());
    }

    let disposable: IDisposable;

    const result = new Promise((c, e) => {
      if (cancellationToken.isCancellationRequested) {
        return e(new CancellationError());
      }

      const doRequest = () => {
        const handler: IHandler = response => {
          switch (response.type) {
            case ResponseType.PromiseSuccess:
              this.handlers.delete(id);
              c(response.data);
              break;

            case ResponseType.PromiseError: {
              this.handlers.delete(id);
              const error = new Error(response.data.message);
              (<any>error).stack = Array.isArray(response.data.stack)
                ? response.data.stack.join('\n')
                : response.data.stack;
              error.name = response.data.name;
              e(error);
              break;
            }
            case ResponseType.PromiseErrorObj:
              this.handlers.delete(id);
              e(response.data);
              break;
          }
        };

        this.handlers.set(id, handler);
        this.sendRequest(request);
      };

      let uninitializedPromise: CancelablePromise<void> | null = null;
      if (this.state === State.Idle) {
        doRequest();
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        uninitializedPromise = createCancelablePromise(() => this.whenInitialized());
        uninitializedPromise.then(() => {
          uninitializedPromise = null;
          doRequest();
        });
      }

      const cancel = () => {
        if (uninitializedPromise) {
          uninitializedPromise.cancel();
          uninitializedPromise = null;
        } else {
          this.sendRequest({ id, type: RequestType.PromiseCancel });
        }

        e(new CancellationError());
      };

      const cancellationTokenListener = cancellationToken.onCancellationRequested(cancel);
      disposable = combinedDisposable(toDisposable(cancel), cancellationTokenListener);
      this.activeRequests.add(disposable);
    });

    return result.finally(() => {
      disposable.dispose();
      this.activeRequests.delete(disposable);
    });
  }

  private requestEvent(channelName: string, name: string, arg?: any): Event<any> {
    const id = this.lastRequestId++;
    const type = RequestType.EventListen;
    const request: IRawRequest = { id, type, channelName, name, arg };

    let uninitializedPromise: CancelablePromise<void> | null = null;

    const emitter = new Emitter<any>({
      onWillAddFirstListener: () => {
        uninitializedPromise = createCancelablePromise(() => this.whenInitialized());
        uninitializedPromise.then(() => {
          uninitializedPromise = null;
          this.activeRequests.add(emitter);
          this.sendRequest(request);

          this.protocol.onReconnect?.(() => {
            this.sendRequest(request);
          });
        });
      },
      onDidRemoveLastListener: () => {
        if (uninitializedPromise) {
          uninitializedPromise.cancel();
          uninitializedPromise = null;
        } else {
          this.activeRequests.delete(emitter);
          this.sendRequest({ id, type: RequestType.EventDispose });
        }
      },
    });

    const handler: IHandler = (res: IRawResponse) => {
      if (res.type === ResponseType.EventFire) {
        emitter.fire((res as IRawEventFireResponse).data);
      }
    };
    this.handlers.set(id, handler);

    return emitter.event;
  }

  private setupEventListener(id: number, channelName: string, name: string, arg?: any): void {
    const request = {
      id,
      type: RequestType.EventListen,
      channelName,
      name,
      arg,
    };

    const handler = (res: IRawResponse) => {
      if (res.type === ResponseType.EventFire) {
        this.debugger_.logEvent(channelName, name, res.data);
        this.fireEvent(id, res.data);
      }
    };

    this.handlers.set(id, handler);
    this.sendRequest(request);
  }

  private cleanupEventListener(id: number): void {
    this.handlers.delete(id);
    this.sendRequest({ id, type: RequestType.EventDispose });
  }

  private fireEvent(id: number, data: any): void {
    const handler = this.handlers.get(id);
    handler?.(data);
  }

  private sendRequest(request: IRawRequest): void {
    switch (request.type) {
      case RequestType.Promise:
      case RequestType.EventListen: {
        const msgLength = this.send(
          [request.type, request.id, request.channelName, request.name],
          request.arg,
        );
        this.logger?.logOutgoing(
          msgLength,
          request.id,
          RequestInitiator.LocalSide,
          `${requestTypeToStr(request.type)}: ${request.channelName}.${request.name}`,
          request.arg,
        );
        return;
      }

      case RequestType.PromiseCancel:
      case RequestType.EventDispose: {
        const msgLength = this.send([request.type, request.id]);
        this.logger?.logOutgoing(
          msgLength,
          request.id,
          RequestInitiator.LocalSide,
          requestTypeToStr(request.type),
        );
        return;
      }
    }
  }

  private send(header: any, body: any = undefined): number {
    const writer = new BufferWriter();
    serialize(writer, header);
    serialize(writer, body);
    return this.sendBuffer(writer.buffer);
  }

  private sendBuffer(message: VSBuffer): number {
    try {
      this.protocol.send(message);
      return message.byteLength;
    } catch (err) {
      // noop
      return 0;
    }
  }

  private onBuffer(message: VSBuffer): void {
    const reader = new BufferReader(message);
    const header = deserialize(reader);
    const body = deserialize(reader);
    const type: ResponseType = header?.[0] as ResponseType;
    switch (type) {
      case ResponseType.Initialize:
        this.logger?.logIncoming(
          message.byteLength,
          0,
          RequestInitiator.LocalSide,
          responseTypeToStr(type),
        );
        return this.onResponse({ type: header[0] });

      case ResponseType.PromiseSuccess:
      case ResponseType.PromiseError:
      case ResponseType.EventFire:
      case ResponseType.PromiseErrorObj:
        this.logger?.logIncoming(
          message.byteLength,
          header[1],
          RequestInitiator.LocalSide,
          responseTypeToStr(type),
          body,
        );
        return this.onResponse({ type: header[0], id: header[1], data: body });
    }
  }

  private onResponse(response: IRawResponse): void {
    if (response.type === ResponseType.Initialize) {
      this.state = State.Idle;
      this._onDidInitialize.fire();
      return;
    }

    const handler = this.handlers.get(response.id);

    handler?.(response);
  }

  @memoize
  get onDidInitializePromise(): Promise<void> {
    return Event.toPromise(this.onDidInitialize);
  }

  private whenInitialized(): Promise<void> {
    if (this.state === State.Idle) {
      return Promise.resolve();
    } else {
      return this.onDidInitializePromise;
    }
  }

  /**
   * Enable or update debug options at runtime
   */
  setDebugOptions(options: Partial<IDebugOptions>): void {
    this.debugOptions = { ...this.debugOptions, ...options };
    this.debugger_ = new ChannelDebugger(this.debugOptions);
  }

  dispose(): void {
    this.isDisposed = true;
    if (this.protocolListener) {
      this.protocolListener.dispose();
      this.protocolListener = null;
    }
    dispose(this.activeRequests.values());
    this.activeRequests.clear();
  }
}
