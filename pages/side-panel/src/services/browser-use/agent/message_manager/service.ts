import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { ActionResult, AgentOutput, AgentStepInfo } from '../views';
import { MessageMetadata, MessageManagerState, ToolCall } from './views';
import { AgentMessagePrompt } from '../prompts';
import { BrowserState } from '../../browser/views';

export class MessageManagerSettings {
  maxInputTokens: number = 128000;
  estimatedCharactersPerToken: number = 3;
  imageTokens: number = 800;
  includeAttributes: string[] = [];
  messageContext: string | null = null;
  sensitiveData: Record<string, string> | null = null;
  availableFilePaths: string[] | null = null;
  useSnapshotForAI: boolean = false;

  /**
   * Constructor to initialize settings
   * This matches the Python implementation's parameter order
   */
  constructor(
    maxInputTokens?: number,
    includeAttributes?: string[],
    messageContext?: string | null,
    sensitiveData?: Record<string, string> | null,
    availableFilePaths?: string[] | null,
    useSnapshotForAI?: boolean
  ) {
    if (maxInputTokens !== undefined) this.maxInputTokens = maxInputTokens;
    if (includeAttributes !== undefined) this.includeAttributes = includeAttributes;
    if (messageContext !== undefined) this.messageContext = messageContext;
    if (sensitiveData !== undefined) this.sensitiveData = sensitiveData;
    if (availableFilePaths !== undefined) this.availableFilePaths = availableFilePaths;
    if (useSnapshotForAI !== undefined) this.useSnapshotForAI = useSnapshotForAI;
  }
}

export class MessageManager {
  task: string;
  settings: MessageManagerSettings;
  state: MessageManagerState;
  systemPrompt: SystemMessage;

  constructor(
    task: string,
    systemMessage: SystemMessage,
    settings: MessageManagerSettings = new MessageManagerSettings(),
    state: MessageManagerState = new MessageManagerState()
  ) {
    this.task = task;
    this.settings = settings;
    this.state = state;
    this.systemPrompt = systemMessage;

    // Only initialize messages if state is empty
    if (this.state.history.messages.length === 0) {
      this._initMessages();
    }
  }

  private _initMessages(): void {
    /**
     * Initialize the message history with system message, context, task, and other initial messages
     */
    this._addMessageWithTokens(this.systemPrompt);

    if (this.settings.messageContext) {
      const contextMessage = new HumanMessage(
        'Context for the task' + this.settings.messageContext
      );
      this._addMessageWithTokens(contextMessage);
    }

    const taskMessage = new HumanMessage(
      // eslint-disable-next-line max-len
      `Your ultimate task is: """${this.task}""". If you achieved your ultimate task, stop everything and use the done action in the next step to complete the task. If not, continue as usual.`
    );
    this._addMessageWithTokens(taskMessage);

    if (this.settings.sensitiveData) {
      const info = `Here are placeholders for sensitve data: ${Object.keys(this.settings.sensitiveData)}`;
      const infoMessage = new HumanMessage(
        info + 'To use them, write <secret>the placeholder name</secret>'
      );
      this._addMessageWithTokens(infoMessage);
    }

    const placeholderMessage = new HumanMessage('Example output:');
    this._addMessageWithTokens(placeholderMessage);

    const toolCalls: ToolCall[] = [
      {
        name: 'AgentOutput',
        args: {
          current_state: {
            evaluation_previous_goal: 'Success - I opend the first page',
            memory: 'Starting with the new task. I have completed 1/10 steps',
            next_goal: 'Click on company a',
          },
          action: [{ click_element: { index: 0 } }],
        },
        id: String(this.state.toolId),
        type: 'tool_call',
      },
    ];

    const exampleToolCall = new AIMessage({
      content: '',
      tool_calls: toolCalls,
    });
    this._addMessageWithTokens(exampleToolCall);
    this.addToolMessage('Browser started');

    const placeholderMemoryMessage = new HumanMessage('[Your task history memory starts here]');
    this._addMessageWithTokens(placeholderMemoryMessage);

    if (this.settings.availableFilePaths) {
      const filepathsMsg = new HumanMessage(
        `Here are file paths you can use: ${this.settings.availableFilePaths}`
      );
      this._addMessageWithTokens(filepathsMsg);
    }
  }

  addNewTask(newTask: string): void {
    // eslint-disable-next-line max-len
    const content = `Your new ultimate task is: """${newTask}""". Take the previous context into account and finish your new ultimate task. `;
    const msg = new HumanMessage(content);
    this._addMessageWithTokens(msg);
    this.task = newTask;
  }

  addStateMessage(
    state: BrowserState,
    result: ActionResult[] | null = null,
    stepInfo: AgentStepInfo | null = null,
    useVision = true,
    snapshotForAI?: string
  ): void {
    /**
     * Add browser state as human message
     */
    // if keep in memory, add to directly to history and add state without result
    if (result) {
      for (const r of result) {
        if (r.includeInMemory) {
          if (r.extractedContent) {
            const msg = new HumanMessage('Action result: ' + String(r.extractedContent));
            this._addMessageWithTokens(msg);
          }
          if (r.error) {
            // if endswith \n, remove it
            let errorMsg = r.error;
            if (errorMsg.endsWith('\n')) {
              errorMsg = errorMsg.slice(0, -1);
            }
            // get only last line of error
            const lastLine = errorMsg.split('\n').pop() || '';
            const msg = new HumanMessage('Action error: ' + lastLine);
            this._addMessageWithTokens(msg);
          }
          result = null; // if result in history, we dont want to add it again
        }
      }
    }

    // otherwise add state message and result to next message (which will not stay in memory)
    const stateMessage = new AgentMessagePrompt(
      state,
      result,
      this.settings.includeAttributes || [],
      stepInfo,
      this.settings.useSnapshotForAI,
      snapshotForAI
    ).getUserMessage(useVision);
    this._addMessageWithTokens(stateMessage);
  }

  addModelOutput(modelOutput: AgentOutput): void {
    /**
     * Add model output as AI message
     */
    const toolCalls: ToolCall[] = [
      {
        name: 'AgentOutput',
        args: {
          currentState: modelOutput.currentState,
          action: modelOutput.action,
        },
        id: String(this.state.toolId),
        type: 'tool_call',
      },
    ];

    const msg = new AIMessage({
      content: '',
      tool_calls: toolCalls,
    });

    this._addMessageWithTokens(msg);
    // empty tool response
    this.addToolMessage('');
  }

  addPlan(plan: string | null, position: number | null = null): void {
    if (plan) {
      const msg = new AIMessage(plan);
      this._addMessageWithTokens(msg, position);
    }
  }

  getMessages(): BaseMessage[] {
    /**
     * Get current message list, potentially trimmed to max tokens
     */
    const messages = this.state.history.messages.map(m => m.message);

    return messages;
  }

  /**
   * Add message with token count metadata
   * position: null for last, -1 for second last, etc.
   * This matches the Python implementation's _add_message_with_tokens method
   */
  addMessageWithTokens(message: BaseMessage, position: number | null = null): void {
    // filter out sensitive data from the message
    if (this.settings.sensitiveData) {
      message = this._filterSensitiveData(message);
    }

    const tokenCount = this._countTokens(message);
    const metadata = new MessageMetadata();
    metadata.tokens = tokenCount;
    this.state.history.addMessage(message, metadata, position);
  }

  // Private alias for backward compatibility
  private _addMessageWithTokens(message: BaseMessage, position: number | null = null): void {
    this.addMessageWithTokens(message, position);
  }

  private _filterSensitiveData(message: BaseMessage): BaseMessage {
    /**
     * Filter out sensitive data from the message
     */
    if (!this.settings.sensitiveData) {
      return message;
    }

    let content = String(message.content);

    // Replace sensitive data with placeholders
    for (const [placeholder, value] of Object.entries(this.settings.sensitiveData)) {
      if (value && content.includes(value)) {
        content = content.replace(new RegExp(value, 'g'), `<secret>${placeholder}</secret>`);
      }
    }

    // Create a new message of the same type with filtered content
    if (message instanceof SystemMessage) {
      return new SystemMessage(content);
    } else if (message instanceof HumanMessage) {
      return new HumanMessage(content);
    } else if (message instanceof AIMessage) {
      const messageFields: { content: string; tool_calls?: ToolCall[] } = { content };
      if (message.tool_calls) {
        messageFields.tool_calls = message.tool_calls as ToolCall[];
      }
      return new AIMessage(messageFields);
    } else if (message instanceof ToolMessage) {
      return new ToolMessage({
        content,
        tool_call_id: message.tool_call_id,
      });
    }

    return message;
  }

  private _countTokens(message: BaseMessage): number {
    /**
     * Estimate token count for a message
     */
    let tokenCount = 0;

    // Count tokens in content
    if (typeof message.content === 'string') {
      tokenCount += Math.ceil(message.content.length / this.settings.estimatedCharactersPerToken);
    } else if (Array.isArray(message.content)) {
      for (const item of message.content) {
        if (item.type === 'text') {
          tokenCount += Math.ceil(item.text.length / this.settings.estimatedCharactersPerToken);
        } else if (item.type === 'image_url') {
          tokenCount += this.settings.imageTokens;
        }
      }
    }

    // Add tokens for tool calls if present
    if (message instanceof AIMessage && message.tool_calls) {
      for (const toolCall of message.tool_calls) {
        tokenCount += 50; // Base token count for tool call structure
        if (toolCall.args) {
          tokenCount += Math.ceil(
            JSON.stringify(toolCall.args).length / this.settings.estimatedCharactersPerToken
          );
        }
      }
    }

    return tokenCount;
  }

  addToolMessage(content: string): void {
    /**
     * Add a tool message to the history
     */
    const toolMessage = new ToolMessage({
      content,
      tool_call_id: String(this.state.toolId),
    });
    this._addMessageWithTokens(toolMessage);
    this.state.toolId += 1;
  }

  trimMessages(maxTokens: number | null = null): void {
    /**
     * Trim messages to fit within token limit
     */
    if (maxTokens === null) {
      maxTokens = this.settings.maxInputTokens;
    }

    while (this.state.history.currentTokens > maxTokens) {
      this.state.history.removeOldestMessage();
    }
  }

  cutMessages(): void {
    /**
     * Cut messages to fit within token limit, matching Python implementation
     */
    const diff = this.state.history.currentTokens - this.settings.maxInputTokens;
    if (diff <= 0) {
      return;
    }

    // Get the last message
    const lastMessageIndex = this.state.history.messages.length - 1;
    if (lastMessageIndex < 0) {
      return;
    }

    const msgWrapper = this.state.history.messages[lastMessageIndex];
    if (!msgWrapper) {
      return;
    }

    const msg = msgWrapper.message;

    // If content is a list with images, remove images first
    if (Array.isArray(msg.content)) {
      let text = '';
      for (let i = msg.content.length - 1; i >= 0; i--) {
        const item = msg.content[i];
        if (item && 'type' in item) {
          if (item.type === 'image_url') {
            // Remove image and update token counts
            msg.content.splice(i, 1);
            const imageTokens = this.settings.imageTokens || 0;
            msgWrapper.metadata.tokens -= imageTokens;
            this.state.history.currentTokens -= imageTokens;
            console.debug(
              // eslint-disable-next-line max-len
              `Removed image with ${imageTokens} tokens - total tokens now: ${this.state.history.currentTokens}/${this.settings.maxInputTokens}`
            );
          } else if (item.type === 'text' && 'text' in item) {
            text += item.text;
          }
        }
      }

      // Convert to text-only if we removed all images
      if (msg.content.length === 0) {
        msg.content = text;
        this.state.history.messages[lastMessageIndex] = msgWrapper;
      }
    }

    // Check if we're still over the limit
    const updatedDiff = this.state.history.currentTokens - this.settings.maxInputTokens;
    if (updatedDiff <= 0) {
      return;
    }

    // If still over, remove text from state message proportionally
    const proportionToRemove = updatedDiff / msgWrapper.metadata.tokens;
    if (proportionToRemove > 0.99) {
      throw new Error(
        // eslint-disable-next-line max-len
        `Max token limit reached - history is too long - reduce the system prompt or task. proportion_to_remove: ${proportionToRemove}`
      );
    }

    console.debug(
      // eslint-disable-next-line max-len
      `Removing ${proportionToRemove * 100}% of the last message (${proportionToRemove * msgWrapper.metadata.tokens} / ${msgWrapper.metadata.tokens} tokens)`
    );

    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    const charactersToRemove = Math.floor(content.length * proportionToRemove);
    const truncatedContent = content.substring(0, content.length - charactersToRemove);

    // Remove the last state message
    this.removeLastStateMessage();

    // Add a new message with updated content
    const newMsg = new HumanMessage(truncatedContent);
    this._addMessageWithTokens(newMsg);
  }

  /**
   * Remove the last state message from the history
   * This is used when we want to update the state without adding a new message
   */
  removeLastStateMessage(): void {
    // Find the last message that is a HumanMessage (state message)
    const messages = this.state.history.messages;
    if (!messages) return; // Guard against undefined messages

    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message && message.message instanceof HumanMessage) {
        // Remove this message
        this.state.history.removeMessageAtIndex(i);
        return;
      }
    }
  }
}
