import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicEventTypes,
} from 'homebridge';
import { PluginPlatform } from './platform';
import { 
  volumeClamp,
  VolumioAPIState,
  VolumioAPIStatus,
} from './utils';
import io from 'socket.io-client';

interface ZoneState {
  status: CharacteristicValue,
  volume: number,
  muted: boolean,
}

/**
 * Volumio Speakers Platform Accessory.
 */
export class PluginPlatformAccessory {
  private service: Service;
  private socket: SocketIOClient.Socket;
  private zoneState: ZoneState;

  constructor(
    private readonly platform: PluginPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.zoneState = {
      status: this.platform.Characteristic.CurrentMediaState.PAUSE,
      volume: 0,
      muted: false,
    };

    // Set up socket connection
    const zone = this.accessory.context.zone;
    if (!zone.host) {
      this.platform.log.error(`Could not set up socket for Zone. No host info: ${this.accessory.context}`);
    }
    this.socket = io.connect(`${zone.host}:3000`);
    this.socketManagement();

    // Get initial state and listen for updates
    this.socket.emit('getState', '');
    this.socket.on('pushState', this.updateZoneState.bind(this));


    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Volumio')
      .setCharacteristic(this.platform.Characteristic.Model, 'Zone')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.accessory.context.zone.id);

    this.service =
        this.accessory.getService(this.platform.Service.SmartSpeaker)
        || this.accessory.addService(this.platform.Service.SmartSpeaker);

    // Allows name to show when adding speaker.
    this.service.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.accessory.displayName);

    // Event handlers for CurrentMediaState and TargetMediaState Characteristics.
    this.service.getCharacteristic(this.platform.Characteristic.CurrentMediaState)
      .on(CharacteristicEventTypes.GET, this.getTargetMediaState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.TargetMediaState)
      .on(CharacteristicEventTypes.SET, this.setTargetMediaState.bind(this))
      .on(CharacteristicEventTypes.GET, this.getTargetMediaState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.Volume)
      .on(CharacteristicEventTypes.SET, this.setVolume.bind(this))
      .on(CharacteristicEventTypes.GET, this.getVolume.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.Mute)
      .on(CharacteristicEventTypes.SET, this.setMute.bind(this))
      .on(CharacteristicEventTypes.GET, this.getMute.bind(this));
  }

  socketManagement(): void {
    const zone = this.accessory.context.zone;
    this.socket.on('connect', () => {
      this.platform.log.info(`Zone socket connected: ${zone.name}`);
    });
    this.socket.on('reconnect', () => {
      this.platform.log.info(`Zone socket reconnected: ${zone.name}`);
    });
    this.socket.on('disconnect', () => {
      this.platform.log.info(`Zone socket disconnected: ${zone.name}`);
    });
    this.socket.on('connect_error', () => {
      this.platform.log.error(`Zone socket connection error: ${zone.name}`);
    });
    this.socket.on('reconnect_failed', () => {
      this.platform.log.error(`Zone socket reconnection failed: ${zone.name}`);
    });
  }

  /**
   * Update local and Homebridge data from socket publish
   */
  updateZoneState(data: VolumioAPIState): void {
    this.platform.log.debug(`Recieved socket publish: ${JSON.stringify(data)}`);
    const convertedData = this.convertVolumioAPIStateToZoneState(data);
    
    this.platform.log.info(`Converted Data: ${JSON.stringify(convertedData)}`);
    this.platform.log.info(`Current state: ${JSON.stringify(this.zoneState)}`);
    
    // Only update if returned data is different than current stored state
    if (convertedData.status !== this.zoneState.status) {
      this.platform.log.info('Updating status');
      this.zoneState.status = convertedData.status;
      this.service.getCharacteristic(this.platform.Characteristic.CurrentMediaState).updateValue(this.zoneState.status);
    }
    if (convertedData.volume !== this.zoneState.volume) {
      this.platform.log.info('Updating volume');
      this.zoneState.volume = convertedData.volume;
      this.service.getCharacteristic(this.platform.Characteristic.Volume).updateValue(this.zoneState.volume);
    }
    if (convertedData.muted !== this.zoneState.muted) {
      this.platform.log.info('Updating muted');
      this.zoneState.muted = convertedData.muted;
      this.service.getCharacteristic(this.platform.Characteristic.Mute).updateValue(this.zoneState.muted);
    }
  }

  /**
 * Get the targetMediaState.
 */
  getTargetMediaState(callback: CharacteristicGetCallback) {
    this.platform.log.info('GET TargetMediaState:', this.zoneState.status);
    callback(undefined, this.zoneState.status);
  }

  /**
 * Set the targetMediaState.
 * Toggle play/pause
 */
  setTargetMediaState(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.platform.log.info('SET TargetMediaState:', value);

    this.zoneState.status = value;

    const convertedState = this.convertCharacteristicValueToVolumioStatus(this.zoneState.status);
    this.socket.emit(convertedState);

    callback(undefined, this.zoneState.status);

    this.service.getCharacteristic(this.platform.Characteristic.CurrentMediaState).updateValue(this.zoneState.status);
  }

  /**
 * Get the Volume.
 */
  getVolume(callback: CharacteristicGetCallback) {
    this.platform.log.info('GET Volume:', this.zoneState.volume);
    callback(undefined, this.zoneState.volume);
  }

  /**
   * Set the Volume.
   */
  setVolume(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.platform.log.info('SET Volume:', value);

    this.zoneState.volume = volumeClamp(<number>value);

    this.socket.emit('volume', this.zoneState.volume);

    callback(undefined, this.zoneState.volume);
  }

  /**
 * Get the Mute state.
 */
  getMute(callback: CharacteristicGetCallback) {
    this.platform.log.info('GET Muted:', this.zoneState.muted);
    callback(undefined, this.zoneState.muted);
  }

  /**
   * Set the Volume.
   */
  setMute(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.platform.log.info('SET Mute:', value);

    this.zoneState.muted = <boolean>value;

    const convertedMute = this.zoneState.muted ? 'mute' : 'unmute';
    this.socket.emit(convertedMute, '');

    callback(undefined, this.zoneState.muted);
  }

  convertVolumioAPIStateToZoneState(data: VolumioAPIState): ZoneState {
    const convertedData: ZoneState = {
      status: this.convertVolumioStatusToCharacteristicValue(data.status),
      volume: data.volume,
      muted: data.mute,
    };

    return convertedData;
  }

  /**
  * Map VolumioAPIStatus -> CharacteristicValue
  */
  convertVolumioStatusToCharacteristicValue(status: VolumioAPIStatus): CharacteristicValue {
    // These are the state strings returned by Volumio
    switch (status) {
      case VolumioAPIStatus.PLAY:
        return this.platform.Characteristic.CurrentMediaState.PLAY;
      case VolumioAPIStatus.PAUSE:
        return this.platform.Characteristic.CurrentMediaState.PAUSE;
      case VolumioAPIStatus.STOP:
      default:
        return this.platform.Characteristic.CurrentMediaState.STOP;
    }
  }
  
  /**
  * Map CharacteristicValue -> VolumioAPIStatus
  */
  convertCharacteristicValueToVolumioStatus(status: CharacteristicValue): VolumioAPIStatus {
    // These are the state strings returned by Volumio
    switch (status) {
      case this.platform.Characteristic.CurrentMediaState.PLAY:
        return VolumioAPIStatus.PLAY;
      case this.platform.Characteristic.CurrentMediaState.PAUSE:
        return VolumioAPIStatus.PAUSE;
      case this.platform.Characteristic.CurrentMediaState.STOP:
      default:
        return VolumioAPIStatus.STOP;
    }
  }
}
