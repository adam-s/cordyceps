/* eslint-disable max-len */
import { BrowserWindow } from '../cordyceps/browserWindow';
import { ChatOpenAI } from '@langchain/openai';
import { Agent } from './agent/service';
import { BrowserContext } from './browser/context';
import { EventMessage, Severity } from '@src/utils/types';

type EventEmitter = {
  emit: (event: EventMessage) => void;
};

// export const run = async (browser: BrowserWindow, apiKey: string): Promise<void> => {
//   console.log('Browser initialized, running example with API key:', apiKey.slice(0, 8) + '...');

//   try {
//     const llm = new ChatOpenAI({
//       apiKey, // or omit if the env var is set
//       model: 'gpt-4o',
//       temperature: 0,
//       useResponsesApi: true, // force Responses API
//     });

//     // Create BrowserContext from the BrowserWindow
//     const browserContext = new BrowserContext(browser);

//     const task =
//       // eslint-disable-next-line max-len, max-len
//       'Navigate to the browser-use GitHub repository at https://github.com/browser-use/browser-use and find information about the project and its contributors';
//     const agent = new Agent(task, llm, { browserContext });

//     // Register progress callbacks before running the agent so they receive events
//     agent.registerNewStepCallback = async (state, modelOutput, step) => {
//       // state: BrowserState, modelOutput: AgentOutput, step: number
//       console.log('New agent step:', state, modelOutput, step);
//       // Optionally log compact state or modelOutput for debugging
//       // console.log('State snapshot:', { url: state?.url, title: state?.title });
//     };

//     agent.registerDoneCallback = async history => {
//       console.log('Agent done:', history);
//     };

//     await agent.run();
//   } catch (error) {
//     console.error('Failed to create new page:', error);
//     throw error;
//   }
// };

export const run = async (
  browser: BrowserWindow,
  apiKey: string,
  eventEmitter?: EventEmitter
): Promise<void> => {
  const logMessage = (message: string, severity: Severity = Severity.Info) => {
    console.log(message);
    if (eventEmitter) {
      eventEmitter.emit({
        timestamp: Date.now(),
        severity,
        message,
      });
    }
  };

  logMessage(
    '🔬 Running enhanced research task with ARIA snapshot for AI (no screenshots, no highlights)...'
  );

  try {
    const llm = new ChatOpenAI({
      apiKey,
      model: 'gpt-4o',
      temperature: 0,
      useResponsesApi: true,
    });

    // Create BrowserContext from the BrowserWindow with AI snapshot configuration
    const browserContext = new BrowserContext(browser, {
      useSnapshotForAI: true, // Enable AI snapshot mode
      highlightElements: false, // Disable highlights when using AI snapshots
    });

    const task =
      'Multi-step research task using AI snapshots to test navigation and content extraction. ' +
      'IMPORTANT: If you are on a chrome:// page or protected page, navigate to google.com first. ' +
      'Step 1: Navigate to Google (google.com). ' +
      'Step 2: Search for "wikipedia elephants" in the search box. ' +
      'Step 3: Click on the Wikipedia link about elephants from the search results. ' +
      'Step 4: Read the Wikipedia elephant article and extract information about elephant behavior. ' +
      'Step 5: Generate a comprehensive 1 paragraph report about elephant behavior based on what you found, ' +
      'including details about their social structure, intelligence, communication, and family bonds.';

    // Create agent with snapshot for AI enabled and optimized for research task
    const agent = new Agent(task, llm, {
      browserContext,
      useSnapshotForAI: true, // Enable ARIA snapshot for AI
      useVision: false, // Disable screenshots when using snapshots to save tokens
      maxActionsPerStep: 2, // Allow 2 actions per step for navigation tasks
      retryDelay: 3, // 3 second delay between retries
      maxFailures: 3, // Allow normal failure retries
    });

    // Register progress callbacks with enhanced logging
    agent.registerNewStepCallback = async (state, modelOutput, step) => {
      logMessage('🔄 === NEW STEP CALLBACK ===');
      logMessage(`🤖 Step ${step}: ${modelOutput.currentState?.nextGoal || 'Processing...'}`);
      logMessage(`📍 Current URL: ${state.url}`);
      logMessage(
        `🧠 Memory: ${modelOutput.currentState?.memory?.substring(0, 100) || 'No memory'}...`
      );

      // Log a sample of the action being taken
      if (modelOutput.action && modelOutput.action.length > 0) {
        const firstAction = modelOutput.action[0];
        const actionType = Object.keys(firstAction)[0];
        logMessage(`🔧 Action: ${actionType}`);
        logMessage(`📋 Action details: ${JSON.stringify(firstAction).substring(0, 200)}...`);
      }
      logMessage('='.repeat(50));
    };

    agent.registerDoneCallback = async history => {
      logMessage('🎉 === DONE CALLBACK ===');
      logMessage('✅ Agent completed elephant research task with ARIA snapshot!', Severity.Success);
      logMessage(`📊 Total steps: ${history.history.length}`);
      logMessage(`⏱️ Total duration: ${history.totalDurationSeconds()}s`);

      // Try to extract the final report from the last step
      const lastStep = history.history[history.history.length - 1];
      if (lastStep?.result && lastStep.result.length > 0) {
        const report = lastStep.result.find(r => r.extractedContent);
        if (report?.extractedContent) {
          logMessage('🐘 ELEPHANT BEHAVIOR RESEARCH REPORT:');
          logMessage('='.repeat(80));
          logMessage(report.extractedContent);
          logMessage('='.repeat(80));
        }
      }

      // Log history summary
      logMessage('📊 Research Step Summary:');
      history.history.forEach((step, index) => {
        logMessage(
          `  Step ${index + 1}: ${step.modelOutput?.currentState?.nextGoal || 'Unknown goal'}`
        );
      });
      logMessage('🎯 === END RESEARCH CALLBACK ===');
    };

    await agent.run(15); // Allow up to 15 steps for the research task
  } catch (error) {
    const errorMessage = `❌ Failed to run elephant research with ARIA snapshot: ${error instanceof Error ? error.message : String(error)}`;
    logMessage(errorMessage, Severity.Error);
    throw error;
  }
};
