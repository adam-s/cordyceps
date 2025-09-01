import { InstantiationType, registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const IMathService = createDecorator<IMathService>('mathService');

export interface IMathService {
  add(a: number, b: number): Promise<number>;
  subtract(a: number, b: number): Promise<number>;
  multiply(a: number, b: number): Promise<number>;
  divide(a: number, b: number): Promise<number>;
}

export class MathService implements IMathService {
  readonly _serviceBrand: undefined;

  add: (a: number, b: number) => Promise<number> = async (a, b) => a + b;
  subtract: (a: number, b: number) => Promise<number> = async (a, b) => a - b;
  multiply: (a: number, b: number) => Promise<number> = async (a, b) => a * b;
  divide: (a: number, b: number) => Promise<number> = async (a, b) => a / b;
}

registerSingleton(IMathService, MathService, InstantiationType.Delayed);
