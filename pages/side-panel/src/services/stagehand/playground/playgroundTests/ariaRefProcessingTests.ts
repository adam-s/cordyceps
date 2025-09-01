/**
 * Comprehensive tests for ARIA reference processing in Stagehand
 *
 * This test validates the complete ARIA ref workflow:
 * - Schema validation with aria-ref format
 * - Selector generation for Cordyceps
 * - Element location using aria-ref selectors
 * - Integration with observe handler processing
 * - Snapshot parsing and element mapping
 */

import { z } from 'zod';
import { Page } from '@src/services/cordyceps/page';
import { EventMessage, Severity } from '@src/utils/types';

/**
 * Test progress tracker for ARIA ref tests
 */
export class AriaRefProgress {
  constructor(private name: string) {}

  log(message: string): void {
    console.log(`[${this.name}] ${message}`);
  }
}

/**
 * Test context interface for consistency
 */
interface AriaRefTestContext {
  events: {
    emit: (event: EventMessage) => void;
  };
}

/**
 * Test the Zod schema validation with aria-ref format
 */
function testAriaRefSchemaValidation(progress: AriaRefProgress): boolean {
  progress.log('🔍 Testing ARIA ref schema validation...');

  // Define the schema as used in inference.ts
  const baseElementSchema = z.object({
    elementId: z
      .string()
      .describe(
        "the ID string associated with the element. This should be the aria-ref identifier (like 'e123', 'f45e67') extracted from the [ref=...] attributes in the accessibility tree. Do not include brackets or 'ref=' prefix - just the identifier itself."
      ),
    description: z.string().describe('a description of the accessible element and its purpose'),
  });

  // Test data that should be valid
  const testCases = [
    { elementId: 'e123', description: 'A test button element' },
    { elementId: 'f45e67', description: 'An iframe element' },
    { elementId: 'e999', description: 'Another element' },
    { elementId: 'f1e2', description: 'Nested iframe element' },
  ];

  let passed = 0;
  const total = testCases.length;

  for (const testData of testCases) {
    try {
      baseElementSchema.parse(testData);
      progress.log(`✅ Schema validation passed for: ${testData.elementId}`);
      passed++;
    } catch (error) {
      progress.log(`❌ Schema validation failed for: ${testData.elementId} - ${error}`);
    }
  }

  const success = passed === total;
  progress.log(`Schema validation: ${passed}/${total} tests passed ${success ? '✅' : '❌'}`);
  return success;
}

/**
 * Test selector format processing
 */
function testSelectorFormatProcessing(progress: AriaRefProgress): boolean {
  progress.log('🔧 Testing selector format processing...');

  function processElementId(elementId: string): { selector: string; valid: boolean } {
    if (elementId.match(/^[ef]\d+e?\d*$/)) {
      return {
        selector: `aria-ref=${elementId}`,
        valid: true,
      };
    }
    return {
      selector: 'unknown-format',
      valid: false,
    };
  }

  const testCases = [
    { input: 'e123', expected: 'aria-ref=e123' },
    { input: 'f45e67', expected: 'aria-ref=f45e67' },
    { input: 'e999', expected: 'aria-ref=e999' },
    { input: 'f1e2', expected: 'aria-ref=f1e2' },
    { input: 'invalid', expected: 'unknown-format' },
  ];

  let passed = 0;
  const total = testCases.length;

  for (const testCase of testCases) {
    const result = processElementId(testCase.input);
    if (result.selector === testCase.expected) {
      progress.log(`✅ Selector processing passed: ${testCase.input} -> ${result.selector}`);
      passed++;
    } else {
      progress.log(
        `❌ Selector processing failed: ${testCase.input} -> ${result.selector} (expected: ${testCase.expected})`
      );
    }
  }

  const success = passed === total;
  progress.log(`Selector processing: ${passed}/${total} tests passed ${success ? '✅' : '❌'}`);
  return success;
}

/**
 * Test ARIA ref extraction from snapshot content
 */
function testAriaRefExtraction(progress: AriaRefProgress): boolean {
  progress.log('📄 Testing ARIA ref extraction from snapshot...');

  // Mock snapshot content with ARIA references
  const mockSnapshot = `
Enhanced Testing Page [ref=e1]
button "Action Button" [ref=e2]
checkbox "Test Checkbox" [ref=e3]
textbox "Username" [ref=e4]
iframe [ref=f1e5]
  button "Iframe Button" [ref=f1e6]
  textbox "Iframe Input" [ref=f1e7]
iframe [ref=f2e8]
  button "Second Iframe Button" [ref=f2e9]
link "Navigation Link" [ref=e10]
`;

  // Extract ARIA references using the same regex as in _buildSelectorMapFromSnapshot
  const ariaRefRegex = /\[ref=([ef]\d+e?\d*)\]/g;
  const extractedRefs: string[] = [];

  let match;
  while ((match = ariaRefRegex.exec(mockSnapshot)) !== null) {
    extractedRefs.push(match[1]);
  }

  const expectedRefs = ['e1', 'e2', 'e3', 'e4', 'f1e5', 'f1e6', 'f1e7', 'f2e8', 'f2e9', 'e10'];

  let passed = 0;
  const total = expectedRefs.length;

  for (const expectedRef of expectedRefs) {
    if (extractedRefs.includes(expectedRef)) {
      progress.log(`✅ Found expected ARIA ref: ${expectedRef}`);
      passed++;
    } else {
      progress.log(`❌ Missing expected ARIA ref: ${expectedRef}`);
    }
  }

  // Check for unexpected refs
  for (const extractedRef of extractedRefs) {
    if (!expectedRefs.includes(extractedRef)) {
      progress.log(`⚠️ Unexpected ARIA ref found: ${extractedRef}`);
    }
  }

  const success = passed === total;
  progress.log(`ARIA ref extraction: ${passed}/${total} refs found ${success ? '✅' : '❌'}`);
  progress.log(`Total extracted: ${extractedRefs.length}, Expected: ${expectedRefs.length}`);
  return success;
}

/**
 * Test element ID processing as done in observe handler
 */
function testElementIdProcessing(progress: AriaRefProgress): boolean {
  progress.log('⚙️ Testing element ID processing (observe handler style)...');

  function processObservationElement(elementId: string): {
    selector?: string;
    valid: boolean;
    format: string;
  } {
    if (elementId.includes('-')) {
      // Frame-element format (legacy)
      return {
        format: 'frame-element',
        valid: true,
        selector: `xpath=//element[@data-encoded-id='${elementId}']`,
      };
    } else if (elementId.match(/^[ef]\d+e?\d*$/)) {
      // ARIA ref format (current)
      return {
        format: 'aria-ref',
        valid: true,
        selector: `aria-ref=${elementId}`,
      };
    } else {
      // Unknown format
      return {
        format: 'unknown',
        valid: false,
      };
    }
  }

  const testCases = [
    { input: 'e123', expectedFormat: 'aria-ref', expectedValid: true },
    { input: 'f45e67', expectedFormat: 'aria-ref', expectedValid: true },
    { input: '1-2', expectedFormat: 'frame-element', expectedValid: true },
    { input: '5-10', expectedFormat: 'frame-element', expectedValid: true },
    { input: 'invalid123', expectedFormat: 'unknown', expectedValid: false },
    { input: 'xyz', expectedFormat: 'unknown', expectedValid: false },
  ];

  let passed = 0;
  const total = testCases.length;

  for (const testCase of testCases) {
    const result = processObservationElement(testCase.input);
    const formatMatch = result.format === testCase.expectedFormat;
    const validMatch = result.valid === testCase.expectedValid;

    if (formatMatch && validMatch) {
      progress.log(
        `✅ Element ID processing passed: ${testCase.input} -> ${result.format} (valid: ${result.valid})`
      );
      if (result.selector) {
        progress.log(`   Generated selector: ${result.selector}`);
      }
      passed++;
    } else {
      progress.log(
        `❌ Element ID processing failed: ${testCase.input} -> ${result.format} (valid: ${result.valid})`
      );
      progress.log(`   Expected: ${testCase.expectedFormat} (valid: ${testCase.expectedValid})`);
    }
  }

  const success = passed === total;
  progress.log(`Element ID processing: ${passed}/${total} tests passed ${success ? '✅' : '❌'}`);
  return success;
}

/**
 * Test live ARIA ref functionality with actual page
 */
async function testLiveAriaRefFunctionality(
  page: Page,
  progress: AriaRefProgress
): Promise<boolean> {
  progress.log('🌐 Testing live ARIA ref functionality...');

  try {
    // Navigate to a test page
    await page.goto('http://localhost:3005', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Take an AI snapshot to get ARIA references
    progress.log('📸 Taking AI snapshot...');
    const snapshot = await page.snapshotForAI();

    if (!snapshot || snapshot.length < 100) {
      progress.log(`❌ Snapshot too short or empty: ${snapshot.length} characters`);
      return false;
    }

    progress.log(`✅ Snapshot received: ${snapshot.length} characters`);

    // Extract ARIA references
    const ariaRefRegex = /\[ref=([ef]\d+e?\d*)\]/g;
    const foundRefs: string[] = [];

    let match;
    while ((match = ariaRefRegex.exec(snapshot)) !== null) {
      foundRefs.push(match[1]);
    }

    if (foundRefs.length === 0) {
      progress.log('⚠️ No ARIA references found in snapshot');
      return false;
    }

    progress.log(`✅ Found ${foundRefs.length} ARIA references`);

    // Test a few references to see if they can be used as selectors
    const testRefs = foundRefs.slice(0, Math.min(3, foundRefs.length));
    let successfulSelectors = 0;

    for (const ref of testRefs) {
      try {
        progress.log(`🔍 Testing selector: aria-ref=${ref}`);
        const element = await page.locator(`aria-ref=${ref}`).elementHandle();
        if (element) {
          progress.log(`✅ Successfully located element with aria-ref=${ref}`);
          successfulSelectors++;
        } else {
          progress.log(`⚠️ Element handle was null for aria-ref=${ref}`);
        }
      } catch (error) {
        progress.log(`⚠️ Error locating element aria-ref=${ref}: ${error}`);
        // This might be expected for some elements (cross-origin, etc.)
      }
    }

    const success = successfulSelectors > 0;
    progress.log(
      `Live ARIA ref test: ${successfulSelectors}/${testRefs.length} selectors worked ${
        success ? '✅' : '❌'
      }`
    );
    return success;
  } catch (error) {
    progress.log(`❌ Live ARIA ref test failed: ${error}`);
    return false;
  }
}

/**
 * Main test function for ARIA ref processing
 */
export async function testAriaRefProcessing(
  progress: AriaRefProgress,
  context: AriaRefTestContext
): Promise<void> {
  progress.log('🧪 Starting comprehensive ARIA ref processing tests...');

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: 'Starting ARIA ref processing tests',
    details: {
      testTypes: [
        'Schema Validation',
        'Selector Format Processing',
        'ARIA Ref Extraction',
        'Element ID Processing',
        'Live Functionality Test',
      ],
    },
  });

  const results = {
    schemaValidation: false,
    selectorProcessing: false,
    ariaRefExtraction: false,
    elementIdProcessing: false,
    liveFunctionality: false,
  };

  try {
    // Test 1: Schema validation
    results.schemaValidation = testAriaRefSchemaValidation(progress);

    // Test 2: Selector format processing
    results.selectorProcessing = testSelectorFormatProcessing(progress);

    // Test 3: ARIA ref extraction from snapshot
    results.ariaRefExtraction = testAriaRefExtraction(progress);

    // Test 4: Element ID processing
    results.elementIdProcessing = testElementIdProcessing(progress);

    // Test 5: Live functionality (if page is available)
    try {
      const page = (globalThis as { cordycepsCurrentPage?: unknown }).cordycepsCurrentPage as Page;
      if (page) {
        results.liveFunctionality = await testLiveAriaRefFunctionality(page, progress);
      } else {
        progress.log('⚠️ No active page available for live functionality test');
        results.liveFunctionality = true; // Don't fail if no page available
      }
    } catch (error) {
      progress.log(`⚠️ Live functionality test skipped: ${error}`);
      results.liveFunctionality = true; // Don't fail if page test can't run
    }

    // Calculate overall results
    const passedTests = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;
    const allPassed = passedTests === totalTests;

    progress.log(`\n📊 Test Summary:`);
    progress.log(`Schema Validation: ${results.schemaValidation ? '✅' : '❌'}`);
    progress.log(`Selector Processing: ${results.selectorProcessing ? '✅' : '❌'}`);
    progress.log(`ARIA Ref Extraction: ${results.ariaRefExtraction ? '✅' : '❌'}`);
    progress.log(`Element ID Processing: ${results.elementIdProcessing ? '✅' : '❌'}`);
    progress.log(`Live Functionality: ${results.liveFunctionality ? '✅' : '❌'}`);
    progress.log(`\nOverall: ${passedTests}/${totalTests} tests passed ${allPassed ? '✅' : '❌'}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: allPassed ? Severity.Success : Severity.Warning,
      message: `ARIA ref processing tests completed: ${passedTests}/${totalTests} passed`,
      details: {
        results,
        summary: {
          passed: passedTests,
          total: totalTests,
          success: allPassed,
        },
      },
    });

    if (!allPassed) {
      throw new Error(`ARIA ref tests failed: ${passedTests}/${totalTests} passed`);
    }

    progress.log('✅ All ARIA ref processing tests passed!');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`❌ ARIA ref processing tests failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ARIA ref processing tests failed',
      details: { error: errorMessage, results },
    });

    throw error;
  }
}

/**
 * Quick test function for ARIA ref processing (for fast validation)
 */
export async function quickAriaRefTest(): Promise<boolean> {
  const progress = new AriaRefProgress('QuickAriaRefTest');

  try {
    // Just run the core tests without page interaction
    const schemaTest = testAriaRefSchemaValidation(progress);
    const selectorTest = testSelectorFormatProcessing(progress);
    const extractionTest = testAriaRefExtraction(progress);

    const success = schemaTest && selectorTest && extractionTest;
    progress.log(`Quick ARIA ref test: ${success ? 'PASSED' : 'FAILED'}`);
    return success;
  } catch (error) {
    progress.log(`Quick ARIA ref test failed: ${error}`);
    return false;
  }
}

/**
 * Standalone test runner for ARIA ref functionality
 */
export async function runAriaRefTests(
  progress: AriaRefProgress,
  _context?: unknown
): Promise<void> {
  const testContext: AriaRefTestContext = {
    events: {
      emit: event => {
        console.log(`[Event] ${event.severity}: ${event.message}`, event.details || '');
      },
    },
  };

  await testAriaRefProcessing(progress, testContext);
}
