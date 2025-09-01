import { BaseDataAccessObject } from '@shared/storage/dexie/dataAccessObject/BaseDataAccessObject';
import { DatabasePlugin } from '@shared/storage/dexie/dataAccessObject/DatabasePlugin';
import { Dexie, type Table } from 'dexie';

export enum ConversationType {
  CHAT = 'chat',
  AGENT_SESSION = 'agent_session',
  BROWSER_USE = 'browser_use',
  RESEARCH = 'research',
}

export enum MessageRole {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant',
  TOOL = 'tool',
}

export interface IConversationMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
  toolCalls?: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
  }>;
  toolCallId?: string;
}

export interface IConversationMetadata {
  modelName?: string;
  sessionId?: string;
  agentId?: string;
  totalTokens?: number;
  settings?: Record<string, unknown>;
}

export interface IConversationModel {
  id: string;
  title: string;
  type: ConversationType;
  messages: IConversationMessage[];
  metadata: IConversationMetadata;
  createdTimestamp: number;
  updatedTimestamp: number;
  isArchived?: boolean;
  tags?: string[];
}

export const conversationSchemaDefinition = {
  1: 'id, title, type, createdTimestamp, updatedTimestamp, isArchived, *tags, metadata.sessionId, metadata.agentId',
};

export class ConversationDataAccessObject extends BaseDataAccessObject<IConversationModel, string> {
  public constructor(db: Dexie) {
    super(db.table('conversations'), 'conversations');
  }

  public get table(): Table<IConversationModel, string> {
    return this._table;
  }

  public async findByType(type: ConversationType): Promise<IConversationModel[]> {
    return this.table.where('type').equals(type).toArray();
  }

  public async findRecent(limit: number = 20): Promise<IConversationModel[]> {
    const allConversations = await this.table.orderBy('updatedTimestamp').reverse().toArray();
    return allConversations.filter(conversation => !conversation.isArchived).slice(0, limit);
  }

  public async findBySessionId(sessionId: string): Promise<IConversationModel[]> {
    return this.table.where('metadata.sessionId').equals(sessionId).toArray();
  }

  public async findByAgentId(agentId: string): Promise<IConversationModel[]> {
    return this.table.where('metadata.agentId').equals(agentId).toArray();
  }

  public async findByTag(tag: string): Promise<IConversationModel[]> {
    return this.table.where('tags').equals(tag).toArray();
  }

  public static plugin: DatabasePlugin<IConversationModel, string> = {
    tableName: 'conversations',
    schema: conversationSchemaDefinition,
    modelClass: class ConversationModelImpl implements IConversationModel {
      public id!: string;
      public title!: string;
      public type!: ConversationType;
      public messages!: IConversationMessage[];
      public metadata!: IConversationMetadata;
      public createdTimestamp!: number;
      public updatedTimestamp!: number;
      public isArchived?: boolean;
      public tags?: string[];

      public constructor() {
        this.messages = [];
        this.metadata = {};
        this.tags = [];
        this.isArchived = false;
      }
    },
    daoClass: ConversationDataAccessObject,
  };
}
