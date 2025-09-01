import { EventTracer, IEventTrace } from './EventTracer';
import { Emitter } from 'vs/base/common/event';

export interface IDebugOptions {
  traceEvents: boolean;
  logProtocol: boolean;
  logRequests: boolean;
  filterSources?: string[];
  filterEvents?: string[];
}

export class DebugController {
  private static instance: DebugController;
  private options: IDebugOptions;
  private readonly _onOptionsChange = new Emitter<IDebugOptions>();

  private constructor() {
    this.options = {
      traceEvents: false,
      logProtocol: false,
      logRequests: false,
    };
  }

  static getInstance(): DebugController {
    if (!DebugController.instance) {
      DebugController.instance = new DebugController();
    }
    return DebugController.instance;
  }

  setOptions(options: Partial<IDebugOptions>): void {
    this.options = { ...this.options, ...options };

    if (this.options.traceEvents) {
      EventTracer.enable();
    } else {
      EventTracer.disable();
    }

    this._onOptionsChange.fire(this.options);
  }

  isEventEnabled(source: string, eventType: string): boolean {
    if (!this.options.traceEvents) return false;

    if (
      this.options.filterSources?.length &&
      !this.options.filterSources.includes(source)
    ) {
      return false;
    }

    if (
      this.options.filterEvents?.length &&
      !this.options.filterEvents.includes(eventType)
    ) {
      return false;
    }

    return true;
  }

  getEventTraces(source: string): IEventTrace[] {
    return EventTracer.getTraces(source);
  }
}
