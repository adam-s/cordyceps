import { Emitter } from 'vs/base/common/event';

export class SimpleEventEmitter<T> {
  private readonly _emitter = new Emitter<T>();
  public readonly event = this._emitter.event;

  constructor(private readonly _name: string) {}

  public emit(data: T): void {
    this._emitter.fire(data);
  }

  public dispose(): void {
    this._emitter.dispose();
  }
}
