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
  public readonly accessories: PlatformAccessory[] = [];

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
    const socketURL = this.config.serverURL;
    if (!socketURL) {
      this.log.error('Could not set up socket for Platform. serverURL not set in config:', this.config.serverURL);
    }
    this.socket = io.connect(`${socketURL}:3000`);
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
    data.list.forEach(zone => {
      // Clean up data before saving to disk
      delete zone.state;
      zone.name = prettifyDisplayName(zone.name);
      
      // Add new zone
      const matchedAccessory = this.accessories.find(accessory => accessory.UUID === zone.id);
      if (!matchedAccessory) {
        this.addAccessory(zone);
      }

      if (matchedAccessory && matchedAccessory?.displayName !== zone.name) {
        // update name
      }
      if (matchedAccessory && matchedAccessory?.context?.zone.host !== zone.host) {
        // update host
      }
    });

    // Remove old zones
    // No way to delete external accessories
  }

  /**
   * Publish external accessory from Volumio Zone data
   */
  addAccessory(zone: VolumioAPIZoneState) {
    const accessory = new this.api.platformAccessory(zone.name, zone.id);
    // Store raw data
    accessory.context.zone = zone;

    // Adding 26 as the category is some special sauce that gets this to work properly.
    // @see https://github.com/homebridge/homebridge/issues/2553#issuecomment-623675893
    accessory.category = 26;

    new PluginPlatformAccessory(this, accessory);

    this.accessories.push(accessory);

    // SmartSpeaker service must be added as an external accessory.
    // @see https://github.com/homebridge/homebridge/issues/2553#issuecomment-622961035
    // There a no collision issues when calling this multiple times on accessories that already exist.
    this.api.publishExternalAccessories(PLUGIN_NAME, [accessory]);
    this.log.info(zone.name, 'added');
  }    

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * We don't actually restore any accessories, because each speaker is added as an External accessory
   * so this won't ever get called.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

}
