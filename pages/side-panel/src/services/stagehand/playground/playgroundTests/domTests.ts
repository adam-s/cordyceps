import { isElementNode, isTextNode } from '../../lib/dom/elementCheckUtils';
import { canElementScroll, getNodeFromXpath, waitForElementScrollEnd } from '../../lib/dom/utils';
import { generateXPathsForElement, escapeXPathString } from '../../lib/dom/xpathUtils';
import { getScrollableElements, getScrollableElementXpaths } from '../../lib/dom/process';

interface DomTestResult {
  testName: string;
  passed: boolean;
  error?: string;
  details?: string;
}

function createTestDomStructure(): HTMLElement {
  const container = document.createElement('div');
  container.id = 'test-container';
  container.innerHTML = `
		<div id="scrollable-parent" style="height: 200px; overflow-y: auto;">
			<div style="height: 500px; padding: 20px;">
				<h1 id="test-heading" data-qa="main-heading" role="heading">Test Heading</h1>
				<p id="test-paragraph" class="content-text">This is a test paragraph with some content.</p>
				<button id="test-button" type="submit" aria-label="Submit Form" data-component="form-button">
					Submit
				</button>
				<input id="test-input" type="text" name="username" placeholder="Enter username" />
				<div id="nested-container">
					<span id="nested-span" data-role="status">Status Text</span>
					<a id="test-link" href="https://example.com" title="Example Link">Example</a>
				</div>
			</div>
		</div>
		<div id="non-scrollable" style="height: 100px;">
			<p>Non-scrollable content</p>
		</div>
	`;
  document.body.appendChild(container);
  return container;
}

function cleanupTestDom(): void {
  const container = document.getElementById('test-container');
  if (container) {
    container.remove();
  }
}

async function testElementCheckUtils(): Promise<DomTestResult[]> {
  const results: DomTestResult[] = [];
  try {
    const div = document.createElement('div');
    const textNode = document.createTextNode('Test text');
    const emptyTextNode = document.createTextNode('   ');
    const commentNode = document.createComment('Test comment');
    results.push({
      testName: 'isElementNode - Element',
      passed: isElementNode(div) === true,
      details: 'Should return true for Element nodes',
    });
    results.push({
      testName: 'isElementNode - Text Node',
      passed: isElementNode(textNode) === false,
      details: 'Should return false for Text nodes',
    });
    results.push({
      testName: 'isElementNode - Comment Node',
      passed: isElementNode(commentNode) === false,
      details: 'Should return false for Comment nodes',
    });
    results.push({
      testName: 'isTextNode - Text Node',
      passed: isTextNode(textNode) === true,
      details: 'Should return true for non-empty Text nodes',
    });
    results.push({
      testName: 'isTextNode - Empty Text Node',
      passed: isTextNode(emptyTextNode) === false,
      details: 'Should return false for empty/whitespace Text nodes',
    });
    results.push({
      testName: 'isTextNode - Element',
      passed: isTextNode(div) === false,
      details: 'Should return false for Element nodes',
    });
  } catch (error) {
    results.push({
      testName: 'elementCheckUtils Error',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return results;
}

async function testUtils(): Promise<DomTestResult[]> {
  const results: DomTestResult[] = [];
  try {
    createTestDomStructure();
    const scrollableElement = document.getElementById('scrollable-parent') as HTMLElement;
    const nonScrollableElement = document.getElementById('non-scrollable') as HTMLElement;
    if (scrollableElement && nonScrollableElement) {
      results.push({
        testName: 'canElementScroll - Scrollable Element',
        passed: canElementScroll(scrollableElement) === true,
        details: 'Should return true for scrollable elements',
      });
      results.push({
        testName: 'canElementScroll - Non-scrollable Element',
        passed: canElementScroll(nonScrollableElement) === false,
        details: 'Should return false for non-scrollable elements',
      });
    }
    const headingXPath = "//h1[@id='test-heading']";
    const foundNode = getNodeFromXpath(headingXPath);
    const expectedNode = document.getElementById('test-heading');
    results.push({
      testName: 'getNodeFromXpath - Valid XPath',
      passed: foundNode === expectedNode,
      details: 'Should return the correct node for valid XPath',
    });
    const invalidXPath = "//nonexistent[@id='missing']";
    const notFoundNode = getNodeFromXpath(invalidXPath);
    results.push({
      testName: 'getNodeFromXpath - Invalid XPath',
      passed: notFoundNode === null,
      details: 'Should return null for non-existent elements',
    });
    if (scrollableElement) {
      const startTime = Date.now();
      const scrollPromise = waitForElementScrollEnd(scrollableElement, 50);
      scrollableElement.scrollTo({ top: 100, behavior: 'instant' });
      await scrollPromise;
      const endTime = Date.now();
      results.push({
        testName: 'waitForElementScrollEnd - Scroll Detection',
        passed: endTime - startTime >= 50 && endTime - startTime < 200,
        details: `Should wait for scroll to end (took ${endTime - startTime}ms)`,
      });
    }
    cleanupTestDom();
  } catch (error) {
    cleanupTestDom();
    results.push({
      testName: 'utils Error',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return results;
}

async function testXpathUtils(): Promise<DomTestResult[]> {
  const results: DomTestResult[] = [];
  try {
    createTestDomStructure();
    const testString = 'text with \'single\' and "double" quotes <>&';
    const escaped = escapeXPathString(testString);
    results.push({
      testName: 'escapeXPathString - Escaping',
      passed:
        typeof escaped === 'string' && (escaped.includes('concat(') || escaped.startsWith("'")),
      details: `Escaped string: ${escaped}`,
    });
    const button = document.getElementById('test-button');
    if (button) {
      const xpaths = await generateXPathsForElement(button);
      results.push({
        testName: 'generateXPathsForElement - Button',
        passed: Array.isArray(xpaths) && xpaths.length > 0,
        details: `Generated ${xpaths.length} XPaths for button`,
      });
      if (xpaths.length > 0) {
        const found = getNodeFromXpath(xpaths[0]);
        results.push({
          testName: 'generateXPathsForElement - XPath Validity',
          passed: found === button,
          details: 'First generated XPath should find the original button',
        });
      }
    }
    cleanupTestDom();
  } catch (error) {
    cleanupTestDom();
    results.push({
      testName: 'xpathUtils Error',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return results;
}

async function testProcess(): Promise<DomTestResult[]> {
  const results: DomTestResult[] = [];
  try {
    createTestDomStructure();
    const scrollableElements = getScrollableElements();
    results.push({
      testName: 'getScrollableElements - Finds Scrollable',
      passed: Array.isArray(scrollableElements) && scrollableElements.length > 0,
      details: `Found ${scrollableElements.length} scrollable elements`,
    });
    const scrollableXpaths = await getScrollableElementXpaths();
    results.push({
      testName: 'getScrollableElementXpaths - Generates XPaths',
      passed:
        scrollableXpaths.length > 0 && scrollableXpaths.every(xpath => typeof xpath === 'string'),
      details: `All returned items should be strings`,
    });
    cleanupTestDom();
  } catch (error) {
    cleanupTestDom();
    results.push({
      testName: 'process Error',
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return results;
}

export async function runDomTests(): Promise<void> {
  console.log('🧪 Running DOM Tests...');
  const allResults: DomTestResult[] = [];
  const elementCheckResults = await testElementCheckUtils();
  const utilsResults = await testUtils();
  const xpathUtilsResults = await testXpathUtils();
  const processResults = await testProcess();
  allResults.push(...elementCheckResults, ...utilsResults, ...xpathUtilsResults, ...processResults);
  const passed = allResults.filter(r => r.passed).length;
  const failed = allResults.filter(r => !r.passed).length;
  const total = allResults.length;
  console.log(`\n📊 DOM Test Results:`);
  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${failed}/${total}`);
  if (failed > 0) {
    console.log(`\n❌ Failed Tests:`);
    allResults
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`  • ${r.testName}`);
        if (r.error) console.log(`    Error: ${r.error}`);
        if (r.details) console.log(`    Details: ${r.details}`);
      });
  }
  console.log(`\nDOM tests completed: ${passed}/${total} passed`);
}
