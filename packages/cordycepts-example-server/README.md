# Cordyceps Example Server

This is a local server for testing Cordyceps automation with various HTML elements including nested iframes, shadow DOM, and interactive controls.

## Features

- **Interactive Controls**: Checkboxes and buttons for testing automation
- **Nested Iframes**: Two main iframes, with one containing a nested iframe (3 levels deep)
- **Shadow DOM**: Isolated DOM content for advanced testing scenarios
- **Message Passing**: Communication between iframes and parent window
- **Local Development**: Express server for local testing

## Getting Started

### Install Dependencies

```bash
npm install
```

### Start the Server

```bash
npm start
```

Or for development with auto-restart:

```bash
npm run dev
```

The server will start on `http://localhost:3000`

## Testing with Cordyceps

Update your `cordycepsPlaygroundService.ts` to use the local server:

```typescript
// Replace this line:
await page.goto('https://google.com', {
  timeout: 10000,
  progress,
  waitUntil: 'load',
});

// With this:
await page.goto('http://localhost:3000', {
  timeout: 10000,
  progress,
  waitUntil: 'load',
});
```

## Available Routes

- `/` - Main testing page with all features
- `/iframe1` - Simple iframe content
- `/iframe2` - Iframe with nested iframe
- `/nested-iframe` - Deeply nested iframe content

## Testing Selectors

### Main Page Elements
- `#test-checkbox` - Main test checkbox
- `#advanced-mode` - Advanced mode checkbox
- `#action-button` - Main action button
- `#toggle-button` - Checkbox toggle button
- `#log-button` - Status logging button

### Iframe Elements
- `iframe[title="First embedded iframe"]` - First iframe
- `iframe[title="Second embedded iframe with nested content"]` - Second iframe
- `iframe[title="Nested iframe inside iframe 2"]` - Nested iframe

### Shadow DOM
- Use `page.shadowRoot()` or similar methods to access shadow DOM content
- Shadow DOM contains buttons and checkboxes isolated from main DOM

## Architecture

```
Main Page (localhost:3000)
├── Interactive Controls (checkboxes, buttons)
├── Shadow DOM Content
├── Iframe 1 (/iframe1)
│   └── Simple interactive content
└── Iframe 2 (/iframe2)
    ├── Interactive content
    └── Nested Iframe (/nested-iframe)
        └── Deep level content
```
