import { ISocketLike } from '@shared/ipc/remoteMessage/Protocol';
import { io as SocketIOClient } from 'socket.io-client';
import { Logger, LogComponent } from '@shared/utils/logging';

/**
 * Socket factory for creating client socket instances
 * that implement the ISocketLike interface for browser environments
 */
export class SocketClientFactory {
  private static readonly DEFAULT_PORT = 3000;
  private static readonly logger = Logger.forComponent('SocketClientFactory' as LogComponent);

  /**
   * Create a socket client instance that connects to the server
   */
  static createClientSocket(path = '/socket'): ISocketLike {
    this.logger.debug(`Creating client socket with path: ${path}`);

    // Use the DEFAULT_PORT constant for connection
    const url = `http://localhost:${this.DEFAULT_PORT}`;
    this.logger.debug(`Connecting to: ${url}`);

    const socket = SocketIOClient(url, {
      path,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    // Track event handlers with their wrapper functions
    const handlerMap: Map<
      string,
      Map<(...args: unknown[]) => void, (...args: unknown[]) => void>
    > = new Map();

    // Add connection event handlers for better debugging
    socket.on('connect', () => {
      this.logger.debug(`Connected successfully with ID: ${socket.id}`);
    });

    socket.on('connect_error', error => {
      this.logger.debug(`Connection error: ${error.message}`);
    });

    socket.on('reconnect_attempt', attempt => {
      this.logger.debug(`Reconnection attempt #${attempt}`);
    });

    this.logger.debug('Client socket created successfully');

    // Create a socket adapter that implements ISocketLike
    return {
      emit(event: string, ...args: unknown[]): boolean {
        SocketClientFactory.logger.debug(`Emitting event: ${event}`, args);
        socket.emit(event, ...args);
        return true;
      },

      on(event: string, listener: (...args: unknown[]) => void): ISocketLike {
        SocketClientFactory.logger.debug(`Registering listener for event: ${event}`);

        // Initialize handler map for this event if needed
        if (!handlerMap.has(event)) {
          handlerMap.set(event, new Map());
        }

        // Check if we already have this listener registered
        if (!handlerMap.get(event)!.has(listener)) {
          // Create a wrapper function that we can reference for removal
          const wrapperFn = (...args: unknown[]) => {
            SocketClientFactory.logger.debug(`Event received: ${event}`, args);
            listener(...args);
          };

          // Store the mapping
          handlerMap.get(event)!.set(listener, wrapperFn);

          // Register with socket
          socket.on(event, wrapperFn);
        } else {
          SocketClientFactory.logger.debug(
            `Listener for ${event} already registered, skipping duplicate`,
          );
        }

        return this;
      },

      off(event: string, listener: (...args: unknown[]) => void): ISocketLike {
        SocketClientFactory.logger.debug(`Removing listener for event: ${event}`);

        // Find and remove the wrapper function
        if (handlerMap.has(event)) {
          const wrapperFn = handlerMap.get(event)!.get(listener);

          if (wrapperFn) {
            socket.off(event, wrapperFn);
            handlerMap.get(event)!.delete(listener);

            // Clean up empty maps
            if (handlerMap.get(event)!.size === 0) {
              handlerMap.delete(event);
            }
          }
        }

        return this;
      },

      disconnect(): void {
        SocketClientFactory.logger.debug('Disconnecting socket');
        socket.disconnect();
        handlerMap.clear();
        SocketClientFactory.logger.debug('Client socket disconnected');
      },
    };
  }
}
