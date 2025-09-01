/* eslint-disable max-len */
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { BrowserState } from '../browser/views';
import { ActionResult, AgentStepInfo } from './views';
/**
 * Base class for all prompts
 */
abstract class BasePrompt {
  protected prompt: string;

  constructor() {
    this.prompt = '';
  }

  /**.
   * Get the system message for the prompt
   */
  getSystemMessage(): SystemMessage {
    return new SystemMessage(this.prompt);
  }
}

/**
 * System prompt for the agent
 */
export class SystemPrompt extends BasePrompt {
  constructor(
    availableActions: string,
    maxActionsPerStep: number = 10,
    overrideSystemMessage?: string,
    extendSystemMessage?: string,
    useSnapshotForAI: boolean = false
  ) {
    super();

    if (overrideSystemMessage) {
      this.prompt = overrideSystemMessage;
      return;
    }

    const elementInteractionInstructions = useSnapshotForAI
      ? `# Element Interaction
When using AI snapshots with ARIA references:
- Elements are provided in YAML format with [ref=e123] references
- Extract the NUMBER from [ref=e123] to use as the index (e.g., 123 from [ref=e123])
- Use click_element with the extracted number: {"click_element": {"index": 123}}
- Frame elements have references like [ref=f1e5] for iframe content
- Only elements with [ref=eXXX] are interactive
- Elements without references provide context only

Example AI Snapshot format:
- button "Submit" [ref=e42] → use index 42
- textbox "Username" [ref=e15] → use index 15
- iframe [ref=e20]:
    - button "Login" [ref=f1e5] → use index 5 (from frame reference)`
      : `# Element Interaction
Interactive Elements Format:
[index]<type>text</type>
- index: Numeric identifier for interaction  
- type: HTML element type (button, input, etc.)
- text: Element description
Example:
[33]<button>Submit Form</button>

- Only elements with numeric indexes in [] are interactive
- elements without [] provide only context`;

    this.prompt = `You are an AI agent designed to automate browser tasks. Your goal is to accomplish the ultimate task following the rules.

# Input Format
Task
Previous steps
Current URL
Open Tabs
${elementInteractionInstructions}

# Response Rules
1. RESPONSE FORMAT: You must ALWAYS respond with valid JSON in this exact format:
{"current_state": {"evaluation_previous_goal": "Success|Failed|Unknown - Analyze the current elements and the image to check if the previous goals/actions are successful like intended by the task. Mention if something unexpected happened. Shortly state why/why not",
"memory": "Description of what has been done and what you need to remember. Be very specific. Count here ALWAYS how many times you have done something and how many remain. E.g. 0 out of 10 websites analyzed. Continue with abc and xyz",
"next_goal": "What needs to be done with the next immediate action"},
"action":[{"one_action_name": {// action-specific parameter}}, // ... more actions in sequence]}

2. ACTIONS: You can specify multiple actions in the list to be executed in sequence. But always specify only one action name per item. Use maximum ${maxActionsPerStep} actions per sequence.
Common action sequences:
- Form filling: [{"input_text": {"index": 1, "text": "username"}}, {"input_text": {"index": 2, "text": "password"}}, {"click_element": {"index": 3}}]
- Navigation and extraction: [{"go_to_url": {"url": "https://example.com"}}, {"extract_content": {"goal": "extract the names"}}]
- Actions are executed in the given order
- If the page changes after an action, the sequence is interrupted and you get the new state.
- Only provide the action sequence until an action which changes the page state significantly.
- Try to be efficient, e.g. fill forms at once, or chain actions where nothing changes on the page
- only use multiple actions if it makes sense.

3. ELEMENT INTERACTION:
${
  useSnapshotForAI
    ? '- Use ARIA reference numbers from [ref=eXXX] for element interaction\n- Extract the number from [ref=e123] and use it as the index parameter'
    : '- Only use indexes of the interactive elements\n- Elements marked with "[]Non-interactive text" are non-interactive'
}

4. NAVIGATION & ERROR HANDLING:
- If no suitable elements exist, use other functions to complete the task
- If stuck, try alternative approaches - like going back to a previous page, new search, new tab etc.
- Handle popups/cookies by accepting or closing them
- Use scroll to find elements you are looking for
- If you want to research something, open a new tab instead of using the current tab
- If captcha pops up, try to solve it - else try a different approach
- If the page is not fully loaded, use wait action

5. TASK COMPLETION:
- Use the done action as the last action as soon as the ultimate task is complete
- Don't use "done" before you are done with everything the user asked you, except you reach the last step of max_steps. 
- If you reach your last step, use the done action even if the task is not fully finished. Provide all the information you have gathered so far. If the ultimate task is completly finished set success to true. If not everything the user asked for is completed set success in done to false!
- If you have to do something repeatedly for example the task says for "each", or "for all", or "x times", count always inside "memory" how many times you have done it and how many remain. Don't stop until you have completed like the task asked you. Only call done after the last step.
- Don't hallucinate actions
- Make sure you include everything you found out for the ultimate task in the done text parameter. Do not just say you are done, but include the requested information of the task. 

6. VISUAL CONTEXT:
- When an image is provided, use it to understand the page layout
${
  useSnapshotForAI
    ? '- ARIA references in snapshots correspond to interactive elements\n- Cross-reference visual elements with snapshot ARIA references'
    : '- Bounding boxes with labels on their top right corner correspond to element indexes'
}

7. Form filling:
- If you fill an input field and your action sequence is interrupted, most often something changed e.g. suggestions popped up under the field.

8. Long tasks:
- Keep track of the status and subresults in the memory. 

9. Extraction:
- If your task is to find information - call extract_content on the specific pages to get and store the information.
- For research tasks, use extract_content with specific goals like "elephant behavior information" to gather detailed content.
- When on Wikipedia or other informational sites, extract comprehensive content before proceeding.

You can take the following actions:
${availableActions}`;

    if (extendSystemMessage) {
      this.prompt += `\n\n${extendSystemMessage}`;
    }
  }
}

/**
 * Planner prompt for the agent
 */
export class PlannerPrompt extends BasePrompt {
  constructor(availableActions: string) {
    super();

    this.prompt = `You are a planning agent that helps break down tasks into smaller steps and reason about the current state.
Your role is to:
1. Analyze the current state and history
2. Evaluate progress towards the ultimate goal
3. Identify potential challenges or roadblocks
4. Suggest the next high-level steps to take

Inside your messages, there will be AI messages from different agents with different formats.

Your output format should be always a JSON object with the following fields:
{
    "state_analysis": "Brief analysis of the current state and what has been done so far",
    "progress_evaluation": "Evaluation of progress towards the ultimate goal (as percentage and description)",
    "challenges": "List any potential challenges or roadblocks",
    "next_steps": "List 2-3 concrete next steps to take",
    "reasoning": "Explain your reasoning for the suggested next steps"
}

Ignore the other AI messages output structures.

Keep your responses concise and focused on actionable insights.

The AI assistant can take the following actions:
${availableActions}`;
  }
}

export class AgentMessagePrompt {
  private state: BrowserState;
  private result: ActionResult[] | null;
  private includeAttributes: string[];
  private stepInfo: AgentStepInfo | null;
  private useSnapshotForAI: boolean;
  private snapshotForAI?: string;

  constructor(
    state: BrowserState,
    result: ActionResult[] | null = null,
    includeAttributes: string[] = [],
    stepInfo: AgentStepInfo | null = null,
    useSnapshotForAI: boolean = false,
    snapshotForAI?: string
  ) {
    this.state = state;
    this.result = result;
    this.includeAttributes = includeAttributes;
    this.stepInfo = stepInfo;
    this.useSnapshotForAI = useSnapshotForAI;
    this.snapshotForAI = snapshotForAI;
  }

  /**
   * Get the user message for the state
   */
  getUserMessage(useVision: boolean = true): HumanMessage {
    // Use either snapshotForAI or traditional DOM element representation
    let formattedElementsText = '';

    console.log(
      `🔍 AgentMessagePrompt: useSnapshotForAI=${this.useSnapshotForAI}, hasSnapshot=${!!this.snapshotForAI}`
    );

    if (this.useSnapshotForAI && this.snapshotForAI) {
      // Use YAML snapshot with ARIA references for AI
      formattedElementsText = `AI Snapshot (YAML format with ARIA references):\n${this.snapshotForAI}`;
      console.log(`🔍 Using AI snapshot: ${this.snapshotForAI.length} characters`);
    } else {
      // Use the traditional clickableElementsToString method
      const elementsText =
        this.state.elementTree?.clickableElementsToString?.(this.includeAttributes) ||
        'No interactive elements available (protected page or failed DOM parsing)';

      console.log(`🔍 Using traditional DOM: ${elementsText.length} characters`);

      const hasContentAbove = (this.state.pixelsAbove || 0) > 0;
      const hasContentBelow = (this.state.pixelsBelow || 0) > 0;

      if (elementsText !== '') {
        if (hasContentAbove) {
          formattedElementsText = `... ${this.state.pixelsAbove} pixels above - scroll or extract content to see more ...\n${elementsText}`;
        } else {
          formattedElementsText = `[Start of page]\n${elementsText}`;
        }

        if (hasContentBelow) {
          formattedElementsText = `${formattedElementsText}\n... ${this.state.pixelsBelow} pixels below - scroll or extract content to see more ...`;
        } else {
          formattedElementsText = `${formattedElementsText}\n[End of page]`;
        }
      } else {
        formattedElementsText = 'empty page';
      }
    }

    let stepInfoDescription = '';
    if (this.stepInfo) {
      stepInfoDescription = `Current step: ${this.stepInfo.stepNumber + 1}/${this.stepInfo.maxSteps}`;
    }

    const timeStr = new Date()
      .toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      .replace(/(\/)/g, '-');

    stepInfoDescription += `Current date and time: ${timeStr}`;

    const elementFormatDescription =
      this.useSnapshotForAI && this.snapshotForAI
        ? 'Interactive elements with ARIA references (use [ref=e123] format to interact):'
        : 'Interactive elements from top layer of the current page inside the viewport:';

    let stateDescription = `
[Task history memory ends]
[Current state starts here]
The following is one-time information - if you need to remember it write it to memory:
Current url: ${this.state.url}
Available tabs:
${JSON.stringify(this.state.tabs)}
${elementFormatDescription}
${formattedElementsText}
${stepInfoDescription}
`;

    if (this.result && this.result.length > 0) {
      for (let i = 0; i < this.result.length; i++) {
        const resultItem = this.result[i];
        if (resultItem && resultItem.extractedContent) {
          stateDescription += `\nAction result ${i + 1}/${this.result.length}: ${resultItem.extractedContent}`;
        }
        if (resultItem && resultItem.error) {
          // Only use last line of error
          const error = resultItem.error.split('\n').pop() || '';
          stateDescription += `\nAction error ${i + 1}/${this.result.length}: ...${error}`;
        }
      }
    }

    if (this.state.screenshot && useVision) {
      // Format message for vision model
      return new HumanMessage({
        content: [
          { type: 'text', text: stateDescription },
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${this.state.screenshot}`, detail: 'low' },
          },
        ],
      });
    }

    return new HumanMessage(stateDescription);
  }
}
