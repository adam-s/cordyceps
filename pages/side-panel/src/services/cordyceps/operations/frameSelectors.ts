import {
  InvalidSelectorError,
  ParsedSelector,
  splitSelectorByFrame,
  visitAllSelectorParts,
  parseSelector,
  stringifySelector,
} from '@injected/isomorphic/selectorParser';
import { ElementHandle } from '../elementHandle';
import { Frame } from '../frame';
import { asLocator } from '@injected/isomorphic/locatorGenerators';
import { FrameExecutionContext } from '../core/frameExecutionContext';

export type SelectorInfo = {
  parsed: ParsedSelector;
  world: chrome.scripting.ExecutionWorld;
  strict: boolean;
};

export type SelectorInFrame = {
  frame: Frame;
  info: SelectorInfo;
  scope?: ElementHandle;
};

type StrictOptions = {
  strict?: boolean;
};

export class FrameSelectors {
  constructor(private _frame: Frame) {}

  async resolveInjectedForSelector(
    selector: string,
    options?: { strict?: boolean; mainWorld?: boolean },
    scope?: ElementHandle
  ): Promise<
    | {
        context: FrameExecutionContext;
        info: SelectorInfo;
        frame: Frame;
        scope?: ElementHandle;
      }
    | undefined
  > {
    const resolved = await this.resolveFrameForSelector(selector, options, scope);
    if (!resolved) {
      return undefined;
    }

    // Ensure the frame has an execution context before accessing it
    const context = await resolved.frame.getContext();

    return {
      context: context,
      info: resolved.info,
      frame: resolved.frame,
      scope: resolved.scope,
    };
  }

  async resolveFrameForSelector(
    selector: string,
    options: StrictOptions = {},
    scope?: ElementHandle
  ): Promise<SelectorInFrame | null> {
    let frame: Frame = this._frame;
    scope; // get rid of typescript error
    // This is for later when we support frame navigation
    const frameChunks = splitSelectorByFrame(selector);

    for (const chunk of frameChunks) {
      visitAllSelectorParts(chunk, (part, nested) => {
        if (nested && part.name === 'internal:control' && part.body === 'enter-frame') {
          const locator = asLocator('javascript', selector);
          throw new InvalidSelectorError(
            `Frame locators are not allowed inside composite locators, while querying "${locator}"`
          );
        }
      });
    }

    // If there are multiple frame chunks, parse each for validation (currently unused)
    for (let i = 0; i < frameChunks.length - 1; ++i) {
      const info = this._parseSelector(frameChunks[i], options);
      // info to a frame aria-ref selector.
      // @see https://chatgpt.com/share/68894910-90f8-8004-9173-1fcbf62d9913
      frame = this._jumpToAriaRefFrameIfNeeded(selector, info, frame);
      const context = await frame.getContext();
      const frameChunk = stringifySelector(frameChunks[i]);

      const handleId = await context.frameSelectorEvaluation(
        info.parsed,
        info.strict,
        i === 0 && scope?.remoteObject ? scope.remoteObject : null,
        frameChunk,
        info.world
      );

      if (!handleId) {
        console.error(`❌ Frame chunk evaluation failed for: "${frameChunk}"`);
        throw new InvalidSelectorError(`Could not find frame for selector "${selector}"`);
      }

      const handle = new ElementHandle(context, handleId);

      const childFrame = await handle.contentFrame();
      if (!childFrame) {
        console.error(`❌ Handle did not resolve to iframe for selector: "${frameChunk}"`);
        throw new InvalidSelectorError(`Selector "${selector}" did not resolve to an iframe`);
      }
      frame = childFrame;
    }
    if (frame !== this._frame) scope = undefined;
    const lastChunk = frame.selectors._parseSelector(frameChunks[frameChunks.length - 1], options);
    frame = this._jumpToAriaRefFrameIfNeeded(selector, lastChunk, frame);
    return { frame, info: lastChunk, scope };
  }

  private _parseSelector(
    selector: string | ParsedSelector,
    options: StrictOptions = {}
  ): SelectorInfo {
    // 1. determine strictness
    const strict = typeof options.strict === 'boolean' ? options.strict : false;

    // 2. parse if it's a string
    const parsed: ParsedSelector =
      typeof selector === 'string' ? parseSelector(selector) : selector;

    // 3. walk parts and decide if we need MAIN world
    let needsMain = true;
    visitAllSelectorParts(parsed, part => {
      // adjust these rules to taste — here any “_”-prefixed or “internal:” engine
      // will force MAIN. Everything else is ISOLATED.
      if (part.name.startsWith('_') || part.name.startsWith('internal:')) {
        needsMain = true;
      }
    });

    return {
      parsed,
      world: needsMain ? 'MAIN' : 'ISOLATED',
      strict,
    };
  }

  private _jumpToAriaRefFrameIfNeeded(selector: string, info: SelectorInfo, frame: Frame): Frame {
    if (info.parsed.parts[0].name !== 'aria-ref') return frame;
    const body = info.parsed.parts[0].body as string;

    // Check for sub-frame reference pattern: f{frameIndex}e{elementIndex}
    const subFrameMatch = body.match(/^f(\d+)e\d+$/);
    if (subFrameMatch) {
      const frameIndex = +subFrameMatch[1];
      const page = this._frame.frameManager.page;
      const frameId = page.lastSnapshotFrameIds[frameIndex - 1];
      const jumptToFrame = frameId ? page.frameManager.frame(frameId) : null;
      if (!jumptToFrame)
        throw new InvalidSelectorError(`Invalid frame in aria-ref selector "${selector}"`);
      return jumptToFrame;
    }

    // Check for main frame reference pattern: e{elementIndex}
    const mainFrameMatch = body.match(/^e\d+$/);
    if (mainFrameMatch) {
      // Main frame reference, stay in current frame context
      return frame;
    }

    // If neither pattern matches, stay in current frame
    return frame;
  }

  async queryCount(selector: string): Promise<number> {
    const resolved = await this.resolveInjectedForSelector(selector);
    if (!resolved) {
      throw new Error(`Failed to find frame for selector "${selector}"`);
    }

    return (
      (await resolved.context.evaluate(
        (parsedSelector: unknown) => {
          const injected = window.__cordyceps_handledInjectedScript;
          return injected.querySelectorAll(parsedSelector, document).length;
        },
        resolved.info.world,
        resolved.info.parsed
      )) || 0
    );
  }

  async queryAll(selector: string, scope?: ElementHandle): Promise<ElementHandle[]> {
    const resolved = await this.resolveInjectedForSelector(selector, {}, scope);
    if (!resolved) {
      return [];
    }

    // Use the context's querySelectorAll method which already returns ElementHandle[]
    return await resolved.context.querySelectorAll(selector, scope, resolved.info.world);
  }
}
