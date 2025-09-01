/**
 * Comprehensive tests for A11y (Accessibility) Utils
 *
 * This test suite validates the accessibility utility functions in Stagehand:
 * -     const testCases = [
    {
      name: 'Leaf node formatting',
      node: leafNode,
      expectedPattern: /\[1-123\] button: Click me/,
    },
    {
      name: 'Parent node formatting',
      node: parentNode,
      expectedPattern: /\[2-456\] div: Container[\s\S]*\s+\[1-123\] button: Click me/,
    },
    {
      name: 'Root node with hierarchy',
      node: rootNode,
      expectedPattern: /\[3\] main: Main Content[\s\S]*\s+\[2-456\] div: Container[\s\S]*\s+\[1-123\] button: Click me/,
    },
    {
      name: 'Node without name',
      node: { nodeId: '4', role: 'generic' },
      expectedPattern: /\[4\] generic$/,
    },
  ];
    },
    {
      name: 'Root node with hierarchy',
      node: rootNode,
      expectedPattern: /\[3\] main: Main Content[\s\S]*\s+\[2-456\] div: Container[\s\S]*\s+\[1-123\] button: Click me/,
    },ing and normalization
 * - Tree formatting and hierarchy processing
 * - Backend ID mapping and XPath generation
 * - Accessibility tree building and processing
 * - Frame handling and chain resolution
 * - Chrome extension compatibility
 */

import { TestContext } from './types';
import { Page } from '@src/services/cordyceps/page';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';
import {
  cleanText,
  formatSimplifiedTree,
  buildBackendIdMaps,
  buildHierarchicalTree,
  getAccessibilityTree,
  getCDPFrameId,
  getFrameRootXpath,
  getFrameRootXpathWithShadow,
  getAccessibilityTreeWithFrames,
  injectSubtrees,
  resolveFrameChain,
} from '../../lib/a11y/utils';
import { AccessibilityNode, EncodedId } from '../../types/context';
import { ChromeExtensionStagehandPage } from '../../lib/ChromeExtensionStagehandPage';
import { LogLine } from '../../types/log';
import { Severity } from '@src/utils/types';

/**
 * Test progress tracker for A11y utils tests
 */
export class A11yUtilsProgress {
  constructor(private name: string) {}

  log(message: string): void {
    console.log(`[${this.name}] ${message}`);
  }
}

/**
 * Test the cleanText function with various input scenarios
 */
function testCleanTextFunction(progress: A11yUtilsProgress): boolean {
  progress.log('🧹 Testing cleanText function...');

  const testCases = [
    {
      name: 'Basic text cleaning',
      input: '  Hello   World  ',
      expected: 'Hello   World', // Leading/trailing spaces trimmed, internal spaces preserved
    },
    {
      name: 'Private use area character removal',
      input: 'Hello\uE000\uE123World\uF8FF',
      expected: 'HelloWorld',
    },
    {
      name: 'NBSP character normalization',
      input: 'Hello\u00A0\u202F\u2007\uFEFFWorld',
      expected: 'Hello World', // NBSP chars become single space
    },
    {
      name: 'Mixed whitespace normalization',
      input: '\t\n  Hello\u00A0\u00A0World\t\n  ',
      expected: 'Hello World', // All whitespace collapsed to single spaces and trimmed
    },
    {
      name: 'Empty string handling',
      input: '',
      expected: '',
    },
    {
      name: 'Only whitespace',
      input: '\u00A0\u202F\u2007',
      expected: '', // NBSP chars become single space, then trimmed
    },
    {
      name: 'Complex mixed case',
      input: '\uE000  Hello\u00A0\u00A0\uE123Beautiful\u202F\u2007World\uF8FF  ',
      expected: 'Hello Beautiful World', // PUA removed, NBSP collapsed, spaces preserved, trimmed
    },
  ];

  let passed = 0;
  const total = testCases.length;

  for (const testCase of testCases) {
    try {
      const result = cleanText(testCase.input);
      progress.log(
        `🔍 Debug: Input: "${testCase.input}" -> Output: "${result}" -> Expected: "${testCase.expected}"`
      );
      if (result === testCase.expected) {
        progress.log(`✅ ${testCase.name}: "${result}"`);
        passed++;
      } else {
        progress.log(`❌ ${testCase.name}: Expected "${testCase.expected}", got "${result}"`);
      }
    } catch (error) {
      progress.log(`❌ ${testCase.name}: Error - ${error}`);
    }
  }

  const success = passed === total;
  progress.log(`cleanText function: ${passed}/${total} tests passed ${success ? '✅' : '❌'}`);
  return success;
}

/**
 * Test the formatSimplifiedTree function with accessibility node structures
 */
function testFormatSimplifiedTreeFunction(progress: A11yUtilsProgress): boolean {
  progress.log('🌳 Testing formatSimplifiedTree function...');

  // Create test accessibility nodes
  const leafNode: AccessibilityNode & { encodedId?: EncodedId } = {
    nodeId: '1',
    role: 'button',
    name: 'Click me',
    encodedId: '1-123' as EncodedId,
  };

  const parentNode: AccessibilityNode & { encodedId?: EncodedId } = {
    nodeId: '2',
    role: 'div',
    name: 'Container',
    encodedId: '2-456' as EncodedId,
    children: [leafNode],
  };

  const rootNode: AccessibilityNode & { encodedId?: EncodedId } = {
    nodeId: '3',
    role: 'main',
    name: 'Main Content',
    children: [parentNode],
  };

  const testCases = [
    {
      name: 'Leaf node formatting',
      node: leafNode,
      expectedPattern: /\[1-123\] button: Click me\n?/,
    },
    {
      name: 'Parent node formatting',
      node: parentNode,
      expectedPattern: /\[2-456\] div: Container[\s\S]*\s+\[1-123\] button: Click me/,
    },
    {
      name: 'Root node with hierarchy',
      node: rootNode,
      expectedPattern:
        /\[3\] main: Main Content[\s\S]*\s+\[2-456\] div: Container[\s\S]*\s+\[1-123\] button: Click me/,
    },
    {
      name: 'Node without name',
      node: { nodeId: '4', role: 'generic' },
      expectedPattern: /\[4\] generic\n?$/,
    },
  ];

  let passed = 0;
  const total = testCases.length;

  for (const testCase of testCases) {
    try {
      const result = formatSimplifiedTree(testCase.node);
      progress.log(`🔍 Debug ${testCase.name}: Result: ${JSON.stringify(result)}`);
      progress.log(`🔍 Pattern: ${testCase.expectedPattern}`);
      if (testCase.expectedPattern.test(result)) {
        progress.log(`✅ ${testCase.name}: Formatted correctly`);
        passed++;
      } else {
        progress.log(`❌ ${testCase.name}: Pattern mismatch`);
        progress.log(`   Result: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      progress.log(`❌ ${testCase.name}: Error - ${error}`);
    }
  }

  const success = passed === total;
  progress.log(
    `formatSimplifiedTree function: ${passed}/${total} tests passed ${success ? '✅' : '❌'}`
  );
  return success;
}

/**
 * Test backend ID maps building functionality
 */
async function testBuildBackendIdMaps(progress: A11yUtilsProgress, page: Page): Promise<boolean> {
  progress.log('🗺️ Testing buildBackendIdMaps function...');

  try {
    // Create a mock ChromeExtensionStagehandPage
    const mockStagehandPage = {
      page: page,
    } as ChromeExtensionStagehandPage;

    // Navigate to the test page at localhost:3005
    progress.log('🌐 Navigating to http://localhost:3005...');
    await page.goto('http://localhost:3005');
    await page.waitForLoadState('domcontentloaded');
    progress.log('✅ Successfully loaded test page');

    // Test building backend ID maps
    progress.log('📋 Calling buildBackendIdMaps...');
    const result = await buildBackendIdMaps(true, mockStagehandPage);

    progress.log(`📋 buildBackendIdMaps result: ${JSON.stringify(result, null, 2)}`);

    // Validate the result structure
    if (!result) {
      progress.log('❌ buildBackendIdMaps: Returned null or undefined');
      return false;
    }

    const hasTagNameMap = typeof result.tagNameMap === 'object';
    const hasXpathMap = typeof result.xpathMap === 'object';

    if (hasTagNameMap && hasXpathMap) {
      progress.log('✅ buildBackendIdMaps: Returned expected structure');
      progress.log(`   tagNameMap keys: ${Object.keys(result.tagNameMap).length}`);
      progress.log(`   xpathMap keys: ${Object.keys(result.xpathMap).length}`);
      return true;
    } else {
      progress.log('❌ buildBackendIdMaps: Missing expected properties');
      return false;
    }
  } catch (error) {
    progress.log(`❌ buildBackendIdMaps: Error - ${error}`);
    return false;
  }
}

/**
 * Test hierarchical tree building functionality
 */
async function testBuildHierarchicalTree(progress: A11yUtilsProgress): Promise<boolean> {
  progress.log('🏗️ Testing buildHierarchicalTree function...');

  try {
    // Create test accessibility nodes
    const mockNodes: AccessibilityNode[] = [
      {
        nodeId: '1',
        role: 'document',
        name: 'Test Document',
      },
      {
        nodeId: '2',
        role: 'button',
        name: 'Test Button',
        parentId: '1',
      },
      {
        nodeId: '3',
        role: 'text',
        name: 'Test Text',
        parentId: '1',
      },
    ];

    const mockTagNameMap: Record<EncodedId, string> = {
      '1-1': 'html',
      '2-2': 'button',
      '3-3': 'span',
    };

    const mockLogger = (logLine: LogLine) => {
      progress.log(`   Logger: ${logLine.message}`);
    };

    // Test building hierarchical tree
    const result = await buildHierarchicalTree(mockNodes, mockTagNameMap, mockLogger);

    // Validate the result structure
    const hasTree = Array.isArray(result.tree);
    const hasSimplified = typeof result.simplified === 'string';
    const hasIframes = Array.isArray(result.iframes);
    const hasIdToUrl = typeof result.idToUrl === 'object';
    const hasXpathMap = typeof result.xpathMap === 'object';

    if (hasTree && hasSimplified && hasIframes && hasIdToUrl && hasXpathMap) {
      progress.log('✅ buildHierarchicalTree: Returned expected structure');
      progress.log(`   Tree nodes: ${result.tree.length}`);
      progress.log(`   Simplified length: ${result.simplified.length}`);
      return true;
    } else {
      progress.log('❌ buildHierarchicalTree: Missing expected properties');
      return false;
    }
  } catch (error) {
    progress.log(`❌ buildHierarchicalTree: Error - ${error}`);
    return false;
  }
}

/**
 * Test accessibility tree retrieval
 */
async function testGetAccessibilityTree(progress: A11yUtilsProgress, page: Page): Promise<boolean> {
  progress.log('♿ Testing getAccessibilityTree function...');

  try {
    // Create a mock ChromeExtensionStagehandPage
    const mockStagehandPage = {
      page: page,
    } as ChromeExtensionStagehandPage;

    // Navigate to the test page at localhost:3005 for richer content
    progress.log('🌐 Navigating to http://localhost:3005 for accessibility tree test...');
    await page.goto('http://localhost:3005');
    await page.waitForLoadState('domcontentloaded');
    progress.log('✅ Successfully loaded test page with rich accessibility content');

    const mockLogger = (logLine: LogLine) => {
      progress.log(`   Logger: ${logLine.message}`);
    };

    // Test getting accessibility tree
    const result = await getAccessibilityTree(true, mockStagehandPage, mockLogger);

    // Validate the result structure
    const hasTree = Array.isArray(result.tree);
    const hasSimplified = typeof result.simplified === 'string';
    const hasIframes = Array.isArray(result.iframes);
    const hasIdToUrl = typeof result.idToUrl === 'object';
    const hasXpathMap = typeof result.xpathMap === 'object';

    if (hasTree && hasSimplified && hasIframes && hasIdToUrl && hasXpathMap) {
      progress.log('✅ getAccessibilityTree: Returned expected structure');
      progress.log(`   Tree nodes: ${result.tree.length}`);
      progress.log(`   Simplified content: ${result.simplified.slice(0, 100)}...`);
      return true;
    } else {
      progress.log('❌ getAccessibilityTree: Missing expected properties');
      return false;
    }
  } catch (error) {
    progress.log(`❌ getAccessibilityTree: Error - ${error}`);
    return false;
  }
}

/**
 * Test frame handling functions
 */
async function testFrameFunctions(progress: A11yUtilsProgress, page: Page): Promise<boolean> {
  progress.log('🖼️ Testing frame handling functions...');

  try {
    // Create a mock ChromeExtensionStagehandPage
    const mockStagehandPage = {
      page: page,
    } as ChromeExtensionStagehandPage;

    // Test getCDPFrameId with undefined frame
    const frameId1 = await getCDPFrameId(mockStagehandPage, undefined);
    progress.log(`✅ getCDPFrameId with undefined: ${frameId1}`);

    // Test getFrameRootXpath with undefined frame
    const xpath1 = await getFrameRootXpath(undefined);
    if (xpath1 === '/') {
      progress.log('✅ getFrameRootXpath with undefined: Returns "/"');
    } else {
      progress.log(`❌ getFrameRootXpath with undefined: Expected "/", got "${xpath1}"`);
      return false;
    }

    // Test getFrameRootXpathWithShadow with undefined frame
    const xpath2 = await getFrameRootXpathWithShadow(undefined);
    if (xpath2 === '/') {
      progress.log('✅ getFrameRootXpathWithShadow with undefined: Returns "/"');
    } else {
      progress.log(`❌ getFrameRootXpathWithShadow with undefined: Expected "/", got "${xpath2}"`);
      return false;
    }

    // Test resolveFrameChain
    const frameChain = await resolveFrameChain(mockStagehandPage, '/html/body/div');
    if (Array.isArray(frameChain.frames) && typeof frameChain.rest === 'string') {
      progress.log('✅ resolveFrameChain: Returns expected structure');
    } else {
      progress.log('❌ resolveFrameChain: Unexpected structure');
      return false;
    }

    return true;
  } catch (error) {
    progress.log(`❌ Frame functions: Error - ${error}`);
    return false;
  }
}

/**
 * Test accessibility tree with frames
 */
async function testGetAccessibilityTreeWithFrames(
  progress: A11yUtilsProgress,
  page: Page
): Promise<boolean> {
  progress.log('🖼️♿ Testing getAccessibilityTreeWithFrames function...');

  try {
    // Create a mock ChromeExtensionStagehandPage
    const mockStagehandPage = {
      page: page,
    } as ChromeExtensionStagehandPage;

    // Navigate to the test page at localhost:3005
    progress.log('🌐 Navigating to http://localhost:3005 for frames test...');
    await page.goto('http://localhost:3005');
    await page.waitForLoadState('domcontentloaded');
    progress.log('✅ Successfully loaded test page for frames test');

    const mockLogger = (logLine: LogLine) => {
      progress.log(`   Logger: ${logLine.message}`);
    };

    // Test getting accessibility tree with frames
    const result = await getAccessibilityTreeWithFrames(true, mockStagehandPage, mockLogger);

    // Validate the result structure
    const hasCombinedTree = typeof result.combinedTree === 'string';
    const hasCombinedXpathMap = typeof result.combinedXpathMap === 'object';
    const hasCombinedUrlMap = typeof result.combinedUrlMap === 'object';

    if (hasCombinedTree && hasCombinedXpathMap && hasCombinedUrlMap) {
      progress.log('✅ getAccessibilityTreeWithFrames: Returned expected structure');
      progress.log(`   Combined tree length: ${result.combinedTree.length}`);
      return true;
    } else {
      progress.log('❌ getAccessibilityTreeWithFrames: Missing expected properties');
      return false;
    }
  } catch (error) {
    progress.log(`❌ getAccessibilityTreeWithFrames: Error - ${error}`);
    return false;
  }
}

/**
 * Test utility functions
 */
function testUtilityFunctions(progress: A11yUtilsProgress): boolean {
  progress.log('🔧 Testing utility functions...');

  try {
    // Test injectSubtrees
    const testTree = '[1] main: Main Content\n  [2] div: Container\n';
    const testIdToTree = new Map<EncodedId, string>();
    testIdToTree.set('1-123', '  [iframe] iframe: Embedded Content\n');

    const injectedResult = injectSubtrees(testTree, testIdToTree);
    if (typeof injectedResult === 'string') {
      progress.log('✅ injectSubtrees: Returns string result');
    } else {
      progress.log('❌ injectSubtrees: Unexpected return type');
      return false;
    }

    return true;
  } catch (error) {
    progress.log(`❌ Utility functions: Error - ${error}`);
    return false;
  }
}

/**
 * Main test function for A11y utils - runs all individual tests
 */
export async function testA11yUtils(
  progress: A11yUtilsProgress,
  context: TestContext
): Promise<void> {
  progress.log('🚀 Starting A11y Utils comprehensive test suite...');

  const results: { [key: string]: boolean } = {};

  // Test pure functions first (no browser dependencies)
  results.cleanText = testCleanTextFunction(progress);
  results.formatSimplifiedTree = testFormatSimplifiedTreeFunction(progress);
  results.utilityFunctions = testUtilityFunctions(progress);

  // Create browser window for browser-dependent tests
  let browserWindow: BrowserWindow | null = null;
  let page: Page | null = null;

  try {
    progress.log('📱 Creating browser window for browser-dependent tests...');
    browserWindow = await BrowserWindow.create();
    page = await browserWindow.getCurrentPage();

    if (!page) {
      throw new Error('Failed to get current page from browser window');
    }

    // Test browser-dependent functions
    results.buildBackendIdMaps = await testBuildBackendIdMaps(progress, page);
    results.buildHierarchicalTree = await testBuildHierarchicalTree(progress);
    results.getAccessibilityTree = await testGetAccessibilityTree(progress, page);
    results.frameFunctions = await testFrameFunctions(progress, page);
    results.getAccessibilityTreeWithFrames = await testGetAccessibilityTreeWithFrames(
      progress,
      page
    );
  } catch (error) {
    progress.log(`❌ Browser window creation failed: ${error}`);
    // Set all browser-dependent tests as failed
    results.buildBackendIdMaps = false;
    results.buildHierarchicalTree = false;
    results.getAccessibilityTree = false;
    results.frameFunctions = false;
    results.getAccessibilityTreeWithFrames = false;
  } finally {
    // Clean up browser resources
    if (browserWindow) {
      try {
        browserWindow.dispose();
        progress.log('🧹 Browser window disposed successfully');
      } catch (error) {
        progress.log(`⚠️ Browser window disposal warning: ${error}`);
      }
    }
  }

  // Calculate overall results
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(Boolean).length;
  const success = passedTests === totalTests;

  // Emit final results to context
  context.events.emit({
    timestamp: Date.now(),
    severity: success ? Severity.Success : Severity.Error,
    message: `A11y Utils tests completed: ${passedTests}/${totalTests} passed ${success ? '✅' : '❌'}`,
    details: {
      testResults: results,
      passedTests,
      totalTests,
      testType: 'A11y Utils Unit Tests',
      coverage: [
        'cleanText function - string cleaning and normalization',
        'formatSimplifiedTree function - accessibility tree formatting',
        'buildBackendIdMaps function - DOM mapping and XPath generation',
        'buildHierarchicalTree function - accessibility tree building',
        'getAccessibilityTree function - accessibility tree retrieval',
        'Frame handling functions - frame ID and XPath resolution',
        'getAccessibilityTreeWithFrames function - multi-frame accessibility',
        'Utility functions - tree injection and manipulation',
      ],
      chromeExtensionCompatibility: 'All functions tested for Chrome extension context',
    },
  });

  if (!success) {
    const failedTests = Object.entries(results)
      .filter(([_, passed]) => !passed)
      .map(([test, _]) => test);

    throw new Error(`A11y Utils tests failed: ${failedTests.join(', ')}`);
  }

  progress.log(
    `🎉 A11y Utils test suite completed successfully! ${passedTests}/${totalTests} tests passed`
  );
}
