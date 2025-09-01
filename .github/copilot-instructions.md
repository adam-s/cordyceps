# Copilot Instructions

## Browser-Use Context Implementation for Chrome Extension

### Core Requirements

- **Environment**: Chrome extension side panel with custom Cordyceps engine (Playwright-like but Chrome extension compatible)
- **No Playwright Dependencies**: Must use Cordyceps APIs and Chrome extension APIs exclusively
- **CSP Compliance**: No dynamic code execution, no eval(), no new Function()
- **Extension Limitations**: Work within browser security model and extension permissions

### API Mapping Guidelines

#### 1. Page Management
```typescript
// Replace Playwright context/pages with Cordyceps BrowserWindow
// Playwright: context.newPage()
// Cordyceps: browserWindow.newPage()
// Chrome Extension: Use chrome.tabs API for tab management
```

#### 2. Element Interaction
```typescript
// Replace Playwright ElementHandle with Cordyceps Locator/ElementHandle
// Playwright: elementHandle.click()
// Cordyceps: locator.click() or elementHandle.click()
// Use existing Cordyceps element interaction patterns
```

#### 3. Network Monitoring
```typescript
// Replace Playwright network events with chrome.webRequest
// Playwright: page.on('request', handler)
// Chrome Extension: chrome.webRequest.onBeforeRequest.addListener()
// Implement _waitForStableNetwork using chrome.webRequest API
```

#### 4. Screenshot Functionality
```typescript
// Use Cordyceps screenshotter instead of Playwright
// Playwright: page.screenshot()
// Cordyceps: page.screenshot(progress, options)
// Already implemented in Cordyceps system
```

#### 5. Cookie Management
```typescript
// Replace Playwright cookies with chrome.cookies API
// Playwright: context.cookies()
// Chrome Extension: chrome.cookies.getAll()
// File operations must use chrome.storage or chrome.downloads
```

#### 6. Navigation & History
```typescript
// Use Cordyceps navigation methods
// Playwright: page.goBack()
// Cordyceps: page.goBack(options)
// Leverage existing navigation tracking in Cordyceps
```

### Implementation Patterns

#### 1. CSS Selector Generation
- **Keep existing logic**: `_enhancedCssSelectorForElement` and `_convertSimpleXpathToCssSelector` are pure functions
- **Test thoroughly**: Ensure selector generation works with Cordyceps element detection
- **Attribute handling**: Verify safe attributes work with Cordyceps selectors

#### 2. Element Location & Interaction
```typescript
// Pattern: Use Cordyceps locator system
async getLocateElement(element: any): Promise<ElementHandle | null> {
  // Use page.locator() instead of Playwright selectors
  const page = await this.browserWindow.getCurrentPage();
  const cssSelector = BrowserContext._enhancedCssSelectorForElement(element);
  return await page.locator(cssSelector).elementHandle();
}
```

#### 3. State Management
```typescript
// Pattern: Adapt to Cordyceps page model
async _updateState(): Promise<BrowserState> {
  const page = await this.browserWindow.getCurrentPage();
  // Use Cordyceps screenshot and element detection
  const screenshot = await page.screenshot(progress, options);
  // Adapt DOM service to work with Cordyceps
}
```

#### 4. Network Stability Detection
```typescript
// Pattern: Use chrome.webRequest instead of Playwright events
async _waitForStableNetwork(): Promise<void> {
  // Implement using chrome.webRequest.onBeforeRequest
  // Track pending requests in extension background script
  // Communicate with side panel via chrome.runtime messaging
}
```

### Chrome Extension Specific Adaptations

#### 1. File Operations
- **No Node.js fs**: Use `chrome.storage.local` for small data, `chrome.downloads` for files
- **Cookie file storage**: Store in chrome.storage, not file system
- **Download handling**: Use `chrome.downloads` API events

#### 2. Cross-Origin Limitations
- **Iframe access**: Limited by browser security, handle gracefully
- **URL validation**: Implement `_isUrlAllowed` using URL parsing only
- **Navigation restrictions**: Respect extension's host permissions

#### 3. Context Management
- **Session storage**: Use chrome.storage instead of in-memory state
- **Tab management**: Integrate with chrome.tabs API
- **Window management**: Work with BrowserWindow from Cordyceps

#### 4. Error Handling
- **Extension context**: Handle extension lifecycle (context invalidation)
- **Permission errors**: Graceful degradation when permissions missing
- **Network errors**: Handle chrome.webRequest API limitations

### Testing Strategy

#### 1. CSS Selector Tests
- **Verify compatibility**: Test generated selectors with Cordyceps element detection
- **Edge cases**: Special characters, iframe handling, dynamic attributes
- **Performance**: Ensure selector generation doesn't block UI

#### 2. Element Interaction Tests
- **Click handling**: Verify click events work through Cordyceps
- **Text input**: Test fill/type operations with various input types
- **File uploads**: Test with chrome.downloads integration

#### 3. State Management Tests
- **Screenshot capture**: Verify Cordyceps screenshot integration
- **DOM state**: Test element tree generation and selector mapping
- **Cache consistency**: Ensure session state remains consistent

### Migration Checklist

- [ ] Replace Playwright imports with Cordyceps imports
- [ ] Convert network monitoring to chrome.webRequest
- [ ] Adapt file operations to chrome.storage/chrome.downloads
- [ ] Update cookie management to chrome.cookies API
- [ ] Test CSS selector generation with Cordyceps
- [ ] Verify element interaction through Cordyceps locators
- [ ] Implement proper error handling for extension context
- [ ] Add comprehensive tests for all adapted functionality

## Prompts

### Find common patterns
- step 1: find common patterns in frameExecutionContext pages/side-panel/src/services/cordyceps/frameExecutionContext.ts

- step 2: find common patterns in handledInjectedScript pages/content-cordyceps/src/handledInjectedScript.ts

- Use the common patterns to emulate building new methods to interact with the DOM based on step 1 and step 2.

### General Coding

- **Scope of coding**: Only do a little bit at a time. Give the user a chance to review the code. 

- **Chrome extension**: Write code for a Chrome extension that is compatible with the latest version of Chrome and adheres to the latest Chrome extension development standards. DO NOT USE new Function(''). DO NOT USE eval('').

- **Forbidden Code Patterns**: The following code patterns are strictly forbidden anywhere in the entire project due to Chrome extension Content Security Policy (CSP) restrictions:
  - `new Function('')` - Dynamic function creation is blocked
  - `eval('')` - Dynamic code evaluation is blocked  
  - `Function()` constructor - Alternative dynamic function creation is blocked
  - `setTimeout('code', delay)` - String-based setTimeout is blocked (use function callbacks instead)
  - `setInterval('code', delay)` - String-based setInterval is blocked (use function callbacks instead)
  - Any form of dynamic code execution from strings
  
  These restrictions apply to all files including content scripts, background scripts, and injected scripts. Use alternative patterns like:
  - Pre-defined functions instead of dynamic function creation
  - Function references instead of string-based code execution
  - Structured data passing instead of code serialization

- **any type**: Do not under any circumstance allow any any type to enter the code. any is not a valid type in this code base. Remove any any type from the TypeScript code.
  
- **Consistency**: Adhere to a specific coding standard or style guide (e.g., [Airbnb's JavaScript Style Guide](https://github.com/airbnb/javascript)) to ensure uniformity across all files.

- **Simplicity**: Write simple, clean, and elegant code that is easy to understand. Use descriptive variable and function names to enhance readability. Avoid complex or convoluted logic.

- **Standards**: Ensure all code adheres to industry-standard best practices, suitable for review by a Senior TypeScript Software Engineer at leading tech companies.

- **Imports**: Configure tools like ESLint to enforce the `eslint-import/no-duplicates` rule, preventing duplicate imports.

- **TypeScript**:
  - Prefer interfaces over types for defining object shapes, especially when expecting that a class or object will be implemented or extended.
  - Avoid using the `any` type. Instead, use more precise types or `unknown` when the type is not known, as it is safer than `any`.
  - Avoid using the types `Number`, `String`, `Boolean`, `Symbol`, or `Object` (with an uppercase first letter), as they refer to non-primitive boxed objects. Instead, use the lowercase versions: `number`, `string`, `boolean`, `symbol`, and `object`.
  - Use enums to define a set of named constants, enhancing code readability and maintainability. For example:

    ```typescript
    enum EventType {
        Create,
        Delete,
        Update
    }
    ```

    This approach provides a clear and concise way to handle related constants.
  - Avoid empty interfaces, as they do not enforce any contracts and can lead to inconsistencies. Ensure that interfaces define the expected structure and properties.
  - Explicitly specify access modifiers (`public`, `private`, `protected`) for class members to define their visibility and encapsulation clearly. This practice enhances code readability and maintainability.
  - Adopt standard naming conventions to maintain consistency across the codebase:
    - Use `camelCase` for variables, functions, and class members.
    - Use `PascalCase` for class and interface names.
    - Use `UPPER_CASE` for constants and enum values.

    Consistent naming improves code readability and helps developers understand the role and purpose of different identifiers. :contentReference[oaicite:4]{index=4}
  - Leverage TypeScript's utility types, such as `Partial`, `Readonly`, and `Pick`, to create new types based on existing ones. This practice promotes code reuse and reduces redundancy.
  - Refrain from using the non-null assertion operator (`!`), as it can mask potential `null` or `undefined` errors. Instead, perform proper null checks to ensure values are valid before use.
  - When a function can accept multiple types, prefer using union types over function overloading for simplicity and clarity.
  
- **Class Member Ordering**:
  - Organize class members in the following sequence:
    1. **Index Signatures**: Define any index signatures first.
    2. **Fields**:
       - Static fields (public, protected, private, and `#private`).
       - Instance fields (public, protected, private, and `#private`).
    3. **Constructors**: Place the constructor after fields.
    4. **Methods**:
       - Static methods (public, protected, private, and `#private`).
       - Instance methods (public, protected, private, and `#private`).
    5. **Private**:
       - Private methods and fields star with underscore, _.

    This structure enhances code readability and maintainability by providing a predictable and consistent organization.

  - Implement a consistent order for class members to make the code easier to read, navigate, and edit. For example, you might choose to always list public members before private ones, or static members before instance members. Consistency in member ordering helps developers understand the structure and responsibilities of a class more quickly.

- **Testability**:
  - **Single Responsibility Principle**: Design classes and functions to have a single responsibility, which simplifies testing by reducing dependencies and isolating functionality.
  - **Dependency Injection**: Inject dependencies (e.g., services, configurations) into classes and functions rather than hardcoding them. This approach facilitates the use of mocks or stubs during testing.
  - **Avoid Global State**: Minimize reliance on global variables or state, as they can lead to unpredictable behavior in tests. Instead, pass necessary data explicitly to functions or classes.
  - **Pure Functions**: Favor pure functions that return outputs solely based on their inputs and have no side effects. Pure functions are inherently more testable.
  - **Interface Segregation**: Define clear interfaces for your components and services. This practice allows for the creation of mock implementations during testing.
  - **Asynchronous Code Handling**: When dealing with asynchronous operations, use Promises or async/await syntax to simplify testing and avoid callback hell.

- **Best Practices**:
  - Provide multiple solutions only when it adds significant value to the discussion.
  - Align with established paradigms in the project's codebase to maintain cohesion and consistency.

- **Comments**: Strive to write self-explanatory code to minimize the need for comments. However, include comments where they significantly enhance understanding, especially in complex logic.

- **Error Checking**: In addition to double-checking for TypeScript errors, advocate for thorough testing and code reviews to catch potential issues.

- **Optimization**: Write efficient algorithms and analyze their time complexity. Aim for O(n) complexity; avoid O(n²) or worse.

- **Pure Functions**: Prefer pure, deterministic functions and functional programming principles where appropriate, while considering practical scenarios where side effects are necessary.

- **Optimization**: Optimize for developer experience first. Optimize for speed second. Optimize the code. Optimize the code. Optimize the code.

- **Correct any spelling errors** in code, including variable names, function names, property names, etc.

- **Choose descriptive names** for properties, members, types, functions, methods, and classes that clearly convey their purpose.

- **Follow established naming conventions**, e.g., use camelCase for functions and variables, PascalCase for classes and interfaces, and UPPER_CASE for constants.
  
- **VS Code Setting: Observable**

  - **Observable Updates with Transactions**:  
    When updating an observable via `obs.set(valueToUpdate)`, adhere to the following guidelines:
    - **Multiple Updates in One Tick**:  
      If you plan to update multiple observables within the same tick, wrap the updates in a transaction. For example:

      ```typescript
      transaction(tx => {
        obs1.set(valueToUpdate, tx);
        obs2.set(valueToUpdate, tx);
        // ...additional sets as needed
      });
      ```

      This ensures that all observers wait until the transaction is complete before emitting updates.

    - **Single Update in One Tick**:  
      If you are performing a single update (i.e., not batching multiple updates), pass `undefined` as the second parameter:

      ```typescript
      obs.set(valueToUpdate, undefined);
      ```

      This signals that no transaction is active, and the update can be emitted immediately.

### Fluent UI

- **Version**: Use Microsoft React Fluent UI v9 exclusively. Specify the exact version to prevent discrepancies due to updates.

- **Standards**: Ensure all design code adheres to Microsoft's design guidelines and best practices.

- **Consistency**: Provide examples or guidelines to ensure visual consistency throughout the application.

- **Aesthetics**: Follow specific design principles to create a simple, clean, and elegant user interface, focusing on user experience.

### React

- **Hooks**: Import hooks like `useState`, `useCallback`, and `useMemo` directly to ensure consistency and clarity.

- **Best Practices**: Follow React best practices for functional components and hooks, referring to the [official React documentation](https://react.dev/) for guidance.

### Templates

- **Consistency**: Define consistent design and implementation patterns for templates and reusable components, providing examples where possible.

- **Simplicity**: Offer guidelines on achieving simplicity and maintainability in templates, aligning with the overall application architecture.

## Browser-Use Context Analysis & Conversion Summary

### Conversation Overview

This section documents a comprehensive analysis session focused on porting browser-use context functionality from a Playwright-based Node.js implementation to a Chrome extension environment using the custom Cordyceps engine. The analysis was conducted to understand the scope, complexity, and adaptation requirements for implementing browser automation capabilities within the constraints of a Chrome extension side panel.

### Original Code Analysis

#### Source Material
The analysis focused on a comprehensive TypeScript implementation of browser-use context that included:

- **BrowserContextConfig Class**: A configuration management system with 30+ properties covering browser settings, Python-specific parameters, and Playwright options
- **BrowserSession Class**: Session lifecycle management with state tracking and serialization capabilities  
- **BrowserContext Class**: The main orchestration class with 45+ methods handling browser automation, DOM interaction, and state management

#### Key Functionality Identified
The original implementation provided extensive browser automation capabilities including:

1. **Browser Lifecycle Management**
   - Context creation and teardown
   - Page management and tab switching
   - Session state tracking and persistence

2. **DOM Interaction & Element Management**
   - Advanced CSS selector generation from XPath
   - Element location with iframe traversal support
   - Click handling with download detection
   - Text input with content-editable support
   - File upload capabilities

3. **Navigation & Network Management**
   - URL validation and domain allowlisting
   - Smart network stability detection with filtering
   - Navigation history management
   - Page reload and recovery mechanisms

4. **State Management & Screenshots**
   - Browser state capture and caching
   - Screenshot functionality with viewport control
   - Scroll position tracking
   - Highlight overlay management

5. **Cookie & Storage Management**
   - Cookie persistence to file system
   - Session data serialization
   - Cross-context state management

### Method Analysis Results

#### Comprehensive Method Inventory
A detailed analysis was conducted of all methods across the three main classes:

**BrowserContextConfig (2 methods)**:
- `constructor`: Configuration initialization with extensive defaults
- `toPlaywrightOptions`: Conversion to Playwright-compatible options

**BrowserSession (3 methods)**:
- `constructor`: Session creation with UUID generation
- `end`: Session termination with state updates
- `toDict`: Serialization for persistence

**BrowserContext (40+ methods)** including:
- Static utility methods for CSS/XPath conversion
- Browser lifecycle methods (enter, close, getCurrentPage)
- Cookie management (get, set, clear, save, load)
- State management (getState, _updateState, resetContext)
- Navigation methods (navigateTo, goBack, goForward)
- DOM interaction (_clickElementNode, _inputTextElementNode)
- Screenshot and highlight management
- Tab management (createNewTab, switchToTab, closeCurrentTab)
- Network stability and URL validation
- File upload detection and handling

#### Side Effects Documentation
Each method was analyzed for side effects including:
- File system operations (cookie persistence, downloads)
- Network requests and monitoring
- DOM modifications (highlights, element interaction)
- Browser state changes (navigation, tab management)
- Cache and session updates

### Cordyceps System Mapping

#### Direct API Equivalents Identified
The analysis revealed strong alignment between Playwright and Cordyceps APIs:

```typescript
// Navigation
page.goto() → page.goto(url, options)
page.goBack() → page.goBack(options)
page.goForward() → page.goForward(options)

// Element Interaction  
elementHandle.click() → locator.click()
elementHandle.fill() → locator.fill()
page.locator() → page.locator()

// Screenshots & Evaluation
page.screenshot() → page.screenshot(progress, options)
page.evaluate() → frame.evaluate()

// Frame Management
page.frameLocator() → frame.frameLocator()
frame.waitForSelector() → frame.waitForSelector()
```

#### Chrome Extension Limitations & Adaptations

**Network Monitoring Adaptation**:
- Replace Playwright's `page.on('request')` with `chrome.webRequest` API
- Implement request filtering in background script
- Use message passing for side panel communication

**Cookie Management Conversion**:
- Replace Node.js file operations with `chrome.storage.local`
- Use `chrome.cookies` API instead of Playwright context cookies
- Implement storage quota management

**Download Handling Adaptation**:
- Replace Playwright download events with `chrome.downloads` API
- Implement download progress tracking
- Handle file naming conflicts in extension context

**Cross-Origin & Security Adaptations**:
- Handle iframe access limitations gracefully
- Implement URL validation without file system access
- Respect extension host permissions
- Work within Content Security Policy constraints

### Implementation Strategy

#### Pure Function Preservation
Several methods were identified as pure functions that can be directly ported:
- `_enhancedCssSelectorForElement`: CSS selector generation logic
- `_convertSimpleXpathToCssSelector`: XPath to CSS conversion
- URL parsing and validation utilities
- Element attribute processing functions

#### Cordyceps Integration Patterns
Specific patterns were developed for integrating with the Cordyceps system:

```typescript
// Pattern 1: Element Location
async getLocateElement(element: ElementForSelector): Promise<ElementHandle | null> {
  const page = await this.browserWindow.getCurrentPage();
  const cssSelector = BrowserContext._enhancedCssSelectorForElement(element);
  return await page.locator(cssSelector).elementHandle();
}

// Pattern 2: State Management
async _updateState(): Promise<BrowserState> {
  const page = await this.browserWindow.getCurrentPage();
  const screenshot = await page.screenshot(progress, options);
  // Adapt DOM service integration
}

// Pattern 3: Network Stability
async _waitForStableNetwork(): Promise<void> {
  // Use chrome.webRequest instead of Playwright events
  // Implement request tracking in background script
}
```

#### Chrome Extension Context Adaptations
Key adaptation strategies were defined:

1. **Session Storage**: Replace in-memory state with `chrome.storage` persistence
2. **Tab Management**: Integrate with `chrome.tabs` API for multi-tab support
3. **Window Management**: Work within `BrowserWindow` from Cordyceps
4. **Error Handling**: Handle extension lifecycle and context invalidation

### Testing & Validation Strategy

#### Test Categories Defined
1. **CSS Selector Generation Tests**
   - Verify compatibility with Cordyceps element detection
   - Test edge cases (special characters, iframe handling)
   - Performance validation for UI responsiveness

2. **Element Interaction Tests**
   - Click event handling through Cordyceps
   - Text input validation across input types
   - File upload integration with chrome.downloads

3. **State Management Tests**
   - Screenshot capture verification
   - DOM state consistency checking
   - Cache invalidation and refresh testing

### Migration Roadmap

#### Phase 1: Core Infrastructure
- [ ] Replace Playwright imports with Cordyceps imports
- [ ] Implement basic browser context using BrowserWindow
- [ ] Adapt CSS selector generation for Cordyceps compatibility

#### Phase 2: Network & Storage
- [ ] Convert network monitoring to chrome.webRequest
- [ ] Implement cookie management with chrome.cookies API
- [ ] Adapt file operations to chrome.storage/chrome.downloads

#### Phase 3: DOM Interaction
- [ ] Test element interaction through Cordyceps locators
- [ ] Implement screenshot capture with Cordyceps
- [ ] Validate iframe handling and cross-origin limitations

#### Phase 4: Advanced Features
- [ ] Implement download detection and handling
- [ ] Add comprehensive error handling for extension context
- [ ] Performance optimization and testing

### Risk Assessment & Mitigation

#### Identified Risks
1. **Performance Impact**: DOM operations in extension context may be slower
2. **Security Limitations**: Cross-origin restrictions may limit functionality
3. **API Compatibility**: Some Playwright features may not translate directly
4. **Storage Constraints**: Chrome extension storage limits may affect large states

#### Mitigation Strategies
1. **Incremental Implementation**: Port functionality in small, testable chunks
2. **Graceful Degradation**: Implement fallbacks for restricted operations
3. **Performance Monitoring**: Add timing measurements for critical paths
4. **Comprehensive Testing**: Create extensive test coverage for edge cases

### Technical Debt Considerations

#### Code Quality Maintenance
- Eliminate `any` types throughout the codebase
- Implement proper TypeScript interfaces for all data structures
- Ensure consistent error handling patterns
- Maintain documentation for complex selector generation logic

#### Future Scalability
- Design interfaces to support additional browser engines
- Plan for extension manifest v3 compatibility
- Consider offline functionality requirements
- Prepare for potential Cordyceps API evolution

### Success Metrics

#### Functional Completeness
- All core browser automation features operational
- CSS selector generation accuracy maintained
- Screenshot and state capture working reliably
- Network stability detection functioning properly

#### Performance Targets
- Element location under 100ms for simple selectors
- Screenshot capture under 500ms for viewport
- State updates under 1 second for complex pages
- Memory usage within Chrome extension limits

#### Reliability Standards
- Error handling for all extension lifecycle events
- Graceful degradation for permission limitations
- Consistent behavior across different page types
- Proper cleanup of resources and event listeners

This comprehensive analysis provides the foundation for successfully porting browser-use context functionality to the Chrome extension environment while maintaining the robustness and capabilities of the original implementation.
