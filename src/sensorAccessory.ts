import {
  Service,
  PlatformAccessory,
  CharacteristicGetCallback,
  CharacteristicEventTypes,
  Logger,
} from 'homebridge';
import { PluginPlatform } from './platform';
import {
  DefaultWebsocketPort,
  socketManagement,
  VolumioAPIState,
  VolumioAPIStatus,
} from './utils';
import io from 'socket.io-client';

/**
 * Volumio Speakers Sensor Accessory
 */
export class PluginSensorAccessory {
  private service: Service;
  private socket: SocketIOClient.Socket;
  private sensorState: boolean;
  private log: Logger;

  constructor(
    private readonly platform: PluginPlatform,
    public readonly accessory: PlatformAccessory,
  ) {
    const logPrefix = `${this.accessory.displayName}:`;
    this.log = <Logger>{
      info: (...args) => this.platform.log.info(logPrefix, ...args),
      debug: (...args) => this.platform.log.debug(logPrefix, ...args),
      warn: (...args) => this.platform.log.warn(logPrefix, ...args),
      error: (...args) => this.platform.log.error(logPrefix, ...args),
    };

    this.sensorState = false;

    // Set up socket connection
    const host = this.accessory.context.host;
    this.socket = io.connect(`${host}:${this.platform.config.serverPort || DefaultWebsocketPort}`);
    socketManagement(this.socket, this.log);

    // Get initial state and listen for updates
    this.socket.on('pushState', this.updateZoneState.bind(this));
    this.socket.emit('getState', '');


    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Volumio')
      .setCharacteristic(this.platform.Characteristic.Model, 'Zone Dummy Sensor')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.accessory.UUID);

    this.service =
        this.accessory.getService(this.platform.Service.ContactSensor)
        || this.accessory.addService(this.platform.Service.ContactSensor);

    // Allows name to show when adding speaker.
    this.service.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.displayName);

    // Event handlers for CurrentMediaState and TargetMediaState Characteristics.
    this.service.getCharacteristic(this.platform.Characteristic.ContactSensorState)
      .on(CharacteristicEventTypes.GET, this.getContactSensorState.bind(this));
  }

  /**
   * Update zone host if network condition changes
   */
  public updateHost(host: string): void {
    this.log.info('Updating host IP to:', host);
    this.accessory.context.host = host;
    
    // Do socket disconnect/reconnect
    this.socket.off('pushState');
    this.socket.disconnect();

    this.socket = io.connect(`${host}:${this.platform.config.serverPort || DefaultWebsocketPort}`);
    socketManagement(this.socket, this.log);

    // Get initial state and listen for updates
    this.socket.on('pushState', this.updateZoneState.bind(this));
    this.socket.emit('getState', '');
  }

  /**
   * Update display name shown in Homekit
   */
  public updateDisplayName(name: string): void {
    this.log.info('Updating display name to:', name);
    this.accessory.displayName = name;
    this.service.getCharacteristic(this.platform.Characteristic.Name).updateValue(this.accessory.displayName);
  }

  /**
   * Update local and Homebridge data from socket publish
   */
  updateZoneState(data: VolumioAPIState): void {
    this.log.debug('Recieved socket publish:', JSON.stringify(data));
    const convertedData = this.convertVolumioAPIStateToSensorState(data);
    
    this.log.debug('Converted Data:', JSON.stringify(convertedData));
    this.log.debug('Current state:', JSON.stringify(this.sensorState));
    
    // Only update if returned data is different than current stored state
    if (convertedData !== this.sensorState) {
      this.log.debug('Updating sensor state');
      this.sensorState = convertedData;
      this.service.getCharacteristic(this.platform.Characteristic.ContactSensorState).updateValue(this.sensorState);
    }
  }

  /**
   * Get the targetMediaState
   */
  getContactSensorState(callback: CharacteristicGetCallback): void {
    this.log.debug('GET ContactSensorState:', this.sensorState);
    callback(undefined, this.sensorState);
  }

  /**
   * Map VolumioAPIStatus to sesnor status bool
   */
  convertVolumioAPIStateToSensorState(data: VolumioAPIState): boolean {
    return data.status === VolumioAPIStatus.PLAY;
  }
}