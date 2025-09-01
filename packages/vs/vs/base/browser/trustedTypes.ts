/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { onUnexpectedError } from 'vs/base/common/errors';

export interface ITrustedTypePolicyOptions {
  createHTML?: (input: string, ...args: any[]) => string;
  createScript?: (input: string, ...args: any[]) => string;
  createScriptURL?: (input: string, ...args: any[]) => string;
}
export interface ITrustedTypePolicy {
  readonly name: string;
  createHTML?(input: string): any;
  createScript?(input: string): any;
  createScriptURL?(input: string): any;
}

export function createTrustedTypesPolicy<Options extends ITrustedTypePolicyOptions>(
  policyName: string,
  policyOptions?: Options,
  // @ts-ignore
): undefined | Pick<ITrustedTypePolicy<Options>, 'name' | Extract<keyof Options, keyof ITrustedTypePolicyOptions>> {
  interface IMonacoEnvironment {
    // @ts-ignore
    createTrustedTypesPolicy<Options extends ITrustedTypePolicyOptions>(
      policyName: string,
      policyOptions?: Options,
      // @ts-ignore
    ): undefined | Pick<TrustedTypePolicy<Options>, 'name' | Extract<keyof Options, keyof ITrustedTypePolicyOptions>>;
  }
  const monacoEnvironment: IMonacoEnvironment | undefined = (globalThis as any).MonacoEnvironment;

  if (monacoEnvironment?.createTrustedTypesPolicy) {
    try {
      return monacoEnvironment.createTrustedTypesPolicy(policyName, policyOptions);
    } catch (err) {
      onUnexpectedError(err);
      return undefined;
    }
  }
  try {
    return (globalThis as any).trustedTypes?.createPolicy(policyName, policyOptions);
  } catch (err) {
    onUnexpectedError(err);
    return undefined;
  }
}
