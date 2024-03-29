import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicEventTypes,
  Logger,
} from 'homebridge';
import { PluginPlatform } from './platform';
import {
  DefaultWebsocketPort,
  socketManagement,
  volumeClamp,
  VolumioAPIState,
  VolumioAPIStatus,
} from './utils';
import io from 'socket.io-client';

interface ZoneState {
  status: CharacteristicValue,
  volume: number,
  muted: boolean,
  isStream: boolean,
}

/**
 * Volumio Speakers Platform Accessory
 */
export class PluginPlatformAccessory {
  private service: Service;
  private socket: SocketIOClient.Socket;
  private zoneState: ZoneState;
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

    this.zoneState = {
      status: this.platform.Characteristic.CurrentMediaState.PAUSE,
      volume: 0,
      muted: false,
      isStream: false,
    };

    // Set up socket connection
    const host = this.accessory.context.host;
    this.socket = io.connect(`${host}:${this.platform.config.serverPort || DefaultWebsocketPort}`);
    socketManagement(this.socket, this.log);

    // Get initial state and listen for updates
    this.socket.on('pushState', this.updateZoneState.bind(this));
    this.socket.emit('getState', '');


    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Volumio')
      .setCharacteristic(this.platform.Characteristic.Model, 'Zone')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.accessory.UUID);

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
    this.service.getCharacteristic(this.platform.Characteristic.ConfiguredName).updateValue(this.accessory.displayName);
  }

  /**
   * Update local and Homebridge data from socket publish
   */
  updateZoneState(data: VolumioAPIState): void {
    this.log.debug('Recieved socket publish:', JSON.stringify(data));
    const convertedData = this.convertVolumioAPIStateToZoneState(data);
    
    this.log.debug('Converted Data:', JSON.stringify(convertedData));
    this.log.debug('Current state:', JSON.stringify(this.zoneState));
    
    if (convertedData.isStream !== this.zoneState.isStream) {
      this.log.debug('Updating isStream');
      this.zoneState.isStream = convertedData.isStream;
    }

    // Only update if returned data is different than current stored state
    if (convertedData.status !== this.zoneState.status) {
      this.log.debug('Updating status');
      this.zoneState.status = convertedData.status;
      this.service.getCharacteristic(this.platform.Characteristic.CurrentMediaState).updateValue(this.zoneState.status);
    }
    if (convertedData.volume !== this.zoneState.volume) {
      this.log.debug('Updating volume');
      this.zoneState.volume = convertedData.volume;
      this.service.getCharacteristic(this.platform.Characteristic.Volume).updateValue(this.zoneState.volume);
    }
    if (convertedData.muted !== this.zoneState.muted) {
      this.log.debug('Updating muted');
      this.zoneState.muted = convertedData.muted;
      this.service.getCharacteristic(this.platform.Characteristic.Mute).updateValue(this.zoneState.muted);
    }
  }

  /**
   * Get the targetMediaState
   */
  getTargetMediaState(callback: CharacteristicGetCallback): void {
    this.log.debug('GET TargetMediaState:', this.zoneState.status);
    callback(undefined, this.zoneState.status);
  }

  /**
   * Set the targetMediaState
   * Toggle play/pause
   */
  setTargetMediaState(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    this.log.debug('SET TargetMediaState:', value);

    this.zoneState.status = value;

    let convertedStateStatus = this.convertCharacteristicValueToVolumioStatus(this.zoneState.status);
          
    // Replace Pause to Stop if playing webradio since Volumio doesn't handle pausing radio playbeck very well
    this.log.debug('SET TargetMediaState: this.zoneState.isStream is', this.zoneState.isStream);
    this.log.debug('SET TargetMediaState: this.zoneState.status is', this.zoneState.status);
    if (this.zoneState.isStream && this.zoneState.status === this.platform.Characteristic.CurrentMediaState.PAUSE) {
      this.log.info('Looks like this is webradio. sending STOP instead of PAUSE');
      convertedStateStatus = VolumioAPIStatus.STOP;
      this.zoneState.status = this.platform.Characteristic.CurrentMediaState.STOP;
    }

    this.socket.emit(convertedStateStatus);

    callback(undefined, this.zoneState.status);

    this.service.getCharacteristic(this.platform.Characteristic.CurrentMediaState).updateValue(this.zoneState.status);
  }

  /**
   * Get the Volume
   */
  getVolume(callback: CharacteristicGetCallback): void {
    this.log.debug('GET Volume:', this.zoneState.volume);
    callback(undefined, this.zoneState.volume);
  }

  /**
   * Set the Volume
   */
  setVolume(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    this.log.debug('SET Volume:', value);

    this.zoneState.volume = volumeClamp(<number>value);

    this.socket.emit('volume', this.zoneState.volume);

    callback(undefined, this.zoneState.volume);
  }

  /**
   * Get the Mute state
   */
  getMute(callback: CharacteristicGetCallback): void {
    this.log.debug('GET Muted:', this.zoneState.muted);
    callback(undefined, this.zoneState.muted);
  }

  /**
   * Set the Volume
   */
  setMute(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    this.log.debug('SET Mute:', value);

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
      isStream: this.convertVolumioStreamValueToBool(data?.stream),
    };

    return convertedData;
  }

  /**
   * Map VolumioAPI's stream property to a bool. Annoyingly, the value is either a bool or a string
   */
  convertVolumioStreamValueToBool(value: string | boolean | undefined): boolean {
    let convertedBool = false;
    if (typeof value === 'boolean') {
      convertedBool = value;
    }
    if (typeof value === 'string') {
      convertedBool = true;
    }
    return convertedBool;
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