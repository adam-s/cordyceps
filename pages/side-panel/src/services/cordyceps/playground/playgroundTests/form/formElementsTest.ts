import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import type { TestContext } from '../api';

/**
 * Test comprehensive form elements functionality
 * Tests various input types, select elements, textareas, etc.
 */
export async function testFormElements(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  progress.log('Testing comprehensive form elements');

  try {
    // First, inject a comprehensive form into the page for testing
    await injectTestForm(page, progress);

    // Test text inputs
    await testTextInputs(page, progress, context);

    // Test checkboxes and radio buttons
    await testCheckboxesAndRadios(page, progress, context);

    // Test select elements
    await testSelectElements(page, progress, context);

    // Test textarea
    await testTextarea(page, progress, context);

    // Test buttons
    await testButtons(page, progress, context);

    // Test specialized inputs
    await testSpecializedInputs(page, progress, context);

    progress.log('All form elements tests completed successfully');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Form elements tests passed',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Form elements test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Form elements test failed',
      details: { error: errorMessage },
    });

    throw error;
  }
}

/**
 * Inject a comprehensive test form into the page
 */
async function injectTestForm(page: Page, progress: Progress): Promise<void> {
  progress.log('Injecting comprehensive test form');

  await page.evaluate(() => {
    // Remove existing test form if present
    const existingForm = document.getElementById('cordyceps-test-form');
    if (existingForm) {
      existingForm.remove();
    }

    // Create comprehensive test form
    const formHTML = `
      <div id="cordyceps-test-form" style="padding: 20px; border: 2px solid #333; margin: 20px; background: #f5f5f5;">
        <h2>Cordyceps Form Testing Suite</h2>
        
        <form id="test-form" style="display: grid; gap: 15px; max-width: 600px;">
          
          <!-- Text Inputs Section -->
          <fieldset style="padding: 10px; border: 1px solid #666;">
            <legend><strong>Text Inputs</strong></legend>
            
            <div style="display: grid; gap: 10px;">
              <div>
                <label for="text-input">Text Input:</label>
                <input type="text" id="text-input" name="text-input" placeholder="Enter text here" />
              </div>
              
              <div>
                <label for="password-input">Password Input:</label>
                <input type="password" id="password-input" name="password-input" placeholder="Enter password" />
              </div>
              
              <div>
                <label for="email-input">Email Input:</label>
                <input type="email" id="email-input" name="email-input" placeholder="Enter email" />
              </div>
              
              <div>
                <label for="number-input">Number Input:</label>
                <input type="number" id="number-input" name="number-input" placeholder="Enter number" min="0" max="100" />
              </div>
              
              <div>
                <label for="search-input">Search Input:</label>
                <input type="search" id="search-input" name="search-input" placeholder="Search..." />
              </div>
              
              <div>
                <label for="url-input">URL Input:</label>
                <input type="url" id="url-input" name="url-input" placeholder="https://example.com" />
              </div>
              
              <div>
                <label for="tel-input">Tel Input:</label>
                <input type="tel" id="tel-input" name="tel-input" placeholder="(123) 456-7890" />
              </div>
            </div>
          </fieldset>

          <!-- Date/Time Inputs Section -->
          <fieldset style="padding: 10px; border: 1px solid #666;">
            <legend><strong>Date/Time Inputs</strong></legend>
            
            <div style="display: grid; gap: 10px;">
              <div>
                <label for="date-input">Date Input:</label>
                <input type="date" id="date-input" name="date-input" />
              </div>
              
              <div>
                <label for="time-input">Time Input:</label>
                <input type="time" id="time-input" name="time-input" />
              </div>
              
              <div>
                <label for="datetime-input">Datetime-local Input:</label>
                <input type="datetime-local" id="datetime-input" name="datetime-input" />
              </div>
              
              <div>
                <label for="month-input">Month Input:</label>
                <input type="month" id="month-input" name="month-input" />
              </div>
              
              <div>
                <label for="week-input">Week Input:</label>
                <input type="week" id="week-input" name="week-input" />
              </div>
            </div>
          </fieldset>

          <!-- Checkboxes and Radio Buttons Section -->
          <fieldset style="padding: 10px; border: 1px solid #666;">
            <legend><strong>Checkboxes and Radio Buttons</strong></legend>
            
            <div style="display: grid; gap: 10px;">
              <div>
                <h4>Checkboxes:</h4>
                <label><input type="checkbox" id="checkbox-1" name="features" value="feature1" /> Feature 1</label><br>
                <label><input type="checkbox" id="checkbox-2" name="features" value="feature2" /> Feature 2</label><br>
                <label><input type="checkbox" id="checkbox-3" name="features" value="feature3" checked /> Feature 3 (pre-checked)</label>
              </div>
              
              <div>
                <h4>Radio Buttons:</h4>
                <label><input type="radio" id="radio-1" name="size" value="small" /> Small</label><br>
                <label><input type="radio" id="radio-2" name="size" value="medium" checked /> Medium (pre-selected)</label><br>
                <label><input type="radio" id="radio-3" name="size" value="large" /> Large</label>
              </div>
            </div>
          </fieldset>

          <!-- Select Elements Section -->
          <fieldset style="padding: 10px; border: 1px solid #666;">
            <legend><strong>Select Elements</strong></legend>
            
            <div style="display: grid; gap: 10px;">
              <div>
                <label for="single-select">Single Select:</label>
                <select id="single-select" name="single-select">
                  <option value="">-- Please choose an option --</option>
                  <option value="option1">Option 1</option>
                  <option value="option2" selected>Option 2 (pre-selected)</option>
                  <option value="option3">Option 3</option>
                </select>
              </div>
              
              <div>
                <label for="multiple-select">Multiple Select:</label>
                <select id="multiple-select" name="multiple-select" multiple size="4">
                  <option value="item1" selected>Item 1 (pre-selected)</option>
                  <option value="item2">Item 2</option>
                  <option value="item3" selected>Item 3 (pre-selected)</option>
                  <option value="item4">Item 4</option>
                </select>
              </div>
            </div>
          </fieldset>

          <!-- Textarea Section -->
          <fieldset style="padding: 10px; border: 1px solid #666;">
            <legend><strong>Textarea</strong></legend>
            
            <div>
              <label for="textarea-input">Textarea:</label><br>
              <textarea id="textarea-input" name="textarea-input" rows="4" cols="50" placeholder="Enter multiple lines of text here...">Pre-filled content in textarea</textarea>
            </div>
          </fieldset>

          <!-- Range and File Inputs Section -->
          <fieldset style="padding: 10px; border: 1px solid #666;">
            <legend><strong>Range and File Inputs</strong></legend>
            
            <div style="display: grid; gap: 10px;">
              <div>
                <label for="range-input">Range Input:</label>
                <input type="range" id="range-input" name="range-input" min="0" max="100" value="50" />
                <span id="range-value">50</span>
              </div>
              
              <div>
                <label for="file-input">File Input:</label>
                <input type="file" id="file-input" name="file-input" accept=".txt,.pdf,.jpg,.png" />
              </div>
              
              <div>
                <label for="color-input">Color Input:</label>
                <input type="color" id="color-input" name="color-input" value="#ff6600" />
              </div>
            </div>
          </fieldset>

          <!-- Hidden and Disabled Elements -->
          <fieldset style="padding: 10px; border: 1px solid #666;">
            <legend><strong>Hidden and Disabled Elements</strong></legend>
            
            <div style="display: grid; gap: 10px;">
              <input type="hidden" id="hidden-input" name="hidden-input" value="hidden-value" />
              
              <div>
                <label for="disabled-input">Disabled Input:</label>
                <input type="text" id="disabled-input" name="disabled-input" value="Cannot edit this" disabled />
              </div>
              
              <div>
                <label for="readonly-input">Readonly Input:</label>
                <input type="text" id="readonly-input" name="readonly-input" value="Cannot edit this either" readonly />
              </div>
            </div>
          </fieldset>

          <!-- Buttons Section -->
          <fieldset style="padding: 10px; border: 1px solid #666;">
            <legend><strong>Buttons</strong></legend>
            
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              <button type="button" id="regular-button">Regular Button</button>
              <button type="submit" id="submit-button">Submit Button</button>
              <button type="reset" id="reset-button">Reset Button</button>
              <input type="button" id="input-button" value="Input Button" />
              <input type="submit" id="input-submit" value="Input Submit" />
              <input type="reset" id="input-reset" value="Input Reset" />
            </div>
          </fieldset>

        </form>
      </div>
    `;

    // Insert the form into the page
    document.body.insertAdjacentHTML('beforeend', formHTML);

    // Add event listener for range input to update display
    const rangeInput = document.getElementById('range-input') as HTMLInputElement;
    const rangeValue = document.getElementById('range-value');
    if (rangeInput && rangeValue) {
      rangeInput.addEventListener('input', () => {
        rangeValue.textContent = rangeInput.value;
      });
    }

    return true;
  });

  progress.log('Test form injected successfully');
}

/**
 * Test text input functionality
 */
async function testTextInputs(page: Page, progress: Progress, context: TestContext): Promise<void> {
  progress.log('Testing text inputs');

  // Test text input
  const textInput = page.locator('#text-input');
  await textInput.first().setValue('Test text value');
  const textValue = await textInput.first().getValue();

  if (textValue !== 'Test text value') {
    throw new Error(`Text input failed: expected "Test text value", got "${textValue}"`);
  }

  // Test email input
  const emailInput = page.locator('#email-input');
  await emailInput.first().setValue('test@example.com');
  const emailValue = await emailInput.first().getValue();

  if (emailValue !== 'test@example.com') {
    throw new Error(`Email input failed: expected "test@example.com", got "${emailValue}"`);
  }

  // Test number input
  const numberInput = page.locator('#number-input');
  await numberInput.setValue('42');
  const numberValue = await numberInput.getValue();

  if (numberValue !== '42') {
    throw new Error(`Number input failed: expected "42", got "${numberValue}"`);
  }

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Success,
    message: 'Text inputs test passed',
    details: { textValue, emailValue, numberValue },
  });
}

/**
 * Test checkboxes and radio buttons
 */
async function testCheckboxesAndRadios(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  progress.log('Testing checkboxes and radio buttons');

  // Test checkbox checking/unchecking
  const checkbox1 = page.locator('#checkbox-1');
  await checkbox1.check();
  const isChecked1 = await checkbox1.isChecked();

  if (!isChecked1) {
    throw new Error('Checkbox check failed');
  }

  await checkbox1.uncheck();
  const isUnchecked1 = await checkbox1.isChecked();

  if (isUnchecked1) {
    throw new Error('Checkbox uncheck failed');
  }

  // Test radio button selection
  const radio1 = page.locator('#radio-1');
  await radio1.check();
  const radioChecked = await radio1.isChecked();

  if (!radioChecked) {
    throw new Error('Radio button check failed');
  }

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Success,
    message: 'Checkboxes and radio buttons test passed',
  });
}

/**
 * Test select elements
 */
async function testSelectElements(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  progress.log('Testing select elements');

  // Test single select
  const singleSelect = page.locator('#single-select');
  await singleSelect.setValue('option3');
  const selectedValue = await singleSelect.getValue();

  if (selectedValue !== 'option3') {
    throw new Error(`Select option failed: expected "option3", got "${selectedValue}"`);
  }

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Success,
    message: 'Select elements test passed',
    details: { selectedValue },
  });
}

/**
 * Test textarea functionality
 */
async function testTextarea(page: Page, progress: Progress, context: TestContext): Promise<void> {
  progress.log('Testing textarea');

  const textarea = page.locator('#textarea-input');
  await textarea.setValue('New textarea content\nWith multiple lines\nAnd more text');
  const textareaValue = await textarea.getValue();

  if (!textareaValue.includes('New textarea content')) {
    throw new Error(`Textarea fill failed: expected content not found in "${textareaValue}"`);
  }

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Success,
    message: 'Textarea test passed',
    details: { textareaValue },
  });
}

/**
 * Test button functionality
 */
async function testButtons(page: Page, progress: Progress, context: TestContext): Promise<void> {
  progress.log('Testing buttons');

  // Test button click
  const regularButton = page.locator('#regular-button');
  await regularButton.click();

  // Test input button click
  const inputButton = page.locator('#input-button');
  await inputButton.click();

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Success,
    message: 'Buttons test passed',
  });
}

/**
 * Test specialized input types
 */
async function testSpecializedInputs(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  progress.log('Testing specialized inputs');

  // Test range input
  const rangeInput = page.locator('#range-input');
  await rangeInput.fill('75');
  const rangeValue = await rangeInput.getValue();

  if (rangeValue !== '75') {
    throw new Error(`Range input failed: expected "75", got "${rangeValue}"`);
  }

  // Test color input
  const colorInput = page.locator('#color-input');
  await colorInput.fill('#00ff00');
  const colorValue = await colorInput.getValue();

  if (colorValue !== '#00ff00') {
    throw new Error(`Color input failed: expected "#00ff00", got "${colorValue}"`);
  }

  // Test date input
  const dateInput = page.locator('#date-input');
  await dateInput.fill('2024-12-25');
  const dateValue = await dateInput.getValue();

  if (dateValue !== '2024-12-25') {
    throw new Error(`Date input failed: expected "2024-12-25", got "${dateValue}"`);
  }

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Success,
    message: 'Specialized inputs test passed',
    details: { rangeValue, colorValue, dateValue },
  });
}
