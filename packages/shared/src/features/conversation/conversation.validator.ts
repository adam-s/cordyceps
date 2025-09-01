import {
  IConversationModel,
  IConversationMessage,
  ConversationType,
  MessageRole,
} from './ConversationDataAccessObject';

export class ValidationError extends Error {
  public readonly errors: string[];

  public constructor(errors: string[]) {
    super(`Validation failed: ${errors.join('; ')}`);
    this.errors = errors;
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class ConversationValidator {
  public static validate(item: Partial<IConversationModel>, isNew: boolean): void {
    const errors: string[] = [];
    this.validateTitle(item, isNew, errors);
    this.validateType(item, isNew, errors);
    this.validateMessages(item, errors);
    this.validateTimestamps(item, errors);
    this.validateTags(item, errors);
    this.validateMetadata(item, errors);

    if (errors.length > 0) {
      throw new ValidationError(errors);
    }
  }

  private static validateTitle(
    item: Partial<IConversationModel>,
    isNew: boolean,
    errors: string[],
  ): void {
    if (isNew || item.title !== undefined) {
      if (!item.title || item.title.trim() === '') {
        errors.push('Title is required and cannot be empty.');
      }
    }
  }

  private static validateType(
    item: Partial<IConversationModel>,
    isNew: boolean,
    errors: string[],
  ): void {
    if (isNew || item.type !== undefined) {
      if (!item.type || !Object.values(ConversationType).includes(item.type as ConversationType)) {
        errors.push('Valid conversation type is required.');
      }
    }
  }

  private static validateMessages(item: Partial<IConversationModel>, errors: string[]): void {
    if (item.messages !== undefined) {
      if (!Array.isArray(item.messages)) {
        errors.push('Messages must be an array.');
        return;
      }
      item.messages.forEach((message, index) => {
        this.validateSingleMessage(message, index, errors);
      });
    }
  }

  private static validateSingleMessage(
    message: IConversationMessage,
    index: number,
    errors: string[],
  ): void {
    if (!message.id || message.id.trim() === '') {
      errors.push(`Message ${index}: ID is required.`);
    }
    if (!message.role || !Object.values(MessageRole).includes(message.role as MessageRole)) {
      errors.push(`Message ${index}: Valid role is required.`);
    }
    if (typeof message.content !== 'string') {
      errors.push(`Message ${index}: Content must be a string.`);
    }
    if (typeof message.timestamp !== 'number') {
      errors.push(`Message ${index}: Timestamp must be a number.`);
    }
  }

  private static validateTimestamps(item: Partial<IConversationModel>, errors: string[]): void {
    if (item.createdTimestamp !== undefined && typeof item.createdTimestamp !== 'number') {
      errors.push('Created timestamp must be a number.');
    }
    if (item.updatedTimestamp !== undefined && typeof item.updatedTimestamp !== 'number') {
      errors.push('Updated timestamp must be a number.');
    }
  }

  private static validateTags(item: Partial<IConversationModel>, errors: string[]): void {
    if (item.tags !== undefined) {
      if (!Array.isArray(item.tags) || !item.tags.every(tag => typeof tag === 'string')) {
        errors.push('Tags must be an array of strings.');
      }
    }
  }

  private static validateMetadata(item: Partial<IConversationModel>, errors: string[]): void {
    if (item.metadata !== undefined) {
      if (typeof item.metadata !== 'object' || item.metadata === null) {
        errors.push('Metadata must be an object.');
        return;
      }
      if (
        item.metadata.totalTokens !== undefined &&
        typeof item.metadata.totalTokens !== 'number'
      ) {
        errors.push('Metadata totalTokens must be a number.');
      }
    }
  }
}
