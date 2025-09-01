import { LogLine } from '../../types/log';
import { BaseCache, CacheEntry } from './BaseCache';
import { ILocalAsyncStorage } from '@shared/storage/localAsyncStorage/localAsyncStorage.service';
import { SidePanelAppStorageSchema } from '@shared/storage/types/storage.types';

interface StagehandCacheStorageSchema extends SidePanelAppStorageSchema {
  [key: string]: unknown;
}

export interface PlaywrightCommand {
  method: string;
  args: string[];
}

export interface ActionEntry extends CacheEntry {
  data: {
    playwrightCommand: PlaywrightCommand;
    componentString: string;
    xpaths: string[];
    newStepString: string;
    completed: boolean;
    previousSelectors: string[];
    action: string;
  };
}

/**
 * ActionCache handles logging and retrieving actions along with their Playwright commands.
 */
export class ActionCache extends BaseCache<ActionEntry> {
  constructor(
    logger: (message: LogLine) => void,
    storage: ILocalAsyncStorage<StagehandCacheStorageSchema>,
    cachePrefix?: string
  ) {
    super(logger, storage, cachePrefix || 'action_cache');
  }

  public async addActionStep({
    url,
    action,
    previousSelectors,
    playwrightCommand,
    componentString,
    xpaths,
    newStepString,
    completed,
    requestId,
  }: {
    url: string;
    action: string;
    previousSelectors: string[];
    playwrightCommand: PlaywrightCommand;
    componentString: string;
    requestId: string;
    xpaths: string[];
    newStepString: string;
    completed: boolean;
  }): Promise<void> {
    this.logger({
      category: 'action_cache',
      message: 'adding action step to cache',
      level: 1,
      auxiliary: {
        action: {
          value: action,
          type: 'string',
        },
        requestId: {
          value: requestId,
          type: 'string',
        },
        url: {
          value: url,
          type: 'string',
        },
        previousSelectors: {
          value: JSON.stringify(previousSelectors),
          type: 'object',
        },
      },
    });

    await this.set(
      { url, action, previousSelectors },
      {
        playwrightCommand,
        componentString,
        xpaths,
        newStepString,
        completed,
        previousSelectors,
        action,
      },
      requestId
    );
  }

  /**
   * Retrieves all actions for a specific trajectory.
   * @param trajectoryId - Unique identifier for the trajectory.
   * @param requestId - The identifier for the current request.
   * @returns An array of TrajectoryEntry objects or null if not found.
   */
  public async getActionStep({
    url,
    action,
    previousSelectors,
    requestId,
  }: {
    url: string;
    action: string;
    previousSelectors: string[];
    requestId: string;
  }): Promise<ActionEntry['data'] | null> {
    const data = await super.get({ url, action, previousSelectors }, requestId);
    if (!data) {
      return null;
    }

    return data;
  }

  public async removeActionStep(cacheHashObj: {
    url: string;
    action: string;
    previousSelectors: string[];
    requestId: string;
  }): Promise<void> {
    // Use only the hash key properties that match addActionStep and getActionStep
    const hashKey = {
      url: cacheHashObj.url,
      action: cacheHashObj.action,
      previousSelectors: cacheHashObj.previousSelectors,
    };
    await super.delete(hashKey);
  }

  /**
   * Clears all actions for a specific trajectory.
   * @param trajectoryId - Unique identifier for the trajectory.
   * @param requestId - The identifier for the current request.
   */
  public async clearAction(requestId: string): Promise<void> {
    await super.deleteCacheForRequestId(requestId);
    this.logger({
      category: 'action_cache',
      message: 'cleared action for ID',
      level: 1,
      auxiliary: {
        requestId: {
          value: requestId,
          type: 'string',
        },
      },
    });
  }

  /**
   * Resets the entire action cache.
   */
  public async resetCache(): Promise<void> {
    await super.resetCache();
    this.logger({
      category: 'action_cache',
      message: 'Action cache has been reset.',
      level: 1,
    });
  }
}
