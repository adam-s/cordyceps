# Chrome Extension for Deep Research

## Demo Videos

### Cordyceps in Action

![Cordyceps Demo](docs/media/cordyceps.mov)

### Browser Use & Stagehand Demo

![Browser Use & Stagehand Demo](docs/media/browser-use_stagehand.mov)

## Installation

### Prerequisites

Make sure you have [pnpm](https://pnpm.io/) installed on your system.

### Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Start the development environment:

   ```bash
   pnpm dev
   ```

   This command starts:
   - The Chrome extension development build with hot reloading
   - A web page fixture server at <http://localhost:3005> (required for Cordyceps playground testing)

3. Install the Chrome extension:

   1. Open Chrome and navigate to `chrome://extensions/`
   2. Enable **Developer mode** by toggling the switch in the top-right corner
   3. Click the **"Load unpacked"** button
   4. Select the `dist` folder from this project directory
   5. The extension should now appear in your extensions list and be active
   6. (Optional) Pin the extension to your toolbar by clicking the puzzle piece icon in Chrome's toolbar and then clicking the pin icon next to the extension

## Running Tests

Once the extension is installed, you can test the different automation systems using the built-in test runners.

### 1. Cordyceps Tests (No API Key Required)

![Cordyceps Tab](docs/media/cordyceps_start.png)

- Click the **Cordyceps** tab in the extension
- Click **"Run Locator Test"** to test DOM element location and interaction
- No API key required - tests run using built-in functionality

### 2. Stagehand Tests (OpenAI API Key Required)

![Stagehand Tab](docs/media/stagehand_start.png)

- Click the **Stagehand** tab in the extension
- Click **"🐘 Elephant Research Test"** to run the AI-powered research workflow
- **Requires OpenAI API key** (only OpenAI models are supported)

### 3. Browser Use Tests (OpenAI API Key Required)

![Browser Use Tab](docs/media/browser_use_start.png)

- Click the **Browser Use** tab in the extension  
- Click **"Run Browser Use Example"** to test browser automation workflows
- **Requires OpenAI API key** (only OpenAI models are supported)

### Setting up API Keys

![API Keys Settings](docs/media/API_KEYS.png)

To run Stagehand and Browser Use tests:

1. Click the ⚙️ settings button in the extension
2. Enter your OpenAI API key in the **"OpenAI (ChatGPT) API Key"** field
3. Click **"Save"**
4. You can now run the AI-powered tests

## About

This repository is a Chrome extension workspace for deep research that runs advanced automation and DOM interaction fully inside the browser, without relying on the Chrome DevTools Protocol.

### Cordyceps

Cordyceps is a port of Playwright’s and Puppeteer’s client APIs that runs inside a Chrome extension using Chrome extension APIs and standard DOM APIs—no Chrome DevTools Protocol required.

### Browser‑Use

Browser‑Use is a TypeScript port of Browser Use adapted to run entirely within a Chrome extension, enabling in‑page automation and DOM interactions using extension and DOM APIs.

### Stagehand

Stagehand is a port of Stagehand designed to run in a Chrome extension environment for in‑browser reasoning, extraction, and automation workflows.

## AI Snapshot Technology

Instead of traditional screenshot-based automation, this system uses Playwright's new **AI snapshot API** (`snapshotForAI()`) to generate structured text representations of web pages. This approach offers several advantages:

### Text-Based Page Analysis

The `snapshotForAI()` method creates accessibility-tree-based snapshots that capture:

- Semantic structure and hierarchy of page elements
- Interactive elements with proper labeling and roles
- Form fields, buttons, and navigation elements
- Iframe content with intelligent resolution strategies

### Key Benefits

- **Faster Processing**: Text snapshots are significantly smaller than images and process faster
- **Better Accuracy**: Semantic understanding rather than visual pixel analysis
- **Cross-Platform Consistency**: Text representation works identically across different screen sizes and zoom levels
- **Lower Resource Usage**: No image processing or computer vision overhead

### Implementation Details

The core snapshot processing leverages Playwright's latest API:

```typescript
async snapshotForAI(options?: { progress?: Progress }): Promise<string> {
  return executeWithProgress(async p => {
    this.lastSnapshotFrameIds = [];
    return await createPageSnapshotForAI(p, this.mainFrame(), this.lastSnapshotFrameIds);
  }, options);
}
```

The system includes advanced iframe handling through `snapshotFrameForAI()`, which:

- Recursively processes nested frames with retry logic
- Uses intelligent frame reference prefixes for AI understanding
- Handles cross-origin and navigation timing issues gracefully
- Provides fallback strategies when frame content is inaccessible

This enables AI agents to understand page structure semantically rather than visually, leading to more reliable and efficient web automation.

## Attribution

- Browser‑Use (TypeScript port): [GitHub repository — please provide URL]
- Browser‑Use (original): [browser-use/browser-use](https://github.com/browser-use/browser-use)
- Stagehand: [stagehand.dev](https://stagehand.dev) — Docs: [docs.stagehand.dev](https://docs.stagehand.dev)
