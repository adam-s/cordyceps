import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Disposable } from 'vs/base/common/lifecycle';
import { MessageServer, ClientConnectEvent } from '@shared/ipc/message/MessageServer';
import { ChannelClient, ChannelServer, Client } from 'vs/base/parts/ipc/common/ipc';
import { DynamicListEventMultiplexer, Emitter, Event } from 'vs/base/common/event';

// Helper to pull out just the keys of S whose values are Event<…>
type EventKeys<S> = {
  [K in keyof S]: S[K] extends Event<unknown> ? K : never;
}[keyof S];

// Helper to pull the payload type U out of Event<U>
type PayloadOf<T> = T extends Event<infer U> ? U : never;

export const IConnectionManager = createDecorator<IConnectionManager>('connectionManager');

export interface IConnectionManager {
  readonly _serviceBrand: undefined;
  /**
   * Multiplexes the Event<E> named `eventName` from all clients
   * on channel `channelName`, where `S` is the local service interface
   * that defines that event. The event name type is inferred from the value.
   */
  multiplex<S extends object>(
    channelName: string,
    eventName: EventKeys<S>,
    predicate?: (payload: PayloadOf<S[EventKeys<S>]>, ctx: string) => boolean | Promise<boolean>,
  ): Event<{ payload: PayloadOf<S[EventKeys<S>]>; ctx: string }>;
}

export interface Connection<TContext> extends Client<TContext> {
  readonly channelServer: ChannelServer<TContext>;
  readonly channelClient: ChannelClient;
  readonly ctx: TContext;
}

interface ManagedConnectionInfo {
  connectionId: string;
  tabId?: number;
  frameId?: number;
  disconnect: () => void;
}

export class ConnectionManager extends Disposable implements IConnectionManager {
  public readonly _serviceBrand: undefined;

  private readonly _messageServer: MessageServer;
  private readonly _multiplexers = new Map<
    string,
    DynamicListEventMultiplexer<Connection<string>, { payload: unknown; ctx: string }>
  >();
  private readonly _emitters = new Map<string, Emitter<{ payload: unknown; ctx: string }>>();
  private readonly _managedConnections = new Map<string, ManagedConnectionInfo>();

  constructor(messageServer: MessageServer) {
    super();
    this._messageServer = messageServer;

    // Log connect/disconnect for debugging and manage connections
    this._register(
      MessageServer.onDidClientConnect((event: ClientConnectEvent) => {
        console.log(
          `ConnectionManager: Client connected: ${event.id}, TabID: ${event.sender.tab?.id}, FrameID: ${event.sender.frameId}`,
        );
        const connectionInfo: ManagedConnectionInfo = {
          connectionId: event.id,
          tabId: event.sender.tab?.id,
          frameId: event.sender.frameId,
          disconnect: event.disconnect,
        };
        this._managedConnections.set(event.id, connectionInfo);

        this._register(
          event.onDidClientDisconnect(() => {
            console.log(
              `ConnectionManager: Client disconnected via onDidClientDisconnect: ${event.id}`,
            );
            // Remove redundant disconnect call to prevent recursion
            this._managedConnections.delete(event.id);
          }),
        );
      }),
    );
  }

  /**
   * Lazily create or return an existing multiplexer for this channel+event pair.
   */
  public multiplex<S extends object>(
    channelName: string,
    eventName: EventKeys<S>,
    predicate?: (payload: PayloadOf<S[EventKeys<S>]>, ctx: string) => boolean | Promise<boolean>,
  ): Event<{ payload: PayloadOf<S[EventKeys<S>]>; ctx: string }> {
    const key = `${channelName}::${String(eventName)}`;
    let emitter = this._emitters.get(key) as
      | Emitter<{ payload: PayloadOf<S[EventKeys<S>]>; ctx: string }>
      | undefined;

    if (!emitter) {
      // create an Emitter that fires {payload, ctx}
      emitter = new Emitter<{ payload: PayloadOf<S[EventKeys<S>]>; ctx: string }>();
      this._emitters.set(key, emitter as Emitter<{ payload: unknown; ctx: string }>);

      // build the multiplexer over *all* current & future connections
      const mux = new DynamicListEventMultiplexer<
        Connection<string>,
        { payload: PayloadOf<S[EventKeys<S>]>; ctx: string }
      >(
        Array.from(this._messageServer.connections),
        this._messageServer.onDidAddConnection,
        this._messageServer.onDidRemoveConnection,
        (connection: Connection<string>) => {
          const originalEvent = connection.channelClient
            .getChannel(channelName)
            .listen<PayloadOf<S[EventKeys<S>]>>(String(eventName));

          // Use Event.map for cleaner composition
          return Event.map(originalEvent, (eventPayload: PayloadOf<S[EventKeys<S>]>) => ({
            payload: eventPayload,
            ctx: connection.ctx,
          }));
        },
      );

      // If predicate is provided, we need manual async filtering
      if (predicate) {
        this._register(
          mux.event(async (data: { payload: PayloadOf<S[EventKeys<S>]>; ctx: string }) => {
            try {
              const shouldEmit = await predicate(data.payload, data.ctx);
              if (shouldEmit) {
                emitter?.fire(data);
              }
            } catch (error) {
              console.warn(`Predicate error for ${channelName}::${String(eventName)}:`, error);
              // Don't emit on predicate error
            }
          }),
        );
      } else {
        // No predicate - direct pass-through
        this._register(
          mux.event((data: { payload: PayloadOf<S[EventKeys<S>]>; ctx: string }) =>
            emitter?.fire(data),
          ),
        );
      }

      this._multiplexers.set(
        key,
        mux as DynamicListEventMultiplexer<Connection<string>, { payload: unknown; ctx: string }>,
      );
    }

    return emitter.event;
  }

  public override dispose(): void {
    // Clean up all multiplexers and emitters
    this._multiplexers.forEach(mux => mux.dispose());
    this._multiplexers.clear();
    this._emitters.forEach(emitter => emitter.dispose());
    this._emitters.clear();
    this._managedConnections.clear();

    // All registered disposables are automatically cleaned up by super.dispose()
    super.dispose();
  }
}
