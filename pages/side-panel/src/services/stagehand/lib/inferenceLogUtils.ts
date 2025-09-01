/**
 * Lightweight console-based inference logging for Chrome extension
 * Drop-in replacement for file-based logging with concise one-line output
 */

interface InferenceLogEntry {
  inferenceType?: string;
  requestId?: string;
  promptTokens?: number;
  completionTokens?: number;
  inferenceTimeMs?: number;
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * Get emoji for inference type
 */
function getTypeEmoji(inferenceType: string): string {
  const emojis: Record<string, string> = {
    extract: '📤',
    observe: '👁️',
    act: '⚡',
    metadata: '📋',
  };
  return emojis[inferenceType] || '🔧';
}

/**
 * Format timing for compact display
 */
function formatTiming(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Format tokens for compact display
 */
function formatTokens(prompt: number, completion: number): string {
  const total = prompt + completion;
  return `${total}t(${prompt}+${completion})`;
}

/**
 * Get short request ID for logging
 */
function getShortId(id: string): string {
  return id.slice(-8);
}

/**
 * Get formatted time for logging
 */
function getTimeString(): string {
  return new Date().toISOString().slice(11, 23);
}

/**
 * Simple timestamp utility - maintains original API
 */
function getTimestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[^0-9T]/g, '')
    .replace('T', '_');
}

/**
 * Log inference summary - maintains original API signature
 */
export function appendSummary<T extends InferenceLogEntry>(inferenceType: string, entry: T): void {
  const emoji = getTypeEmoji(inferenceType);
  const reqId = entry.requestId ? getShortId(entry.requestId) : 'unknown';
  const tokens =
    entry.promptTokens !== undefined && entry.completionTokens !== undefined
      ? formatTokens(entry.promptTokens, entry.completionTokens)
      : '';
  const timing = entry.inferenceTimeMs ? formatTiming(entry.inferenceTimeMs) : '';
  const time = getTimeString();

  console.log(`${emoji} ${inferenceType} | ${reqId} | ${timing} | ${tokens} | ${time}`);
}

/**
 * Log timestamped data - maintains original API signature
 */
export function writeTimestampedTxtFile(
  directory: string,
  prefix: string,
  data: unknown
): { fileName: string; timestamp: string } {
  const timestamp = getTimestamp();
  const fileName = `${timestamp}_${prefix}`;

  // Extract requestId if available for correlation
  const requestId = (data as { requestId?: string })?.requestId || 'unknown';
  const reqId = getShortId(requestId);
  const time = getTimeString();

  console.log(`🔍 ${directory}/${prefix} | ${reqId} | ${time}`);

  return { fileName, timestamp };
}
