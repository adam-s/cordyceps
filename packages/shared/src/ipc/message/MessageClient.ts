import { VSBuffer } from 'vs/base/common/buffer';
import { IDisposable } from 'vs/base/common/lifecycle';
import { BufferWriter, serialize } from 'vs/base/parts/ipc/common/ipc';
import { Event } from 'vs/base/common/event';
import { fromMessageEmitter } from './common';
import { CRX_DEEP_RESEARCH_HELLO, CRX_DEEP_RESEARCH_MESSAGE, CRX_DEEP_RESEARCH_RECONNECT } from '@shared/utils/message';
import {
  ChannelClient,
  ChannelServer,
  IChannel,
  IChannelClient,
  IChannelServer,
  IServerChannel,
} from './ChannelClient';
import { Protocol } from './Protocol';

/**
 * Creates a filtered message event for specific sender and channel
 */
function createMessageEvent(
  senderId: string,
  channelId: string | undefined,
  eventName: string = CRX_DEEP_RESEARCH_MESSAGE,
): Event<VSBuffer> {
  // Create base message event
  const onMessage = fromMessageEmitter(
    chrome.runtime.onMessage,
    eventName,
    (messageBody, sender, source, target) => ({
      messageBody,
      sender,
      source,
      target,
    }),
  );

  // Apply message filtering
  const filteredMessage = Event.filter(onMessage, ({ source, target }) => {
    return source === channelId && target === senderId;
  });

  // Transform to VSBuffer
  return Event.map(filteredMessage, ({ messageBody }) => {
    return VSBuffer.wrap(messageBody);
  });
}

export class MessageClient<TContext extends string>
  implements IChannelClient, IChannelServer<TContext>, IDisposable
{
  private readonly channelClient: ChannelClient;
  private readonly channelServer: ChannelServer<TContext>;
  private readonly protocol: Protocol;

  constructor(
    private readonly source: TContext,
    private readonly target: TContext,
  ) {
    this.protocol = this.createProtocol();
    this.channelClient = new ChannelClient(this.protocol);
    this.channelServer = new ChannelServer(this.protocol, this.source);

    this.sendHelloMessage();
    this.sendInitialHandshake();
  }

  private createProtocol(): Protocol {
    // Create message events
    const onReconnect = createMessageEvent(this.source, this.target, CRX_DEEP_RESEARCH_RECONNECT);
    const onMessage = createMessageEvent(this.source, this.target, CRX_DEEP_RESEARCH_MESSAGE);

    // Create protocol instance
    const protocol = new Protocol(this.source, onMessage, this.target, undefined, onReconnect);

    // Handle reconnection
    onReconnect(() => {
      this.sendHelloMessage();
      this.sendSourceIdentifier();
    });

    return protocol;
  }

  private sendHelloMessage(): void {
    // IPC Step 1: Send a hello message
    chrome.runtime
      .sendMessage({
        type: CRX_DEEP_RESEARCH_HELLO,
        source: this.source,
        target: this.target,
      })
      .catch(error => {
        console.error('Failed to send hello message:', error);
      });
  }

  private sendSourceIdentifier(): void {
    const writer = new BufferWriter();
    serialize(writer, this.source);
    this.protocol.send(writer.buffer);
  }

  private sendInitialHandshake(): void {
    this.sendSourceIdentifier();
    const subscription = this.protocol.onMessage(() => {
      subscription.dispose();
      const writer = new BufferWriter();
      serialize(writer, [200]);
      serialize(writer, undefined);
      this.protocol.send(writer.buffer);
    });
  }

  // IChannelClient implementation
  getChannel<T extends IChannel>(channelName: string): T {
    return this.channelClient.getChannel(channelName) as T;
  }

  // IChannelServer implementation
  registerChannel(channelName: string, channel: IServerChannel<TContext>): void {
    this.channelServer.registerChannel(channelName, channel);
  }

  // IDisposable implementation
  dispose(): void {
    this.protocol.disconnect();
    this.channelClient.dispose();
    this.channelServer.dispose();
  }
}
