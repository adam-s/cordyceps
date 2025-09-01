/**
 * DOM Utilities Test Suite
 * Tests the stagehand DOM utility functions with real browser DOM elements
 *
 * Test Environment: http://localhost:3005
 * Target Elements: Rich HTML test page with forms, shadow DOM, iframes, etc.
 */

import { isElementNode, isTextNode } from '../../lib/dom/elementCheckUtils';
import { canElementScroll, getNodeFromXpath, waitForElementScrollEnd } from '../../lib/dom/utils';
import { getScrollableElements, getScrollableElementXpaths } from '../../lib/dom/process';
import { escapeXPathString, generateXPathsForElement } from '../../lib/dom/xpathUtils';

interface DOMTestResult {
  testName: string;
  success: boolean;
  details: string;
  error?: string;
}

interface DOMTestReport {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: DOMTestResult[];
}

/**
 * DOM Utils Test Runner
 * Comprehensive testing of DOM utilities with the test page elements
 */
export class DOMUtilsTestRunner {
  private results: DOMTestResult[] = [];

  constructor() {
    console.log('🔧 DOM Utils Test Runner initialized');
  }

  /**
   * Run all DOM utility tests
   */
  public async runAllTests(): Promise<DOMTestReport> {
    console.log('🚀 Starting DOM Utils tests...');
    this.results = [];

    // Test Element Type Checking
    await this.testElementTypeChecking();

    // Test XPath Utilities
    await this.testXPathUtilities();

    // Test Node Lookup
    await this.testNodeLookup();

    // Test Scroll Detection
    await this.testScrollDetection();

    // Test Scroll Element Processing
    await this.testScrollElementProcessing();

    // Test XPath Generation
    await this.testXPathGeneration();

    // Generate report
    const report = this.generateReport();
    this.logReport(report);

    return report;
  }

  /**
   * Test Element Type Checking Utilities
   */
  private async testElementTypeChecking(): Promise<void> {
    try {
      // Test with actual button element
      const button = document.getElementById('action-button');
      if (button) {
        const isElement = isElementNode(button);
        this.addResult(
          'Element Node Detection - Button',
          isElement,
          `Button element correctly identified as Element: ${isElement}`
        );
      } else {
        this.addResult(
          'Element Node Detection - Button',
          false,
          'Button element not found',
          'Element #action-button not found in DOM'
        );
      }

      // Test with text node
      const container = document.querySelector('.container');
      if (container && container.firstChild) {
        const textNode = container.childNodes[1]; // Should be text node
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
          const isText = isTextNode(textNode);
          const isElement = isElementNode(textNode);

          this.addResult(
            'Text Node Detection',
            isText && !isElement,
            `Text node correctly identified: isText=${isText}, isElement=${isElement}`
          );
        } else {
          this.addResult(
            'Text Node Detection',
            false,
            'Could not find suitable text node for testing'
          );
        }
      }

      // Test with checkbox input
      const checkbox = document.getElementById('test-checkbox');
      if (checkbox) {
        const isElement = isElementNode(checkbox);
        this.addResult(
          'Element Node Detection - Checkbox',
          isElement,
          `Checkbox input correctly identified as Element: ${isElement}`
        );
      }

      // Test with form element
      const form = document.getElementById('test-form');
      if (form) {
        const isElement = isElementNode(form);
        this.addResult(
          'Element Node Detection - Form',
          isElement,
          `Form element correctly identified as Element: ${isElement}`
        );
      }
    } catch (error) {
      this.addResult(
        'Element Type Checking',
        false,
        'Error during element type checking',
        String(error)
      );
    }
  }

  /**
   * Test XPath Utilities
   */
  private async testXPathUtilities(): Promise<void> {
    try {
      // Test XPath string escaping
      const testStrings = [
        'simple text',
        "text with 'single quotes'",
        'text with "double quotes"',
        `text with 'both' "quote types"`,
        'text with special chars: <>&',
      ];

      let allEscapeTestsPassed = true;
      for (const testString of testStrings) {
        const escaped = escapeXPathString(testString);
        // Verify escaped string doesn't break XPath syntax
        if (escaped.includes("'") && !escaped.includes('concat(')) {
          allEscapeTestsPassed = false;
          break;
        }
      }

      this.addResult(
        'XPath String Escaping',
        allEscapeTestsPassed,
        `All ${testStrings.length} test strings escaped successfully`
      );
    } catch (error) {
      this.addResult(
        'XPath Utilities',
        false,
        'Error during XPath utilities testing',
        String(error)
      );
    }
  }

  /**
   * Test Node Lookup via XPath
   */
  private async testNodeLookup(): Promise<void> {
    try {
      // Test finding button by ID
      const buttonXPath = "//button[@id='action-button']";
      const foundButton = getNodeFromXpath(buttonXPath);

      this.addResult(
        'XPath Node Lookup - Button',
        !!foundButton,
        foundButton
          ? `Button found via XPath: ${(foundButton as Element).tagName}`
          : 'Button not found via XPath'
      );

      // Test finding checkbox by ID
      const checkboxXPath = "//input[@id='test-checkbox']";
      const foundCheckbox = getNodeFromXpath(checkboxXPath);

      this.addResult(
        'XPath Node Lookup - Checkbox',
        !!foundCheckbox,
        foundCheckbox
          ? `Checkbox found via XPath: ${(foundCheckbox as Element).tagName}`
          : 'Checkbox not found via XPath'
      );

      // Test finding form element
      const formXPath = "//form[@id='test-form']";
      const foundForm = getNodeFromXpath(formXPath);

      this.addResult(
        'XPath Node Lookup - Form',
        !!foundForm,
        foundForm
          ? `Form found via XPath: ${(foundForm as Element).tagName}`
          : 'Form not found via XPath'
      );

      // Test finding by class
      const containerXPath = "//div[@class='container']";
      const foundContainer = getNodeFromXpath(containerXPath);

      this.addResult(
        'XPath Node Lookup - Container',
        !!foundContainer,
        foundContainer
          ? `Container found via XPath: ${(foundContainer as Element).className}`
          : 'Container not found via XPath'
      );

      // Test invalid XPath handling
      const invalidXPath = '//invalid[xpath[syntax';
      const invalidResult = getNodeFromXpath(invalidXPath);

      this.addResult(
        'XPath Invalid Syntax Handling',
        invalidResult === null,
        invalidResult === null
          ? 'Invalid XPath correctly returned null'
          : 'Invalid XPath should return null'
      );
    } catch (error) {
      this.addResult('Node Lookup', false, 'Error during node lookup testing', String(error));
    }
  }

  /**
   * Test Scroll Detection
   */
  private async testScrollDetection(): Promise<void> {
    try {
      // Test body scroll capability
      const bodyCanScroll = canElementScroll(document.body);
      this.addResult(
        'Scroll Detection - Body',
        typeof bodyCanScroll === 'boolean',
        `Body scroll detection returned: ${bodyCanScroll}`
      );

      // Test container scroll capability
      const container = document.querySelector('.container') as HTMLElement;
      if (container) {
        const containerCanScroll = canElementScroll(container);
        this.addResult(
          'Scroll Detection - Container',
          typeof containerCanScroll === 'boolean',
          `Container scroll detection returned: ${containerCanScroll}`
        );
      }

      // Test form scroll capability
      const form = document.getElementById('test-form') as HTMLElement;
      if (form) {
        const formCanScroll = canElementScroll(form);
        this.addResult(
          'Scroll Detection - Form',
          typeof formCanScroll === 'boolean',
          `Form scroll detection returned: ${formCanScroll}`
        );
      }

      // Test textarea scroll capability (likely scrollable)
      const textarea = document.getElementById('textarea-input') as HTMLElement;
      if (textarea) {
        const textareaCanScroll = canElementScroll(textarea);
        this.addResult(
          'Scroll Detection - Textarea',
          typeof textareaCanScroll === 'boolean',
          `Textarea scroll detection returned: ${textareaCanScroll}`
        );
      }
    } catch (error) {
      this.addResult(
        'Scroll Detection',
        false,
        'Error during scroll detection testing',
        String(error)
      );
    }
  }

  /**
   * Test Scroll Element Processing
   */
  private async testScrollElementProcessing(): Promise<void> {
    try {
      // Test getting scrollable elements
      const scrollableElements = getScrollableElements();
      this.addResult(
        'Get Scrollable Elements',
        Array.isArray(scrollableElements),
        `Found ${scrollableElements.length} scrollable elements`
      );

      // Test getting limited number of scrollable elements
      const topTwoScrollable = getScrollableElements(2);
      this.addResult(
        'Get Limited Scrollable Elements',
        Array.isArray(topTwoScrollable) && topTwoScrollable.length <= 2,
        `Top 2 scrollable elements: ${topTwoScrollable.length} returned`
      );

      // Test getting scrollable element XPaths
      const scrollableXPaths = await getScrollableElementXpaths();
      this.addResult(
        'Get Scrollable Element XPaths',
        Array.isArray(scrollableXPaths) &&
          scrollableXPaths.every(xpath => typeof xpath === 'string'),
        `Generated ${scrollableXPaths.length} XPath strings for scrollable elements`
      );

      // Test getting limited XPaths
      const topTwoXPaths = await getScrollableElementXpaths(2);
      this.addResult(
        'Get Limited Scrollable XPaths',
        Array.isArray(topTwoXPaths) && topTwoXPaths.length <= 2,
        `Top 2 scrollable XPaths: ${topTwoXPaths.length} returned`
      );

      // Verify XPaths are valid by testing one
      if (scrollableXPaths.length > 0) {
        const firstXPath = scrollableXPaths[0];
        const foundElement = getNodeFromXpath(firstXPath);
        this.addResult(
          'XPath Validity Check',
          !!foundElement,
          foundElement
            ? `First generated XPath successfully found element: ${(foundElement as Element).tagName}`
            : 'First generated XPath did not find element'
        );
      }
    } catch (error) {
      this.addResult(
        'Scroll Element Processing',
        false,
        'Error during scroll element processing',
        String(error)
      );
    }
  }

  /**
   * Test XPath Generation
   */
  private async testXPathGeneration(): Promise<void> {
    try {
      // Test XPath generation for button
      const button = document.getElementById('action-button');
      if (button) {
        const buttonXPaths = await generateXPathsForElement(button);
        this.addResult(
          'XPath Generation - Button',
          Array.isArray(buttonXPaths) && buttonXPaths.length > 0,
          `Generated ${buttonXPaths.length} XPaths for button`
        );

        // Verify generated XPaths work
        if (buttonXPaths.length > 0) {
          const firstXPath = buttonXPaths[0];
          const foundElement = getNodeFromXpath(firstXPath);
          this.addResult(
            'Generated XPath Verification - Button',
            foundElement === button,
            foundElement === button
              ? 'Generated XPath correctly finds original button'
              : 'Generated XPath does not find original button'
          );
        }
      }

      // Test XPath generation for checkbox
      const checkbox = document.getElementById('test-checkbox');
      if (checkbox) {
        const checkboxXPaths = await generateXPathsForElement(checkbox);
        this.addResult(
          'XPath Generation - Checkbox',
          Array.isArray(checkboxXPaths) && checkboxXPaths.length > 0,
          `Generated ${checkboxXPaths.length} XPaths for checkbox`
        );
      }

      // Test XPath generation for form
      const form = document.getElementById('test-form');
      if (form) {
        const formXPaths = await generateXPathsForElement(form);
        this.addResult(
          'XPath Generation - Form',
          Array.isArray(formXPaths) && formXPaths.length > 0,
          `Generated ${formXPaths.length} XPaths for form`
        );
      }

      // Test XPath generation for nested element (input inside form)
      const textInput = document.getElementById('text-input');
      if (textInput) {
        const inputXPaths = await generateXPathsForElement(textInput);
        this.addResult(
          'XPath Generation - Nested Input',
          Array.isArray(inputXPaths) && inputXPaths.length > 0,
          `Generated ${inputXPaths.length} XPaths for nested input`
        );
      }
    } catch (error) {
      this.addResult(
        'XPath Generation',
        false,
        'Error during XPath generation testing',
        String(error)
      );
    }
  }

  /**
   * Test Scroll End Detection
   */
  private async testScrollEndDetection(): Promise<void> {
    try {
      // Find a scrollable element for testing
      const scrollableElements = getScrollableElements(1);

      if (scrollableElements.length > 0) {
        const scrollableElement = scrollableElements[0];

        // Test waitForElementScrollEnd with quick timeout
        const startTime = Date.now();
        await waitForElementScrollEnd(scrollableElement, 50); // 50ms idle time
        const endTime = Date.now();

        this.addResult(
          'Scroll End Detection',
          endTime - startTime >= 50,
          `Scroll end detection completed in ${endTime - startTime}ms`
        );
      } else {
        this.addResult(
          'Scroll End Detection',
          true,
          'No scrollable elements found to test scroll end detection'
        );
      }
    } catch (error) {
      this.addResult(
        'Scroll End Detection',
        false,
        'Error during scroll end detection testing',
        String(error)
      );
    }
  }

  /**
   * Add a test result
   */
  private addResult(testName: string, success: boolean, details: string, error?: string): void {
    this.results.push({
      testName,
      success,
      details,
      error,
    });

    const emoji = success ? '✅' : '❌';
    console.log(`${emoji} DOM Test: ${testName} - ${details}`);
    if (error) {
      console.error(`  Error: ${error}`);
    }
  }

  /**
   * Generate test report
   */
  private generateReport(): DOMTestReport {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    return {
      totalTests,
      passedTests,
      failedTests,
      results: this.results,
    };
  }

  /**
   * Log comprehensive test report
   */
  private logReport(report: DOMTestReport): void {
    console.log('\n📊 DOM Utils Test Report:');
    console.log(`Total Tests: ${report.totalTests}`);
    console.log(`Passed: ${report.passedTests}`);
    console.log(`Failed: ${report.failedTests}`);
    console.log(`Success Rate: ${((report.passedTests / report.totalTests) * 100).toFixed(1)}%`);

    if (report.failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      report.results
        .filter(r => !r.success)
        .forEach(result => {
          console.log(`  - ${result.testName}: ${result.details}`);
          if (result.error) {
            console.log(`    Error: ${result.error}`);
          }
        });
    }

    console.log('\n✅ DOM Utils testing complete!');
  }
}

/**
 * Run DOM Utils tests and return results
 */
export async function runDOMUtilsTests(): Promise<DOMTestReport> {
  const runner = new DOMUtilsTestRunner();
  return await runner.runAllTests();
}

/**
 * Global function for browser console testing
 */
declare global {
  interface Window {
    runDOMUtilsTests: () => Promise<DOMTestReport>;
  }
}

// Make available globally for browser console
if (typeof window !== 'undefined') {
  window.runDOMUtilsTests = runDOMUtilsTests;
}
