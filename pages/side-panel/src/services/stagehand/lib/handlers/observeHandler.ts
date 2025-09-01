import { LogLine } from '../../types/log';
import { StagehandFunctionName, ChromeExtensionStagehand } from '../index';
import { observe } from '../inference';
import { LLMClient } from '../llm/LLMClient';
import { trimTrailingTextNode } from '../utils';
import { AccessibilityNode, EncodedId } from '../../types/context';
import { ObserveResult } from '../../types/stagehand';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';
import {
  drawObserveOverlayFunction,
  clearObserveOverlaysFunction,
  countObservableElementsFunction,
  getObservedElementInfoFunction,
  testXPathEvaluationFunction,
  validateOverlayPositioningFunction,
} from './observeHandlerUtils';

// Define element information interface for getObservedElementInfo
interface ElementInfo {
  tagName: string;
  id: string;
  className: string;
  innerText: string;
  boundingRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isVisible: boolean;
}

/**
 * Chrome Extension compatible ObserveHandler using Cordyceps engine
 *
 * This Redux implementation replaces Playwright dependencies with Cordyceps APIs
 * and provides comprehensive element observation capabilities within Chrome extension
 * security constraints.
 */
export class StagehandObserveHandler {
  private readonly stagehand: ChromeExtensionStagehand;
  private readonly logger: (logLine: LogLine) => void;
  private readonly browserWindow: BrowserWindow;
  private readonly experimental: boolean;
  private readonly userProvidedInstructions?: string;

  constructor({
    stagehand,
    logger,
    browserWindow,
    userProvidedInstructions,
    experimental,
  }: {
    stagehand: ChromeExtensionStagehand;
    logger: (logLine: LogLine) => void;
    browserWindow: BrowserWindow;
    userProvidedInstructions?: string;
    experimental: boolean;
  }) {
    this.stagehand = stagehand;
    this.logger = logger;
    this.browserWindow = browserWindow;
    this.userProvidedInstructions = userProvidedInstructions;
    this.experimental = experimental;
  }

  /**
   * Main observe method for finding and highlighting elements on the page
   *
   * @param instruction - Natural language instruction for what to observe
   * @param llmClient - LLM client for processing observation requests
   * @param requestId - Unique identifier for this observation request
   * @param returnAction - Whether to return action suggestions
   * @param onlyVisible - Deprecated parameter, has no effect
   * @param drawOverlay - Whether to draw visual overlays on found elements
   * @param fromAct - Whether this observation is called from an act operation
   * @param iframes - Whether to include iframe content in observation
   */
  public async observe({
    instruction,
    llmClient,
    requestId,
    returnAction,
    onlyVisible,
    drawOverlay,
    fromAct,
    iframes,
  }: {
    instruction: string;
    llmClient: LLMClient;
    requestId: string;
    domSettleTimeoutMs?: number;
    returnAction?: boolean;
    /**
     * @deprecated The `onlyVisible` parameter has no effect in this version of Stagehand and will be removed in later versions.
     */
    onlyVisible?: boolean;
    drawOverlay?: boolean;
    fromAct?: boolean;
    iframes?: boolean;
  }): Promise<ObserveResult[]> {
    console.log(
      `[StagehandObserveHandler.observe] starting observation with instruction="${instruction}" requestId=${requestId} ######`
    );
    // Default instruction if none provided
    if (!instruction) {
      instruction = `Find elements that can be used for any future actions in the page. These may be navigation links, related pages, section/subsection links, buttons, or other interactive elements. Be comprehensive: if there are multiple elements that may be relevant for future actions, return all of them.`;
      console.log(`[StagehandObserveHandler.observe] using default instruction ######`);
    }

    this.logger({
      category: 'observation',
      message: 'starting observation',
      level: 1,
      auxiliary: {
        instruction: {
          value: instruction,
          type: 'string',
        },
      },
    });

    // Warn about deprecated parameter
    if (onlyVisible !== undefined) {
      console.warn(
        `[StagehandObserveHandler.observe] 'onlyVisible' parameter is deprecated ######`
      );
      this.logger({
        category: 'observation',
        message:
          'Warning: the `onlyVisible` parameter has no effect in this version of Stagehand and will be removed in future versions.',
        level: 1,
      });
    }

    // Wait for DOM to settle using Cordyceps
    console.log(`[StagehandObserveHandler.observe] waiting for settled DOM ######`);
    await this._waitForSettledDom();

    this.logger({
      category: 'observation',
      message: 'Getting accessibility tree data',
      level: 1,
    });

    // Get accessibility tree using Cordyceps-compatible methods
    console.log(`[StagehandObserveHandler.observe] getting accessibility data ######`);
    const { combinedTreeString, combinedXpathMap, discoveredIframes } =
      await this._getAccessibilityData(iframes);
    console.log(
      `[StagehandObserveHandler.observe] accessibility data received, tree length=${combinedTreeString.length} ######`
    );

    // Perform observation using LLM
    console.log(`[StagehandObserveHandler.observe] performing LLM observation ######`);
    console.log(
      `[StagehandObserveHandler.observe] calling observe function with parameters: ######`
    );
    console.log(
      `[StagehandObserveHandler.observe] - instruction length: ${instruction.length} ######`
    );
    console.log(
      `[StagehandObserveHandler.observe] - domElements length: ${combinedTreeString.length} ######`
    );
    console.log(`[StagehandObserveHandler.observe] - llmClient type: ${llmClient.type} ######`);
    console.log(`[StagehandObserveHandler.observe] - requestId: ${requestId} ######`);
    console.log(`[StagehandObserveHandler.observe] - returnAction: ${returnAction} ######`);
    console.log(`[StagehandObserveHandler.observe] - fromAct: ${fromAct} ######`);

    let observationResponse: unknown;
    try {
      observationResponse = await observe({
        instruction,
        domElements: combinedTreeString,
        llmClient,
        requestId,
        userProvidedInstructions: this.userProvidedInstructions,
        logger: this.logger,
        returnAction,
        logInferenceToFile: false, // Chrome extension doesn't have file logging
        fromAct: fromAct,
      });
      console.log(
        `[StagehandObserveHandler.observe] LLM observation response received successfully ######`
      );
      console.log(
        `[StagehandObserveHandler.observe] response type: ${typeof observationResponse} ######`
      );
      console.log(
        `[StagehandObserveHandler.observe] response has elements: ${!!(observationResponse as Record<string, unknown>)?.elements} ######`
      );
    } catch (observeError) {
      const err = observeError as Error;
      console.log(
        `[StagehandObserveHandler.observe] ERROR in observe function: ${err.message} ######`
      );
      console.log(`[StagehandObserveHandler.observe] ERROR stack: ${err.stack} ######`);
      throw observeError;
    }

    // Update metrics
    const {
      prompt_tokens = 0,
      completion_tokens = 0,
      inference_time_ms = 0,
    } = (observationResponse || {}) as {
      prompt_tokens?: number;
      completion_tokens?: number;
      inference_time_ms?: number;
    };
    console.log(
      `[StagehandObserveHandler.observe] updating metrics: prompt_tokens=${prompt_tokens}, completion_tokens=${completion_tokens} ######`
    );
    this.stagehand.updateMetrics(
      fromAct ? StagehandFunctionName.ACT : StagehandFunctionName.OBSERVE,
      prompt_tokens,
      completion_tokens,
      inference_time_ms
    );

    // Normalize elements array defensively in case of malformed or undefined responses
    type BaseElement = {
      elementId: string;
      description: string;
      method?: string;
      arguments?: string[];
    };
    const baseElements: Array<BaseElement> = Array.isArray(
      (observationResponse as { elements?: unknown })?.elements
    )
      ? (
          observationResponse as {
            elements: Array<BaseElement>;
          }
        ).elements
      : [];

    // Add iframes to the observation response if there are any on the page
    if (discoveredIframes.length > 0) {
      console.log(
        `[StagehandObserveHandler.observe] found ${discoveredIframes.length} iframes, adding to response ######`
      );
      this.logger({
        category: 'observation',
        message: `Warning: found ${discoveredIframes.length} iframe(s) on the page. If you wish to interact with iframe content, please make sure you are setting iframes: true`,
        level: 1,
      });

      discoveredIframes.forEach(iframe => {
        baseElements.push({
          elementId: this._encodeWithFrameId(undefined, Number(iframe.nodeId)),
          description: 'an iframe',
          method: 'not-supported',
          arguments: [],
        });
      });
    }

    // Process elements and generate selectors
    console.log(`[StagehandObserveHandler.observe] processing observation elements ######`);
    const elementsWithSelectors = await this._processObservationElements(
      baseElements as Array<{
        elementId: string;
        description: string;
        method?: string;
        arguments?: string[];
      }>,
      combinedXpathMap
    );
    console.log(
      `[StagehandObserveHandler.observe] processed ${elementsWithSelectors.length} elements with selectors ######`
    );

    this.logger({
      category: 'observation',
      message: 'found elements',
      level: 1,
      auxiliary: {
        elements: {
          value: JSON.stringify(elementsWithSelectors),
          type: 'object',
        },
      },
    });

    // Draw overlays if requested
    if (drawOverlay) {
      console.log(`[StagehandObserveHandler.observe] drawing overlays ######`);
      await this.drawObserveOverlays(elementsWithSelectors);
    }

    console.log(
      `[StagehandObserveHandler.observe] observation complete, returning ${elementsWithSelectors.length} elements ######`
    );
    return elementsWithSelectors;
  }

  /**
   * Draw visual overlays on observed elements using Redux utilities
   *
   * @param results - Array of observation results with selectors
   */
  public async drawObserveOverlays(results: ObserveResult[]): Promise<void> {
    console.log(
      `[StagehandObserveHandler.drawObserveOverlays] drawing overlays for ${results.length} results ######`
    );
    try {
      const selectors = results.map(result => result.selector);
      const validSelectors = selectors.filter(selector => selector !== 'xpath=');

      if (validSelectors.length === 0) {
        console.log(
          `[StagehandObserveHandler.drawObserveOverlays] no valid selectors, skipping draw ######`
        );
        this.logger({
          category: 'observation',
          message: 'No valid selectors found for overlay drawing',
          level: 1,
        });
        return;
      }

      const page = await this.browserWindow.getCurrentPage();
      await page.evaluate(drawObserveOverlayFunction, validSelectors);
      console.log(
        `[StagehandObserveHandler.drawObserveOverlays] evaluated draw function on page ######`
      );

      this.logger({
        category: 'observation',
        message: `Drew overlays for ${validSelectors.length} elements`,
        level: 1,
      });
    } catch (error) {
      console.error(
        `[StagehandObserveHandler.drawObserveOverlays] error drawing overlays: ${
          error instanceof Error ? error.message : String(error)
        } ######`
      );
      this.logger({
        category: 'observation',
        message: `Failed to draw observe overlays: ${error}`,
        level: 1,
      });
    }
  }

  /**
   * Clear all observe overlays from the page
   */
  public async clearObserveOverlays(): Promise<void> {
    console.log(`[StagehandObserveHandler.clearObserveOverlays] clearing all overlays ######`);
    try {
      const page = await this.browserWindow.getCurrentPage();
      await page.evaluate(clearObserveOverlaysFunction);
      console.log(
        `[StagehandObserveHandler.clearObserveOverlays] evaluated clear function on page ######`
      );

      this.logger({
        category: 'observation',
        message: 'Cleared all observe overlays',
        level: 1,
      });
    } catch (error) {
      console.error(
        `[StagehandObserveHandler.clearObserveOverlays] error clearing overlays: ${
          error instanceof Error ? error.message : String(error)
        } ######`
      );
      this.logger({
        category: 'observation',
        message: `Failed to clear observe overlays: ${error}`,
        level: 1,
      });
    }
  }

  /**
   * Count observable elements on the current page
   */
  public async countObservableElements(): Promise<number> {
    console.log(`[StagehandObserveHandler.countObservableElements] counting elements ######`);
    try {
      const page = await this.browserWindow.getCurrentPage();
      // Use a simple query to get all interactive elements
      const count = await page.evaluate(countObservableElementsFunction, ['*']);
      console.log(
        `[StagehandObserveHandler.countObservableElements] found ${count.foundElements} elements ######`
      );

      this.logger({
        category: 'observation',
        message: `Found ${count.foundElements} observable elements on page`,
        level: 1,
      });

      return count.foundElements;
    } catch (error) {
      console.error(
        `[StagehandObserveHandler.countObservableElements] error counting elements: ${
          error instanceof Error ? error.message : String(error)
        } ######`
      );
      this.logger({
        category: 'observation',
        message: `Failed to count observable elements: ${error}`,
        level: 1,
      });
      return 0;
    }
  }

  /**
   * Get detailed information about observed elements
   */
  public async getObservedElementInfo(selector: string): Promise<ElementInfo | null> {
    console.log(
      `[StagehandObserveHandler.getObservedElementInfo] getting info for selector="${selector}" ######`
    );
    try {
      const page = await this.browserWindow.getCurrentPage();
      const infoArray = await page.evaluate(getObservedElementInfoFunction, [selector]);
      console.log(
        `[StagehandObserveHandler.getObservedElementInfo] received info array from page ######`
      );

      if (infoArray.length === 0) {
        console.log(
          `[StagehandObserveHandler.getObservedElementInfo] info array is empty, returning null ######`
        );
        return null;
      }

      const info = infoArray[0];
      if (!info.found) {
        console.log(
          `[StagehandObserveHandler.getObservedElementInfo] element not found, returning null ######`
        );
        return null;
      }

      // Convert to expected interface format
      const elementInfo: ElementInfo = {
        tagName: info.tagName || '',
        id: info.id || '',
        className: info.className || '',
        innerText: info.textContent || '',
        boundingRect: {
          x: info.boundingBox?.x || 0,
          y: info.boundingBox?.y || 0,
          width: info.boundingBox?.width || 0,
          height: info.boundingBox?.height || 0,
        },
        isVisible: info.visible || false,
      };

      this.logger({
        category: 'observation',
        message: `Retrieved element info for selector: ${selector}`,
        level: 1,
        auxiliary: {
          elementInfo: {
            value: JSON.stringify(elementInfo),
            type: 'object',
          },
        },
      });

      console.log(
        `[StagehandObserveHandler.getObservedElementInfo] returning element info: ${JSON.stringify(
          elementInfo
        )} ######`
      );
      return elementInfo;
    } catch (error) {
      console.error(
        `[StagehandObserveHandler.getObservedElementInfo] error getting element info: ${
          error instanceof Error ? error.message : String(error)
        } ######`
      );
      this.logger({
        category: 'observation',
        message: `Failed to get element info for selector ${selector}: ${error}`,
        level: 1,
      });
      return null;
    }
  }

  /**
   * Test XPath evaluation capabilities
   */
  public async testXPathEvaluation(xpath: string): Promise<boolean> {
    console.log(`[StagehandObserveHandler.testXPathEvaluation] testing xpath="${xpath}" ######`);
    try {
      const page = await this.browserWindow.getCurrentPage();
      const resultsArray = await page.evaluate(testXPathEvaluationFunction, [xpath]);
      console.log(
        `[StagehandObserveHandler.testXPathEvaluation] received results from page ######`
      );

      if (resultsArray.length === 0) {
        console.log(
          `[StagehandObserveHandler.testXPathEvaluation] results array is empty, returning false ######`
        );
        return false;
      }

      const isValid = resultsArray[0].success;

      this.logger({
        category: 'observation',
        message: `XPath evaluation test for "${xpath}": ${isValid ? 'success' : 'failed'}`,
        level: 1,
      });

      console.log(
        `[StagehandObserveHandler.testXPathEvaluation] returning isValid=${isValid} ######`
      );
      return isValid;
    } catch (error) {
      console.error(
        `[StagehandObserveHandler.testXPathEvaluation] error testing xpath: ${
          error instanceof Error ? error.message : String(error)
        } ######`
      );
      this.logger({
        category: 'observation',
        message: `XPath evaluation test failed for "${xpath}": ${error}`,
        level: 1,
      });
      return false;
    }
  }

  /**
   * Validate overlay positioning for elements
   */
  public async validateOverlayPositioning(): Promise<boolean> {
    console.log(
      `[StagehandObserveHandler.validateOverlayPositioning] validating overlay positioning ######`
    );
    try {
      const page = await this.browserWindow.getCurrentPage();
      // Use a basic selector to test overlay positioning
      const resultsArray = await page.evaluate(validateOverlayPositioningFunction, ['body']);
      console.log(
        `[StagehandObserveHandler.validateOverlayPositioning] received results from page ######`
      );

      if (resultsArray.length === 0) {
        console.log(
          `[StagehandObserveHandler.validateOverlayPositioning] results array is empty, returning false ######`
        );
        return false;
      }

      const isValid = resultsArray[0].elementFound && resultsArray[0].overlayCreated;

      this.logger({
        category: 'observation',
        message: `Overlay positioning validation: ${isValid ? 'passed' : 'failed'}`,
        level: 1,
      });

      console.log(
        `[StagehandObserveHandler.validateOverlayPositioning] returning isValid=${isValid} ######`
      );
      return isValid;
    } catch (error) {
      console.error(
        `[StagehandObserveHandler.validateOverlayPositioning] error validating overlay positioning: ${
          error instanceof Error ? error.message : String(error)
        } ######`
      );
      this.logger({
        category: 'observation',
        message: `Overlay positioning validation failed: ${error}`,
        level: 1,
      });
      return false;
    }
  }

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  /**
   * Wait for DOM to settle using Cordyceps
   */
  private async _waitForSettledDom(): Promise<void> {
    console.log(`[StagehandObserveHandler._waitForSettledDom] waiting for DOM to settle ######`);
    try {
      // Use a simple timeout for now - can be enhanced with actual DOM settle detection
      await new Promise(resolve => setTimeout(resolve, 1000));

      this.logger({
        category: 'observation',
        message: 'DOM settled successfully',
        level: 1,
      });
      console.log(`[StagehandObserveHandler._waitForSettledDom] DOM settled ######`);
    } catch (error) {
      console.error(
        `[StagehandObserveHandler._waitForSettledDom] error waiting for settled DOM: ${
          error instanceof Error ? error.message : String(error)
        } ######`
      );
      this.logger({
        category: 'observation',
        message: `Failed to wait for settled DOM: ${error}`,
        level: 1,
      });
    }
  }

  /**
   * Get accessibility data using Cordyceps snapshotForAI method
   * This provides a structured accessibility tree with aria-ref identifiers
   * that can be used directly as selectors for element interaction
   */
  private async _getAccessibilityData(iframes?: boolean): Promise<{
    combinedTreeString: string;
    combinedXpathMap: Record<string, string>;
    discoveredIframes: AccessibilityNode[];
  }> {
    console.log(
      `[StagehandObserveHandler._getAccessibilityData] getting accessibility data, iframes=${iframes} ######`
    );
    try {
      const page = await this.browserWindow.getCurrentPage();

      // Get AI-formatted accessibility snapshot with aria-ref identifiers
      const aiSnapshot = await page.snapshotForAI();
      console.log(
        `[StagehandObserveHandler._getAccessibilityData] snapshot received, length=${aiSnapshot.length} ######`
      );

      this.logger({
        category: 'observation',
        message: `Retrieved accessibility snapshot: ${aiSnapshot.length} characters`,
        level: 1,
        auxiliary: {
          snapshotLength: {
            value: aiSnapshot.length.toString(),
            type: 'integer',
          },
          includesIframes: {
            value: (iframes || false).toString(),
            type: 'boolean',
          },
        },
      });

      // Extract aria-ref mappings from the snapshot
      const ariaRefMap: Record<string, string> = {};

      // Parse aria-ref identifiers from snapshot (e.g., [ref=e123], [ref=f1e45])
      const ariaRefMatches = aiSnapshot.match(/\[ref=([ef]\d+e?\d*)\]/g);
      if (ariaRefMatches) {
        ariaRefMatches.forEach(match => {
          const refId = match.match(/ref=([ef]\d+e?\d*)/)?.[1];
          if (refId) {
            ariaRefMap[refId] = `[ref=${refId}]`;
          }
        });

        console.log(
          `[StagehandObserveHandler._getAccessibilityData] extracted ${
            Object.keys(ariaRefMap).length
          } aria-ref mappings ######`
        );
        this.logger({
          category: 'observation',
          message: `Extracted ${Object.keys(ariaRefMap).length} aria-ref mappings`,
          level: 1,
        });
      }

      // Extract iframe information from frame references (refs starting with 'f')
      const discoveredIframes: AccessibilityNode[] = [];
      const frameRefMatches = aiSnapshot.match(/\[ref=(f\d+e?\d*)\]/g);
      if (frameRefMatches && iframes) {
        frameRefMatches.forEach((match, index) => {
          const frameRefId = match.match(/ref=(f\d+e?\d*)/)?.[1];
          if (frameRefId) {
            discoveredIframes.push({
              nodeId: index.toString(), // Placeholder nodeId
              role: 'iframe',
              name: `iframe-${index}`,
            });
          }
        });

        console.log(
          `[StagehandObserveHandler._getAccessibilityData] discovered ${discoveredIframes.length} iframes ######`
        );
        this.logger({
          category: 'observation',
          message: `Discovered ${discoveredIframes.length} iframe references`,
          level: 1,
        });
      }

      return {
        combinedTreeString: aiSnapshot,
        combinedXpathMap: ariaRefMap,
        discoveredIframes,
      };
    } catch (error) {
      console.error(
        `[StagehandObserveHandler._getAccessibilityData] error getting accessibility data: ${
          error instanceof Error ? error.message : String(error)
        } ######`
      );
      this.logger({
        category: 'observation',
        message: `Failed to get accessibility data: ${error}`,
        level: 1,
      });

      // Return empty data on error to allow graceful degradation
      return {
        combinedTreeString: '[]',
        combinedXpathMap: {},
        discoveredIframes: [],
      };
    }
  }

  /**
   * Process observation elements and generate selectors
   */
  private async _processObservationElements(
    elements: Array<{
      elementId: string;
      description: string;
      method?: string;
      arguments?: string[];
    }>,
    xpathMap: Record<string, string>
  ): Promise<ObserveResult[]> {
    console.log(
      `[StagehandObserveHandler._processObservationElements] processing ${elements.length} elements ######`
    );
    try {
      const elementsWithSelectors = (
        await Promise.all(
          elements.map(async element => {
            const { elementId, ...rest } = element;

            console.log(
              `[StagehandObserveHandler._processObservationElements] processing elementId=${elementId} ######`
            );
            this.logger({
              category: 'observation',
              message: 'Getting xpath for element',
              level: 1,
              auxiliary: {
                elementId: {
                  value: elementId.toString(),
                  type: 'string',
                },
              },
            });

            if (elementId.includes('-')) {
              // Handle encoded format (frame-element ID)
              const lookUpIndex = elementId as EncodedId;
              const xpath: string | undefined = xpathMap[lookUpIndex];
              const trimmedXpath = trimTrailingTextNode(xpath);

              if (!trimmedXpath || trimmedXpath === '') {
                console.warn(
                  `[StagehandObserveHandler._processObservationElements] empty or invalid xpath for elementId=${elementId} ######`
                );
                return undefined;
              }

              return {
                ...rest,
                selector: `xpath=${trimmedXpath}`,
              };
            } else if (elementId.match(/^[ef]\d+e?\d*$/)) {
              // Handle aria-ref format (like 'e123', 'f45e67')
              console.log(
                `[StagehandObserveHandler._processObservationElements] processing aria-ref elementId=${elementId} ######`
              );

              // Use the correct aria-ref selector format that Cordyceps understands
              return {
                ...rest,
                selector: `aria-ref=${elementId}`,
              };
            } else {
              console.warn(
                `[StagehandObserveHandler._processObservationElements] elementId=${elementId} does not match expected format (frame-element or aria-ref) ######`
              );
              return undefined;
            }
          })
        )
      ).filter(<T>(e: T | undefined): e is T => e !== undefined);

      console.log(
        `[StagehandObserveHandler._processObservationElements] finished processing, returning ${elementsWithSelectors.length} elements ######`
      );
      return elementsWithSelectors;
    } catch (error) {
      console.error(
        `[StagehandObserveHandler._processObservationElements] error processing elements: ${
          error instanceof Error ? error.message : String(error)
        } ######`
      );
      this.logger({
        category: 'observation',
        message: `Failed to process observation elements: ${error}`,
        level: 1,
      });
      return [];
    }
  }

  /**
   * Encode element ID with frame information
   */
  private _encodeWithFrameId(frameId: number | undefined, nodeId: number): string {
    const encodedId = frameId === undefined ? nodeId.toString() : `${frameId}-${nodeId}`;
    console.log(
      `[StagehandObserveHandler._encodeWithFrameId] frameId=${frameId} nodeId=${nodeId} -> encodedId=${encodedId} ######`
    );
    return encodedId;
  }
}
