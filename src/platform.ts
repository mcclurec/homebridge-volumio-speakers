import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from 'homebridge';
import io from 'socket.io-client';
import { PLUGIN_NAME } from './settings';
import { PluginPlatformAccessory } from './platformAccessory';
import {
  DefaultWebsocketPort,
  prettifyDisplayName,
  socketManagement,
  VolumioAPIMultiroom,
  VolumioAPIZoneState,
} from './utils';

/**
 * Volumio Speakers Platform.
 */
export class PluginPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // This is used to track restored cached accessories
  public readonly accessories: { [key: string]: PluginPlatformAccessory } = {};

  private socket: SocketIOClient.Socket;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.config = {
      ...config,
    };

    // Set up socket connection
    if (!this.config.serverURL) {
      this.log.error('Could not set up socket for Platform. serverURL not set in config:', this.config.serverURL);
    }
    this.socket = io.connect(`${this.config.serverURL}:${this.config.serverPort || DefaultWebsocketPort}`);
    socketManagement(this.socket, this.log);

    // Get initial state and listen for updates
    this.log.info('Discovering Volumio zones...');
    this.socket.on('pushMultiRoomDevices', this.discoverZones.bind(this));
    this.socket.emit('getMultiRoomDevices', '');

    this.api.on('didFinishLaunching', () => {
      this.log.info('Finished initializing platform');
    });
  }

  /**
 * Use the getMultiRoomDevices event to retrieve all zones
 * @see https://volumio.github.io/docs/API/WebSocket_APIs.html
 */
  discoverZones(data: VolumioAPIMultiroom) {
    try {
      data.list.forEach(zone => {
        this.log.debug('Recieved zone data:', JSON.stringify(zone));
        this.log.debug('Current stored zones:', this.accessories);
        const accessoryUUID = this.api.hap.uuid.generate(zone.id);
        const matchedAccessory = this.accessories[accessoryUUID];
        // Add new zone if it doesn't exist yet
        if (!matchedAccessory) {
          this.addAccessory(zone);
          return;
        }

        // Update name if changed in Volumio
        const prettyZoneName = prettifyDisplayName(zone.name);
        this.log.debug('Incoming zone name:', zone.name);
        this.log.debug('Incoming zone pretty name:', prettyZoneName);
        this.log.debug('Stored zone name:', matchedAccessory.accessory.displayName);
        if (matchedAccessory.accessory.displayName !== prettyZoneName) {
          matchedAccessory.updateDisplayName(prettyZoneName);
        }

        // Update host if changed in Volumio
        this.log.debug('Incoming zone host:', zone.host);
        this.log.debug('Stored zone host:', matchedAccessory.accessory.context.host);
        if (matchedAccessory.accessory.context.host !== zone.host) {
          matchedAccessory.updateHost(zone.host);
        }
      });

      // Remove old zones
      // No way to delete external accessories
    } catch (err) {
      this.log.error('Fatal:', err);
    }
  }

  /**
   * Publish external accessory from Volumio Zone data
   */
  addAccessory(zone: VolumioAPIZoneState) {
    const displayName = prettifyDisplayName(zone.name);
    const accessoryUUID = this.api.hap.uuid.generate(zone.id);
    const accessory = new this.api.platformAccessory(displayName, accessoryUUID);
    
    // Adding 26 as the category is some special sauce that gets this to work properly.
    // @see https://github.com/homebridge/homebridge/issues/2553#issuecomment-623675893
    accessory.category = 26;

    // Store host IP
    accessory.context.host = zone.host;
    if (!zone.host) {
      this.log.error('Could not create accessory from Zone. No host info:', JSON.stringify(zone));
      return; 
    }

    const pluginAccessory = new PluginPlatformAccessory(this, accessory);
    this.accessories[accessory.UUID] = pluginAccessory;

    // SmartSpeaker service must be added as an external accessory.
    // @see https://github.com/homebridge/homebridge/issues/2553#issuecomment-622961035
    // There a no collision issues when calling this multiple times on accessories that already exist.
    this.api.publishExternalAccessories(PLUGIN_NAME, [accessory]);
    this.log.info(accessory.displayName, 'added');
  }    

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * We don't actually restore any accessories, because each speaker is added as an External accessory
   * so this won't ever get called.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Volumio accessories are external: Skipping...:', accessory.displayName);
  }
}
