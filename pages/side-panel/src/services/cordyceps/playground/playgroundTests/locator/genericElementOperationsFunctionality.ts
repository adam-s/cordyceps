import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import { TestContext } from '../api';

/**
 * Test the generic element operation system functionality
 * This tests the new executeFunction method on ElementHandle and Locator
 * as well as the underlying function registry system.
 *
 * Tests covered:
 * 1. Function registration in content script
 * 2. ElementHandle.executeFunction() with no arguments
 * 3. Locator.executeFunction() with typed arguments
 * 4. Complex calculation functions
 * 5. Style manipulation functions
 * 6. Form validation with complex rules
 * 7. Error handling for non-existent functions
 * 8. Function registry information
 * 9. Error handling for functions that throw
 */
export async function testGenericElementOperationsFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting generic element operations functionality tests',
    });

    // First, we need to register some test functions in the content script
    progress.log('Registering test element functions in content script');

    await page.evaluate(() => {
      const injectedScript = window.__cordyceps_handledInjectedScript;
      if (!injectedScript) {
        throw new Error('Cordyceps injected script not found');
      }

      // Register test functions that we can use for testing

      // Simple function with no arguments
      injectedScript.registerElementFunction(
        'getElementInfo',
        (element: Element) => {
          return {
            tagName: element.tagName,
            id: element.id,
            className: element.className,
            textLength: element.textContent?.length || 0,
          };
        },
        'Get basic element information'
      );

      // Function with typed arguments
      injectedScript.registerElementFunction(
        'setCustomAttribute',
        (element: Element, args?: { name: string; value: string }) => {
          if (!args) {
            throw new Error('setCustomAttribute requires args with name and value');
          }
          element.setAttribute(args.name, args.value);
          return { success: true, attribute: args.name, value: args.value };
        },
        'Set a custom attribute on the element'
      );

      // Function that returns a calculated value
      injectedScript.registerElementFunction(
        'calculateElementArea',
        (element: Element) => {
          const rect = element.getBoundingClientRect();
          return {
            width: rect.width,
            height: rect.height,
            area: rect.width * rect.height,
          };
        },
        'Calculate the visible area of an element'
      );

      // Function that modifies element styling
      injectedScript.registerElementFunction(
        'setTemporaryStyle',
        (element: Element, args?: { property: string; value: string; duration: number }) => {
          if (!args) {
            throw new Error('setTemporaryStyle requires args with property, value, and duration');
          }
          const htmlElement = element as HTMLElement;
          const originalValue = htmlElement.style.getPropertyValue(args.property);
          htmlElement.style.setProperty(args.property, args.value);

          // Reset after duration
          setTimeout(() => {
            htmlElement.style.setProperty(args.property, originalValue);
          }, args.duration);

          return {
            success: true,
            property: args.property,
            newValue: args.value,
            originalValue,
          };
        },
        'Temporarily set a CSS style property'
      );

      // Function that works with form elements
      injectedScript.registerElementFunction(
        'validateFormField',
        (
          element: Element,
          args?: { rules: { required?: boolean; minLength?: number; pattern?: string } }
        ) => {
          if (!args) {
            throw new Error('validateFormField requires args with rules');
          }
          const input = element as HTMLInputElement;
          const value = input.value;
          const errors: string[] = [];

          if (args.rules.required && !value.trim()) {
            errors.push('Field is required');
          }

          if (args.rules.minLength && value.length < args.rules.minLength) {
            errors.push(`Minimum length is ${args.rules.minLength}`);
          }

          if (args.rules.pattern) {
            const regex = new RegExp(args.rules.pattern);
            if (!regex.test(value)) {
              errors.push('Value does not match required pattern');
            }
          }

          return {
            isValid: errors.length === 0,
            errors,
            value,
            fieldName: input.name || input.id,
          };
        },
        'Validate form field according to rules'
      );

      console.log('✅ Test element functions registered successfully');
    });

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test element functions registered in content script',
    });

    // Test 1: ElementHandle.executeFunction() with no arguments
    progress.log('Test 1: ElementHandle.executeFunction() - getElementInfo on action button');

    const actionButtonHandle = await page.locator('#action-button').elementHandle();

    interface ElementInfo {
      tagName: string;
      id: string;
      className: string;
      textLength: number;
    }

    const elementInfo = await actionButtonHandle.executeFunction<void, ElementInfo>(
      'getElementInfo'
    );

    progress.log(`Element info: ${JSON.stringify(elementInfo)}`);

    if (elementInfo.tagName !== 'BUTTON' || elementInfo.id !== 'action-button') {
      throw new Error(
        `Test 1 failed: Expected BUTTON with id 'action-button', got ${elementInfo.tagName} with id '${elementInfo.id}'`
      );
    }

    actionButtonHandle.dispose();

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 1 passed: ElementHandle.executeFunction() with no arguments',
      details: { elementInfo },
    });

    // Test 2: Locator.executeFunction() with typed arguments
    progress.log('Test 2: Locator.executeFunction() - setCustomAttribute');

    const testInput = page.locator('#text-input');

    interface AttributeArgs {
      name: string;
      value: string;
    }

    interface AttributeResult {
      success: boolean;
      attribute: string;
      value: string;
    }

    const attributeResult = await testInput.executeFunction<AttributeArgs, AttributeResult>(
      'setCustomAttribute',
      { name: 'data-test-id', value: 'generic-ops-test' }
    );

    if (!attributeResult.success || attributeResult.attribute !== 'data-test-id') {
      throw new Error(
        `Test 2 failed: Expected successful attribute setting, got ${JSON.stringify(attributeResult)}`
      );
    }

    // Verify the attribute was actually set
    const actualAttribute = await testInput.getAttribute('data-test-id');
    if (actualAttribute !== 'generic-ops-test') {
      throw new Error(
        `Test 2 failed: Attribute not set correctly. Expected 'generic-ops-test', got '${actualAttribute}'`
      );
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 2 passed: Locator.executeFunction() with typed arguments',
      details: { attributeResult, actualAttribute },
    });

    // Test 3: Complex calculation function
    progress.log('Test 3: ElementHandle.executeFunction() - calculateElementArea');

    const containerHandle = await page.locator('.container').first().elementHandle();

    interface AreaResult {
      width: number;
      height: number;
      area: number;
    }

    const areaResult = await containerHandle.executeFunction<void, AreaResult>(
      'calculateElementArea'
    );

    if (
      areaResult.width <= 0 ||
      areaResult.height <= 0 ||
      areaResult.area !== areaResult.width * areaResult.height
    ) {
      throw new Error(`Test 3 failed: Invalid area calculation ${JSON.stringify(areaResult)}`);
    }

    containerHandle.dispose();

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 3 passed: Complex calculation function',
      details: { areaResult },
    });

    // Test 4: Style manipulation function
    progress.log('Test 4: Locator.executeFunction() - setTemporaryStyle');

    const highlightButton = page.locator('#action-button');

    interface StyleArgs {
      property: string;
      value: string;
      duration: number;
    }

    interface StyleResult {
      success: boolean;
      property: string;
      newValue: string;
      originalValue: string;
    }

    const styleResult = await highlightButton.executeFunction<StyleArgs, StyleResult>(
      'setTemporaryStyle',
      { property: 'background-color', value: 'yellow', duration: 1000 }
    );

    if (!styleResult.success || styleResult.property !== 'background-color') {
      throw new Error(`Test 4 failed: Style setting failed ${JSON.stringify(styleResult)}`);
    }

    // Give a moment for the style to be applied and visible
    await new Promise(resolve => setTimeout(resolve, 500));

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 4 passed: Style manipulation function',
      details: { styleResult },
    });

    // Test 5: Form validation function
    progress.log('Test 5: Locator.executeFunction() - validateFormField');

    const emailInput = page.locator('#email-input');

    // First set a test value
    await emailInput.fill('test@example.com');

    interface ValidationRules {
      rules: {
        required?: boolean;
        minLength?: number;
        pattern?: string;
      };
    }

    interface ValidationResult {
      isValid: boolean;
      errors: string[];
      value: string;
      fieldName: string;
    }

    const validationResult = await emailInput.executeFunction<ValidationRules, ValidationResult>(
      'validateFormField',
      {
        rules: {
          required: true,
          minLength: 5,
          pattern: '^[^@]+@[^@]+\\.[^@]+$', // Simple email pattern
        },
      }
    );

    if (!validationResult.isValid || validationResult.errors.length > 0) {
      throw new Error(
        `Test 5 failed: Valid email should pass validation ${JSON.stringify(validationResult)}`
      );
    }

    // Test with invalid email
    await emailInput.fill('invalid');

    const invalidValidationResult = await emailInput.executeFunction<
      ValidationRules,
      ValidationResult
    >('validateFormField', {
      rules: {
        required: true,
        minLength: 5,
        pattern: '^[^@]+@[^@]+\\.[^@]+$',
      },
    });

    if (invalidValidationResult.isValid || invalidValidationResult.errors.length === 0) {
      throw new Error(
        `Test 5 failed: Invalid email should fail validation ${JSON.stringify(invalidValidationResult)}`
      );
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 5 passed: Form validation function',
      details: { validResult: validationResult, invalidResult: invalidValidationResult },
    });

    // Test 6: Error handling for non-existent function
    progress.log('Test 6: Error handling for non-existent function');

    try {
      await testInput.executeFunction('nonExistentFunction');
      throw new Error('Test 6 failed: Should have thrown error for non-existent function');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('nonExistentFunction')) {
        throw new Error(`Test 6 failed: Wrong error message: ${errorMessage}`);
      }
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 6 passed: Proper error handling for non-existent function',
    });

    // Test 7: Function registry information
    progress.log('Test 7: Function registry information');

    const registeredFunctions = await page.evaluate(() => {
      const injectedScript = window.__cordyceps_handledInjectedScript;
      return injectedScript ? injectedScript.getRegisteredElementFunctions() : [];
    });

    progress.log(`Registered functions: ${JSON.stringify(registeredFunctions)}`);

    const expectedFunctions = [
      'getElementInfo',
      'setCustomAttribute',
      'calculateElementArea',
      'setTemporaryStyle',
      'validateFormField',
    ];

    for (const expectedFunction of expectedFunctions) {
      if (!registeredFunctions.includes(expectedFunction)) {
        throw new Error(
          `Test 7 failed: Expected function '${expectedFunction}' not found in registry`
        );
      }
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 7 passed: Function registry working correctly',
      details: { registeredFunctions },
    });

    // Test 8: Error handling for function that throws
    progress.log('Test 8: Error handling for function that throws');

    // Register a function that throws an error
    await page.evaluate(() => {
      const injectedScript = window.__cordyceps_handledInjectedScript;
      if (injectedScript) {
        injectedScript.registerElementFunction(
          'throwingFunction',
          (_element: Element) => {
            throw new Error('This function always throws');
          },
          'A function that throws an error for testing'
        );
      }
    });

    try {
      await testInput.executeFunction('throwingFunction');
      throw new Error('Test 8 failed: Should have thrown an error');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('This function always throws')) {
        throw new Error(`Test 8 failed: Wrong error message: ${errorMessage}`);
      }
      progress.log(`Expected error caught: ${errorMessage}`);
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 8 passed: Error handling for throwing functions working correctly',
    });

    // Clean up - remove test attributes and reset form
    progress.log('Cleaning up test artifacts');

    await testInput.setAttribute('data-test-id', ''); // Clear the attribute
    await emailInput.fill('');

    progress.log('All generic element operations functionality tests completed successfully');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'All generic element operations functionality tests completed successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Generic element operations functionality test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Generic element operations functionality tests failed',
      details: { error: errorMessage },
    });

    throw error;
  }
}
