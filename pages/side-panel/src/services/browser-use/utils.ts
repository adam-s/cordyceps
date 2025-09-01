/**
 * TypeScript implementation of browser-use utilities
 */

/**
 * Decorator for measuring async function execution time
 * @param label Label for the timing log
 */
export function timeExecutionAsync(label: string) {
  return function (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const start = performance.now();
      try {
        return await originalMethod.apply(this, args);
      } finally {
        const end = performance.now();
        console.log(`${label} took ${(end - start).toFixed(2)}ms`);
      }
    };

    return descriptor;
  };
}

/**
 * Decorator for measuring sync function execution time
 * @param label Label for the timing log
 */
export function timeExecutionSync(label: string) {
  return function (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: unknown[]) {
      const start = performance.now();
      try {
        return originalMethod.apply(this, args);
      } finally {
        const end = performance.now();
        console.log(`${label} took ${(end - start).toFixed(2)}ms`);
      }
    };

    return descriptor;
  };
}

/**
 * Sleep for a specified number of milliseconds
 * @param ms Milliseconds to sleep
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format a date as a string
 * @param date Date to format
 * @param format Format string
 */
export function formatDate(date: Date, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * Generate a random string
 * @param length Length of the string
 */
export function randomString(length: number = 10): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Check if a URL is valid
 * @param url URL to check
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Extract domain from URL
 * @param url URL to extract domain from
 */
export function extractDomain(url: string): string {
  try {
    const { hostname } = new URL(url);
    return hostname;
  } catch (e) {
    return '';
  }
}

/**
 * Check if a domain is allowed
 * @param url URL to check
 * @param allowedDomains List of allowed domains
 */
export function isDomainAllowed(url: string, allowedDomains: string[] | null): boolean {
  if (!allowedDomains || allowedDomains.length === 0) {
    return true;
  }

  try {
    const domain = extractDomain(url);
    return allowedDomains.some(
      allowedDomain => domain === allowedDomain || domain.endsWith(`.${allowedDomain}`),
    );
  } catch (e) {
    return false;
  }
}
