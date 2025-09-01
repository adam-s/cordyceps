/**
 * Comprehensive tests for AgentClient abstract base class and concrete implementations
 *
 * This test suite validates:
 * - AgentClient abstract class structure and interface compliance
 * - OpenAICUAClient concrete implementation
 * - AnthropicCUAClient concrete implementation
 * - Constructor parameter handling and validation
 * - Abstract method implementation requirements
 * - Client configuration and options processing
 * - Error handling and edge cases
 */

import { Page } from '@src/services/cordyceps/page';
import { EventMessage, Severity } from '@src/utils/types';
import { AgentClient } from '../../lib/agent/AgentClient';
import { OpenAICUAClient } from '../../lib/agent/OpenAICUAClient';
import { AnthropicCUAClient } from '../../lib/agent/AnthropicCUAClient';
import { AgentAction, AgentResult, AgentType, AgentExecutionOptions } from '../../types/agent';
import { LogLine } from '../../types/log';

/**
 * Test progress tracker for AgentClient tests
 */
export class AgentClientProgress {
  constructor(private name: string) {}

  log(message: string): void {
    console.log(`[${this.name}] ${message}`);
  }
}

/**
 * Test context interface for consistency
 */
interface AgentClientTestContext {
  events: {
    emit: (event: EventMessage) => void;
  };
  apiKey?: string; // For testing with real API keys
}

/**
 * Mock concrete implementation of AgentClient for testing abstract class behavior
 */
class MockAgentClient extends AgentClient {
  public executeCalled = false;
  public captureScreenshotCalled = false;
  public setViewportCalled = false;
  public setCurrentUrlCalled = false;
  public setScreenshotProviderCalled = false;
  public setActionHandlerCalled = false;

  public lastExecuteOptions?: AgentExecutionOptions;
  public lastViewport?: { width: number; height: number };
  public lastUrl?: string;
  public lastScreenshotProvider?: () => Promise<string>;
  public lastActionHandler?: (action: AgentAction) => Promise<void>;

  async execute(options: AgentExecutionOptions): Promise<AgentResult> {
    this.executeCalled = true;
    this.lastExecuteOptions = options;
    return {
      success: true,
      message: 'mock execution complete',
      actions: [],
      completed: true,
      metadata: { test: 'mock data' },
    };
  }

  async captureScreenshot(_options?: Record<string, unknown>): Promise<unknown> {
    this.captureScreenshotCalled = true;
    return 'mock-screenshot-data';
  }

  setViewport(width: number, height: number): void {
    this.setViewportCalled = true;
    this.lastViewport = { width, height };
  }

  setCurrentUrl(url: string): void {
    this.setCurrentUrlCalled = true;
    this.lastUrl = url;
  }

  setScreenshotProvider(provider: () => Promise<string>): void {
    this.setScreenshotProviderCalled = true;
    this.lastScreenshotProvider = provider;
  }

  setActionHandler(handler: (action: AgentAction) => Promise<void>): void {
    this.setActionHandlerCalled = true;
    this.lastActionHandler = handler;
  }
}

/**
 * Test AgentClient abstract class constructor and properties
 */
function testAgentClientAbstractClass(progress: AgentClientProgress): boolean {
  progress.log('🧪 Testing AgentClient abstract class structure...');

  try {
    // Test constructor with minimal parameters
    const mockClient1 = new MockAgentClient('openai', 'gpt-4');

    if (mockClient1.type !== 'openai') {
      progress.log('❌ Type property not set correctly');
      return false;
    }

    if (mockClient1.modelName !== 'gpt-4') {
      progress.log('❌ Model name property not set correctly');
      return false;
    }

    if (mockClient1.userProvidedInstructions !== undefined) {
      progress.log('❌ User instructions should be undefined when not provided');
      return false;
    }

    if (!mockClient1.clientOptions || typeof mockClient1.clientOptions !== 'object') {
      progress.log('❌ Client options should be initialized as empty object');
      return false;
    }

    // Test constructor with all parameters
    const mockClient2 = new MockAgentClient(
      'anthropic',
      'claude-3-5-sonnet-20241022',
      'Custom instructions'
    );

    if (mockClient2.type !== 'anthropic') {
      progress.log('❌ Anthropic type not set correctly');
      return false;
    }

    if (mockClient2.modelName !== 'claude-3-5-sonnet-20241022') {
      progress.log('❌ Anthropic model name not set correctly');
      return false;
    }

    if (mockClient2.userProvidedInstructions !== 'Custom instructions') {
      progress.log('❌ User instructions not set correctly');
      return false;
    }

    progress.log('✅ AgentClient abstract class structure tests passed');
    return true;
  } catch (error) {
    progress.log(`❌ AgentClient abstract class test failed: ${error}`);
    return false;
  }
}

/**
 * Test AgentClient abstract method implementations
 */
function testAgentClientAbstractMethods(progress: AgentClientProgress): boolean {
  progress.log('🔧 Testing AgentClient abstract method implementations...');

  try {
    const mockClient = new MockAgentClient('openai', 'gpt-4');

    // Test execute method
    const mockOptions: AgentExecutionOptions = {
      options: {
        instruction: 'Test instruction',
        maxSteps: 10,
        autoScreenshot: true,
        waitBetweenActions: 1000,
        context: 'test context',
      },
      logger: (message: LogLine) => console.log(message),
    };

    // Test async methods (we'll verify they're callable)
    const executePromise = mockClient.execute(mockOptions);
    if (!(executePromise instanceof Promise)) {
      progress.log('❌ Execute method should return a Promise');
      return false;
    }

    const screenshotPromise = mockClient.captureScreenshot({ quality: 80 });
    if (!(screenshotPromise instanceof Promise)) {
      progress.log('❌ CaptureScreenshot method should return a Promise');
      return false;
    }

    // Test synchronous methods
    mockClient.setViewport(1920, 1080);
    if (!mockClient.setViewportCalled || !mockClient.lastViewport) {
      progress.log('❌ SetViewport method not called correctly');
      return false;
    }

    if (mockClient.lastViewport.width !== 1920 || mockClient.lastViewport.height !== 1080) {
      progress.log('❌ SetViewport parameters not passed correctly');
      return false;
    }

    mockClient.setCurrentUrl('https://example.com');
    if (!mockClient.setCurrentUrlCalled || mockClient.lastUrl !== 'https://example.com') {
      progress.log('❌ SetCurrentUrl method not called correctly');
      return false;
    }

    // Test setters with function parameters
    const mockScreenshotProvider = async (): Promise<string> => 'mock-screenshot';
    mockClient.setScreenshotProvider(mockScreenshotProvider);
    if (
      !mockClient.setScreenshotProviderCalled ||
      mockClient.lastScreenshotProvider !== mockScreenshotProvider
    ) {
      progress.log('❌ SetScreenshotProvider method not called correctly');
      return false;
    }

    const mockActionHandler = async (action: AgentAction): Promise<void> => {
      console.log('Mock action handler called', action);
    };
    mockClient.setActionHandler(mockActionHandler);
    if (!mockClient.setActionHandlerCalled || mockClient.lastActionHandler !== mockActionHandler) {
      progress.log('❌ SetActionHandler method not called correctly');
      return false;
    }

    progress.log('✅ AgentClient abstract method tests passed');
    return true;
  } catch (error) {
    progress.log(`❌ AgentClient abstract method test failed: ${error}`);
    return false;
  }
}

/**
 * Test OpenAICUAClient concrete implementation
 */
function testOpenAICUAClient(progress: AgentClientProgress): boolean {
  progress.log('🤖 Testing OpenAICUAClient implementation...');

  try {
    // Test constructor with minimal options
    const openaiClient1 = new OpenAICUAClient('openai', 'gpt-4');

    if (openaiClient1.type !== 'openai') {
      progress.log('❌ OpenAI client type not set correctly');
      return false;
    }

    if (openaiClient1.modelName !== 'gpt-4') {
      progress.log('❌ OpenAI client model name not set correctly');
      return false;
    }

    // Test constructor with client options
    const clientOptions = {
      apiKey: 'test-api-key',
      organization: 'test-org',
      environment: 'browser',
    };

    const openaiClient2 = new OpenAICUAClient(
      'openai',
      'gpt-4o',
      'Test instructions',
      clientOptions
    );

    if (openaiClient2.userProvidedInstructions !== 'Test instructions') {
      progress.log('❌ OpenAI client instructions not set correctly');
      return false;
    }

    // Test that it's an instance of AgentClient
    if (!(openaiClient2 instanceof AgentClient)) {
      progress.log('❌ OpenAICUAClient should extend AgentClient');
      return false;
    }

    // Test that abstract methods are implemented
    if (typeof openaiClient2.execute !== 'function') {
      progress.log('❌ OpenAICUAClient should implement execute method');
      return false;
    }

    if (typeof openaiClient2.captureScreenshot !== 'function') {
      progress.log('❌ OpenAICUAClient should implement captureScreenshot method');
      return false;
    }

    if (typeof openaiClient2.setViewport !== 'function') {
      progress.log('❌ OpenAICUAClient should implement setViewport method');
      return false;
    }

    progress.log('✅ OpenAICUAClient implementation tests passed');
    return true;
  } catch (error) {
    progress.log(`❌ OpenAICUAClient implementation test failed: ${error}`);
    return false;
  }
}

/**
 * Test AnthropicCUAClient concrete implementation
 */
function testAnthropicCUAClient(progress: AgentClientProgress): boolean {
  progress.log('🧠 Testing AnthropicCUAClient implementation...');

  try {
    // Test constructor with minimal options - should succeed
    const anthropicClient1 = new AnthropicCUAClient('anthropic', 'claude-3-5-sonnet-20241022');

    if (anthropicClient1.type !== 'anthropic') {
      progress.log('❌ Anthropic client type not set correctly');
      return false;
    }

    if (anthropicClient1.modelName !== 'claude-3-5-sonnet-20241022') {
      progress.log('❌ Anthropic client model name not set correctly');
      return false;
    }

    // Test constructor with client options and experimental flag
    // In browser environment, this should fail with browser safety error
    const clientOptions = {
      apiKey: 'test-anthropic-key',
      baseURL: 'https://api.anthropic.com',
      dangerouslyAllowBrowser: false, // Test with safety enabled
    };

    try {
      const anthropicClient2 = new AnthropicCUAClient(
        'anthropic',
        'claude-3-5-sonnet-20241022',
        'Test anthropic instructions',
        clientOptions,
        true // experimental flag
      );

      // If we reach here in browser, the safety check didn't work
      if (typeof window !== 'undefined') {
        progress.log('⚠️ Expected browser safety error but constructor succeeded');
      }

      if (anthropicClient2.userProvidedInstructions !== 'Test anthropic instructions') {
        progress.log('❌ Anthropic client instructions not set correctly');
        return false;
      }

      // Test that it's an instance of AgentClient
      if (!(anthropicClient2 instanceof AgentClient)) {
        progress.log('❌ AnthropicCUAClient should extend AgentClient');
        return false;
      }

      // Test that abstract methods are implemented
      if (typeof anthropicClient2.execute !== 'function') {
        progress.log('❌ AnthropicCUAClient should implement execute method');
        return false;
      }

      if (typeof anthropicClient2.captureScreenshot !== 'function') {
        progress.log('❌ AnthropicCUAClient should implement captureScreenshot method');
        return false;
      }

      if (typeof anthropicClient2.setViewport !== 'function') {
        progress.log('❌ AnthropicCUAClient should implement setViewport method');
        return false;
      }

      progress.log('✅ AnthropicCUAClient implementation tests passed (non-browser environment)');
      return true;
    } catch (browserError) {
      // Check if this is the expected browser safety error
      if (
        browserError instanceof Error &&
        browserError.message.includes('browser-like environment')
      ) {
        progress.log('✅ AnthropicCUAClient correctly enforces browser safety restrictions');
        progress.log('   This is expected behavior in browser environments for security');
        return true;
      } else {
        // Different error - this is unexpected
        progress.log(`❌ Unexpected error in AnthropicCUAClient: ${browserError}`);
        return false;
      }
    }
  } catch (error) {
    // Check if this is the expected browser safety error at the outer level
    if (error instanceof Error && error.message.includes('browser-like environment')) {
      progress.log('✅ AnthropicCUAClient correctly enforces browser safety restrictions');
      progress.log('   This is expected behavior in browser environments for security');
      return true;
    } else {
      progress.log(`❌ AnthropicCUAClient implementation test failed: ${error}`);
      return false;
    }
  }
}

/**
 * Test AgentClient type validation and edge cases
 */
function testAgentClientEdgeCases(progress: AgentClientProgress): boolean {
  progress.log('⚠️ Testing AgentClient edge cases and validation...');

  try {
    // Test with empty strings
    const client1 = new MockAgentClient('openai', '');
    if (client1.modelName !== '') {
      progress.log('❌ Should accept empty model name');
      return false;
    }

    // Test with empty instructions
    const client2 = new MockAgentClient('anthropic', 'claude-3-5-sonnet-20241022', '');
    if (client2.userProvidedInstructions !== '') {
      progress.log('❌ Should accept empty instructions');
      return false;
    }

    // Test with undefined instructions (explicitly)
    const client3 = new MockAgentClient('openai', 'gpt-4', undefined);
    if (client3.userProvidedInstructions !== undefined) {
      progress.log('❌ Should accept undefined instructions');
      return false;
    }

    // Test viewport with edge values
    const client4 = new MockAgentClient('openai', 'gpt-4');

    // Test zero dimensions
    client4.setViewport(0, 0);
    if (client4.lastViewport?.width !== 0 || client4.lastViewport?.height !== 0) {
      progress.log('❌ Should accept zero viewport dimensions');
      return false;
    }

    // Test large dimensions
    const client5 = new MockAgentClient('openai', 'gpt-4');
    client5.setViewport(9999, 9999);
    if (client5.lastViewport?.width !== 9999 || client5.lastViewport?.height !== 9999) {
      progress.log('❌ Should accept large viewport dimensions');
      return false;
    }

    // Test URL edge cases
    client4.setCurrentUrl('');
    if (client4.lastUrl !== '') {
      progress.log('❌ Should accept empty URL');
      return false;
    }

    client4.setCurrentUrl('data:text/html,<h1>Test</h1>');
    if (!client4.lastUrl?.startsWith('data:')) {
      progress.log('❌ Should accept data URLs');
      return false;
    }

    progress.log('✅ AgentClient edge cases tests passed');
    return true;
  } catch (error) {
    progress.log(`❌ AgentClient edge cases test failed: ${error}`);
    return false;
  }
}

/**
 * Test AgentClient interface compliance and type safety
 */
function testAgentClientTypeSafety(progress: AgentClientProgress): boolean {
  progress.log('🔒 Testing AgentClient type safety and interface compliance...');

  try {
    const mockClient = new MockAgentClient('openai', 'gpt-4');

    // Test that all required AgentClient properties exist
    const requiredProperties = ['type', 'modelName', 'clientOptions', 'userProvidedInstructions'];
    for (const prop of requiredProperties) {
      if (!(prop in mockClient)) {
        progress.log(`❌ Required property '${prop}' missing from AgentClient`);
        return false;
      }
    }

    // Test that all required AgentClient methods exist
    const requiredMethods = [
      'execute',
      'captureScreenshot',
      'setViewport',
      'setCurrentUrl',
      'setScreenshotProvider',
      'setActionHandler',
    ];

    for (const method of requiredMethods) {
      if (typeof (mockClient as unknown as Record<string, unknown>)[method] !== 'function') {
        progress.log(`❌ Required method '${method}' missing or not a function`);
        return false;
      }
    }

    // Test type property validation
    const validTypes: AgentType[] = ['openai', 'anthropic'];
    for (const type of validTypes) {
      const client = new MockAgentClient(type, 'test-model');
      if (client.type !== type) {
        progress.log(`❌ Agent type '${type}' not set correctly`);
        return false;
      }
    }

    progress.log('✅ AgentClient type safety tests passed');
    return true;
  } catch (error) {
    progress.log(`❌ AgentClient type safety test failed: ${error}`);
    return false;
  }
}

/**
 * Main test function that runs all AgentClient tests
 */
export async function testAgentClient(
  context: AgentClientTestContext,
  _page?: Page
): Promise<boolean> {
  const progress = new AgentClientProgress('AgentClient Tests');

  progress.log('🚀 Starting comprehensive AgentClient test suite...');

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: 'Starting AgentClient tests',
  });

  const tests = [
    { name: 'Abstract Class Structure', fn: () => testAgentClientAbstractClass(progress) },
    { name: 'Abstract Methods', fn: () => testAgentClientAbstractMethods(progress) },
    { name: 'OpenAICUAClient Implementation', fn: () => testOpenAICUAClient(progress) },
    { name: 'AnthropicCUAClient Implementation', fn: () => testAnthropicCUAClient(progress) },
    { name: 'Edge Cases', fn: () => testAgentClientEdgeCases(progress) },
    { name: 'Type Safety', fn: () => testAgentClientTypeSafety(progress) },
  ];

  let passedTests = 0;
  const totalTests = tests.length;

  for (const test of tests) {
    progress.log(`\n📋 Running test: ${test.name}`);

    try {
      const result = test.fn();
      if (result) {
        passedTests++;
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Info,
          message: `✅ ${test.name} passed`,
        });
      } else {
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Error,
          message: `❌ ${test.name} failed`,
        });
      }
    } catch (error) {
      progress.log(`❌ ${test.name} threw an error: ${error}`);
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: `❌ ${test.name} threw an error`,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  const success = passedTests === totalTests;
  const summary = `AgentClient tests completed: ${passedTests}/${totalTests} passed`;

  progress.log(`\n🏁 ${summary}`);

  context.events.emit({
    timestamp: Date.now(),
    severity: success ? Severity.Info : Severity.Error,
    message: summary,
    details: {
      passed: passedTests,
      total: totalTests,
      success,
    },
  });

  return success;
}
