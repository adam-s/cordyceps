import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { Disposable } from 'vs/base/common/lifecycle';
import { getSingletonServiceDescriptors } from 'vs/platform/instantiation/common/extensions';
import { ILogService } from '@shared/services/log.service';

/**
 * Interface representing the configuration for the server application.
 * This can be extended with specific configuration options as needed.
 */
export interface IServerConfiguration {}

/**
 * Main class representing the Server Application.
 * Extends the Disposable class, ensuring proper cleanup and lifecycle management.
 */
export class ServerApp extends Disposable {
  /**
   * Constructor for the ServerApp.
   * @param configuration - The configuration object for the server application.
   * This is passed in at the time of instantiation.
   */
  constructor(private readonly configuration: IServerConfiguration) {
    super(); // Calls the Disposable constructor to manage resource cleanup.
  }

  /**
   * Main entry point to start the ServerApp instance.
   * Since constructors cannot be async, this method is called explicitly after creating the instance.
   * It sets up listeners and services.
   */
  async start() {
    // First, register listeners to ensure the app can handle incoming events before initializing services.
    await this.registerListeners();

    // Initialize services, which include any contributed or singleton services used throughout the app.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const instantiationService = await this.initServices();
  }

  /**
   * Placeholder for registering listeners that the server application may require.
   * This method should be overridden to add specific event listeners.
   */
  async registerListeners() {}

  /**
   * Initializes the service layer for the server application. This method:
   * - Sets up the service collection, registering all contributed services.
   * - Instantiates the services via the InstantiationService.
   * - Accesses the ILogService and registers it for logging purposes.
   * @returns {InstantiationService} - The initialized instantiation service with registered services.
   */
  async initServices() {
    // Create a new ServiceCollection, which acts as a container for service registrations.
    const serviceCollection = new ServiceCollection();

    // Retrieve all contributed singleton services from the platform.
    const contributedServices = getSingletonServiceDescriptors();

    // Loop through the contributed services and register them into the service collection.
    for (const [id, descriptor] of contributedServices) {
      serviceCollection.set(id, descriptor);
    }

    // Instantiate the services using the InstantiationService.
    // The second parameter (true) allows the service collection to create instances eagerly.
    const instantiationService = new InstantiationService(
      serviceCollection,
      true,
    );

    // Invoke a function that can access the registered services.
    instantiationService.invokeFunction(accessor => {
      // Retrieve the ILogService from the accessor to initialize logging capabilities.
      const logService = accessor.get(ILogService);

      // Ensure the ILogService is available in the service collection for global use.
      serviceCollection.set(ILogService, logService);
    });

    // Return the initialized instantiation service to be used elsewhere in the application.
    return instantiationService;
  }
}
