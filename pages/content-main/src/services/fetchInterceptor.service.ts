import { Disposable } from 'vs/base/common/lifecycle';
import { Emitter, Event } from 'vs/base/common/event';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export interface FetchOverrideMessage {
  type: 'FetchOverrideMessage';
  url: string;
  method: string;
  requestData?: unknown;
  response: unknown;
}

function containsUrl(urls: string[], url: string): boolean {
  return urls.some(u => url.startsWith(u));
}

export interface IFetchInterceptorService {
  _serviceBrand: undefined;
  start(): Promise<void>;
  onResponse: Event<FetchOverrideMessage>;
}

export const IInterceptorService = createDecorator<IFetchInterceptorService>('interceptorService');

export class FetchInterceptorService extends Disposable implements IFetchInterceptorService {
  declare readonly _serviceBrand: undefined;

  private readonly _onResponse = this._register(new Emitter<FetchOverrideMessage>());
  public readonly onResponse: Event<FetchOverrideMessage> = this._onResponse.event;

  public urls: string[] = [];
  constructor(urls: string[]) {
    super();
    this.urls = urls;
    this._overrideFetch();
  }

  public async start(): Promise<void> {
    // no-op for now
  }

  private _overrideFetch(): void {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
      const [input, init] = args;

      // figure out the URL string
      let url: string;
      if (typeof input === 'string') {
        url = input;
      } else if (input instanceof URL) {
        url = input.toString();
      } else {
        url = input.url;
      }

      // figure out the method
      let method = 'GET';
      if (init?.method) {
        method = init.method.toUpperCase();
      } else if (input instanceof Request) {
        method = input.method.toUpperCase();
      }

      // parse request body if any
      let requestData: unknown;
      if (init?.body) {
        try {
          requestData = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
        } catch {
          requestData = init.body;
        }
      }

      // perform the real fetch
      const response = await originalFetch(...args);

      // if it’s one of our URLs, clone+parse and fire event
      if (containsUrl(this.urls, url)) {
        const clone = response.clone();
        let parsed: unknown;
        try {
          parsed = await clone.json();
        } catch {
          parsed = await clone.text();
        }

        this._onResponse.fire({
          type: 'FetchOverrideMessage',
          url,
          method,
          requestData,
          response: parsed,
        });
      }

      return response;
    };
  }
}
