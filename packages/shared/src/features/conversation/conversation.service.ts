import {
  IConversationModel,
  ConversationDataAccessObject,
  ConversationType,
  IConversationMessage,
} from './ConversationDataAccessObject';
import { ILogService } from '@shared/services/log.service';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { generateUuid } from 'vs/base/common/uuid';
import { ConversationValidator, ValidationError } from './conversation.validator';
import { SortOrder, Pager } from '@shared/storage/dexie/dataAccessObject/Pager';
import { liveQuery, type Subscription } from 'dexie';
import { IObservable, observableValue } from 'vs/base/common/observable';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';

const RECENT_CONVERSATIONS_PAGE_SIZE = 20;

export interface IConversationService extends IDisposable {
  readonly _serviceBrand: undefined;
  readonly recentConversations$: IObservable<IConversationModel[]>;

  createConversation(
    conversationData: Omit<IConversationModel, 'id' | 'createdTimestamp' | 'updatedTimestamp'>,
  ): Promise<string>;
  getConversation(id: string): Promise<IConversationModel | undefined>;
  updateConversation(
    id: string,
    updates: Partial<Omit<IConversationModel, 'id' | 'createdTimestamp'>>,
  ): Promise<void>;
  deleteConversation(id: string): Promise<void>;
  archiveConversation(id: string): Promise<void>;
  unarchiveConversation(id: string): Promise<void>;

  addMessage(
    conversationId: string,
    message: Omit<IConversationMessage, 'id' | 'timestamp'>,
  ): Promise<string>;
  updateMessage(
    conversationId: string,
    messageId: string,
    updates: Partial<Omit<IConversationMessage, 'id' | 'timestamp'>>,
  ): Promise<void>;
  deleteMessage(conversationId: string, messageId: string): Promise<void>;

  listConversations(
    query?: Partial<Record<keyof IConversationModel, unknown>>,
    options?: {
      pageSize?: number;
      sortOrder?: SortOrder;
      sortIndex?: keyof IConversationModel;
      includeArchived?: boolean;
    },
  ): Promise<IConversationModel[]>;

  findConversationsByType(type: ConversationType): Promise<IConversationModel[]>;
  findConversationsBySessionId(sessionId: string): Promise<IConversationModel[]>;
  findConversationsByAgentId(agentId: string): Promise<IConversationModel[]>;
  findConversationsByTag(tag: string): Promise<IConversationModel[]>;

  exportConversation(id: string): Promise<string>;
  importConversation(conversationData: Record<string, unknown>): Promise<string>;
}

export const IConversationService = createDecorator<IConversationService>('conversationService');

export class ConversationService extends Disposable implements IConversationService {
  public readonly _serviceBrand: undefined;

  private readonly _recentConversationsValue$ = observableValue<IConversationModel[]>(
    'recentConversations',
    [],
  );
  public readonly recentConversations$: IObservable<IConversationModel[]> =
    this._recentConversationsValue$;
  private _recentConversationsSubscription: Subscription | undefined;

  public constructor(
    private readonly _logService: ILogService,
    private readonly _conversationDAO: ConversationDataAccessObject,
  ) {
    super();
    this._initializeRecentConversationsObservable();
  }

  private _initializeRecentConversationsObservable(): void {
    this._recentConversationsSubscription = liveQuery(() =>
      this._conversationDAO.findRecent(RECENT_CONVERSATIONS_PAGE_SIZE),
    ).subscribe({
      next: (result: IConversationModel[]) => {
        this._recentConversationsValue$.set(result, undefined);
        this._logService.trace(
          '[ConversationService] Recent conversations updated via liveQuery:',
          result.length,
        );
      },
      error: (error: unknown) => {
        this._logService.error(
          '[ConversationService] Live query error for recent conversations:',
          error,
        );
      },
    });

    this._register({
      dispose: () => {
        if (this._recentConversationsSubscription) {
          this._recentConversationsSubscription.unsubscribe();
          this._logService.trace(
            '[ConversationService] Unsubscribed from recent conversations liveQuery.',
          );
        }
      },
    });
  }

  public async createConversation(
    conversationData: Omit<IConversationModel, 'id' | 'createdTimestamp' | 'updatedTimestamp'>,
  ): Promise<string> {
    this._logService.trace(
      '[ConversationService] Attempting to create conversation:',
      conversationData,
    );

    try {
      const validationData = {
        ...conversationData,
        createdTimestamp: Date.now(),
        updatedTimestamp: Date.now(),
      };
      ConversationValidator.validate(validationData, true);
    } catch (error: unknown) {
      if (error instanceof ValidationError) {
        this._logService.warn(
          '[ConversationService] Validation failed for new conversation:',
          (error as ValidationError).errors,
        );
        throw error;
      }
      this._logService.error('[ConversationService] Unexpected error during validation:', error);
      throw new Error('An unexpected error occurred during validation.');
    }

    const id = generateUuid();
    const timestamp = Date.now();
    const conversation: IConversationModel = {
      ...conversationData,
      id,
      createdTimestamp: timestamp,
      updatedTimestamp: timestamp,
      messages: conversationData.messages || [],
      tags: conversationData.tags || [],
      isArchived: conversationData.isArchived || false,
    };

    await this._conversationDAO.add(conversation);
    this._logService.info(`[ConversationService] Conversation created with ID: ${id}`);
    return id;
  }

  public async getConversation(id: string): Promise<IConversationModel | undefined> {
    this._logService.trace(`[ConversationService] Attempting to get conversation with ID: ${id}`);
    return this._conversationDAO.get(id);
  }

  public async updateConversation(
    id: string,
    updates: Partial<Omit<IConversationModel, 'id' | 'createdTimestamp'>>,
  ): Promise<void> {
    this._logService.trace(
      `[ConversationService] Attempting to update conversation with ID: ${id}`,
      updates,
    );

    try {
      ConversationValidator.validate(updates, false);
    } catch (error: unknown) {
      if (error instanceof ValidationError) {
        this._logService.warn(
          `[ConversationService] Validation failed for updating conversation ID ${id}:`,
          (error as ValidationError).errors,
        );
        throw error;
      }
      this._logService.error(
        `[ConversationService] Unexpected error during validation for update ID ${id}:`,
        error,
      );
      throw new Error('An unexpected error occurred during validation.');
    }

    const validUpdates = {
      ...updates,
      updatedTimestamp: Date.now(),
    };

    if (Object.keys(validUpdates).length === 1) {
      // Only updatedTimestamp
      this._logService.info(
        `[ConversationService] No valid fields to update for conversation ID: ${id}`,
      );
      return;
    }

    await this._conversationDAO.update(id, validUpdates);
    this._logService.info(`[ConversationService] Conversation updated with ID: ${id}`);
  }

  public async deleteConversation(id: string): Promise<void> {
    this._logService.trace(
      `[ConversationService] Attempting to delete conversation with ID: ${id}`,
    );
    await this._conversationDAO.delete(id);
    this._logService.info(`[ConversationService] Conversation deleted with ID: ${id}`);
  }

  public async archiveConversation(id: string): Promise<void> {
    this._logService.trace(
      `[ConversationService] Attempting to archive conversation with ID: ${id}`,
    );
    await this.updateConversation(id, { isArchived: true });
    this._logService.info(`[ConversationService] Conversation archived with ID: ${id}`);
  }

  public async unarchiveConversation(id: string): Promise<void> {
    this._logService.trace(
      `[ConversationService] Attempting to unarchive conversation with ID: ${id}`,
    );
    await this.updateConversation(id, { isArchived: false });
    this._logService.info(`[ConversationService] Conversation unarchived with ID: ${id}`);
  }

  public async addMessage(
    conversationId: string,
    message: Omit<IConversationMessage, 'id' | 'timestamp'>,
  ): Promise<string> {
    this._logService.trace(
      `[ConversationService] Adding message to conversation ${conversationId}:`,
      message,
    );

    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation with ID ${conversationId} not found`);
    }

    const messageId = generateUuid();
    const newMessage: IConversationMessage = {
      ...message,
      id: messageId,
      timestamp: Date.now(),
    };

    const updatedMessages = [...conversation.messages, newMessage];
    await this.updateConversation(conversationId, { messages: updatedMessages });

    this._logService.info(
      `[ConversationService] Message added with ID: ${messageId} to conversation: ${conversationId}`,
    );
    return messageId;
  }

  public async updateMessage(
    conversationId: string,
    messageId: string,
    updates: Partial<Omit<IConversationMessage, 'id' | 'timestamp'>>,
  ): Promise<void> {
    this._logService.trace(
      `[ConversationService] Updating message ${messageId} in conversation ${conversationId}:`,
      updates,
    );

    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation with ID ${conversationId} not found`);
    }

    const messageIndex = conversation.messages.findIndex(
      (msg: IConversationMessage) => msg.id === messageId,
    );
    if (messageIndex === -1) {
      throw new Error(`Message with ID ${messageId} not found in conversation ${conversationId}`);
    }

    const updatedMessages = [...conversation.messages];
    updatedMessages[messageIndex] = {
      ...updatedMessages[messageIndex],
      ...updates,
    };

    await this.updateConversation(conversationId, { messages: updatedMessages });
    this._logService.info(
      `[ConversationService] Message updated with ID: ${messageId} in conversation: ${conversationId}`,
    );
  }

  public async deleteMessage(conversationId: string, messageId: string): Promise<void> {
    this._logService.trace(
      `[ConversationService] Deleting message ${messageId} from conversation ${conversationId}`,
    );

    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation with ID ${conversationId} not found`);
    }

    const updatedMessages = conversation.messages.filter(
      (msg: IConversationMessage) => msg.id !== messageId,
    );
    await this.updateConversation(conversationId, { messages: updatedMessages });

    this._logService.info(
      `[ConversationService] Message deleted with ID: ${messageId} from conversation: ${conversationId}`,
    );
  }

  public async listConversations(
    query: Partial<Record<keyof IConversationModel, unknown>> = {},
    options?: {
      pageSize?: number;
      sortOrder?: SortOrder;
      sortIndex?: keyof IConversationModel;
      includeArchived?: boolean;
    },
  ): Promise<IConversationModel[]> {
    this._logService.trace(
      '[ConversationService] Listing conversations with query:',
      query,
      'options:',
      options,
    );

    const {
      pageSize = 20,
      sortOrder = SortOrder.DESC,
      sortIndex = 'updatedTimestamp',
      includeArchived = false,
    } = options || {};

    const criterionFunction = (item: IConversationModel): boolean => {
      // Filter out archived conversations unless explicitly requested
      if (!includeArchived && item.isArchived) {
        return false;
      }

      const queryKeys = Object.keys(query) as (keyof IConversationModel)[];
      return queryKeys.every(key => {
        const itemValue = item[key];
        const queryValue = query[key];

        if (key === 'tags') {
          const itemTags = item.tags;
          if (
            Array.isArray(itemTags) &&
            Array.isArray(queryValue) &&
            queryValue.every((tag): tag is string => typeof tag === 'string')
          ) {
            return queryValue.every(tagToFind => itemTags.includes(tagToFind));
          }
          return false;
        }

        return itemValue === queryValue;
      });
    };

    const pager = new Pager<IConversationModel, string>({
      table: this._conversationDAO.table,
      index: sortIndex as keyof IConversationModel & string,
      idProp: 'id',
      criterionFunction:
        Object.keys(query).length > 0 || !includeArchived ? criterionFunction : undefined,
      sortOrder,
      pageSize,
    });

    const page = await pager.nextPage();
    this._logService.trace(`[ConversationService] Found ${page.length} conversations.`);
    return page;
  }

  public async findConversationsByType(type: ConversationType): Promise<IConversationModel[]> {
    this._logService.trace(`[ConversationService] Finding conversations by type: ${type}`);
    return this._conversationDAO.findByType(type);
  }

  public async findConversationsBySessionId(sessionId: string): Promise<IConversationModel[]> {
    this._logService.trace(
      `[ConversationService] Finding conversations by session ID: ${sessionId}`,
    );
    return this._conversationDAO.findBySessionId(sessionId);
  }

  public async findConversationsByAgentId(agentId: string): Promise<IConversationModel[]> {
    this._logService.trace(`[ConversationService] Finding conversations by agent ID: ${agentId}`);
    return this._conversationDAO.findByAgentId(agentId);
  }

  public async findConversationsByTag(tag: string): Promise<IConversationModel[]> {
    this._logService.trace(`[ConversationService] Finding conversations by tag: ${tag}`);
    return this._conversationDAO.findByTag(tag);
  }

  public async exportConversation(id: string): Promise<string> {
    this._logService.trace(`[ConversationService] Exporting conversation with ID: ${id}`);

    const conversation = await this.getConversation(id);
    if (!conversation) {
      throw new Error(`Conversation with ID ${id} not found`);
    }

    const exportData = {
      ...conversation,
      exportTimestamp: Date.now(),
      version: '1.0',
    };

    return JSON.stringify(exportData, null, 2);
  }

  public async importConversation(conversationData: Record<string, unknown>): Promise<string> {
    this._logService.trace('[ConversationService] Importing conversation:', conversationData);

    // Validate the import data structure
    if (!conversationData.title || !conversationData.type || !conversationData.messages) {
      throw new Error('Invalid conversation data: missing required fields');
    }

    // Create a new conversation from imported data (without id to generate a new one)
    const newConversationData: Omit<
      IConversationModel,
      'id' | 'createdTimestamp' | 'updatedTimestamp'
    > = {
      title: conversationData.title as string,
      type: conversationData.type as ConversationType,
      messages: (conversationData.messages as IConversationMessage[]) || [],
      metadata: (conversationData.metadata as Record<string, unknown>) || {},
      tags: (conversationData.tags as string[]) || [],
      isArchived: false, // Reset archive status on import
    };

    return this.createConversation(newConversationData);
  }

  public override dispose(): void {
    super.dispose();
  }
}
