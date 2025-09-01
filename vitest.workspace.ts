import { defineWorkspace } from 'vitest/config';
// Can use argv to pass arguments to sort which are run
const workspaces = ['packages/vs', 'packages/server', 'packages/injected', './chrome-extension', 'packages/shared'];

export default defineWorkspace(workspaces);
