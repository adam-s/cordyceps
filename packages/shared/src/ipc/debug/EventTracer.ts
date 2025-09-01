import { Event } from 'vs/base/common/event';

export interface IEventTrace {
  id: string;
  timestamp: number;
  source: string;
  target: string;
  type: string;
  data: unknown;
  duration?: number;
}

export class EventTracer {
  private static traces = new Map<string, IEventTrace[]>();
  private static enabled = false;

  static enable() {
    this.enabled = true;
  }

  static disable() {
    this.enabled = false;
  }

  static trace<T>(
    event: Event<T>,
    source: string,
    target: string,
    type: string,
  ): Event<T> {
    return Event.map(event, data => {
      if (!this.enabled) return data;

      const trace: IEventTrace = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        source,
        target,
        type,
        data,
      };

      const traces = this.traces.get(source) || [];
      traces.push(trace);
      this.traces.set(source, traces);

      console.group(`Event Trace: ${source} -> ${target}`);
      console.log('Type:', type);
      console.log('Data:', data);
      console.log('Trace ID:', trace.id);
      console.trace();
      console.groupEnd();

      return data;
    });
  }

  static getTraces(source: string): IEventTrace[] {
    return this.traces.get(source) || [];
  }
}
