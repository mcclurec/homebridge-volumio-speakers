import { Logger } from 'homebridge';

export function socketManagement(socket: SocketIOClient.Socket, logger: Logger): void {
  socket.on('connect', () => {
    logger.info('Socket connected');
  });
  socket.on('reconnect', () => {
    logger.info('Socket reconnected');
  });
  socket.on('disconnect', () => {
    logger.warn('Socket disconnected');
  });
  socket.on('connect_error', () => {
    logger.error('Socket connection error');
  });
  socket.on('reconnect_failed', () => {
    logger.error('Socket reconnection failed');
  });
}

export function prettifyDisplayName(name: string): string {
  const wordArray = name.toLowerCase().split('-');
  for (let i = 0; i < wordArray.length; i++) {
    wordArray[i] = wordArray[i][0].toUpperCase() + wordArray[i].slice(1);
  }
  return wordArray.join(' ');
}

export function volumeClamp(volume: number): number {
  volume = Math.round(volume);
  volume = Math.min(volume, 0);
  volume = Math.max(volume, 100);
  return volume;
}

export interface VolumioAPIState {
  status: VolumioAPIStatus;
  position?: number;
  title?: string;
  artist?: string;
  album?: string;
  albumart?: string;
  uri?: string;
  trackType?: string;
  seek?: number;
  duration?: number;
  samplerate?: string;
  bitdepth?: string;
  channels?: number;
  random?: boolean;
  repeat?: boolean;
  repeatSingle?: boolean;
  consume?: boolean;
  volume: number;
  disableVolumeControl?: boolean;
  mute: boolean;
  stream?: string;
  updatedb?: boolean;
  volatile?: boolean;
  service?: string;
}

export interface VolumioAPIZoneState {
  id: string;
  host: string;
  name: string;
  isSelf: boolean;
  state?: VolumioAPIState;
}

// export interface VolumioAPIZoneStates {
//   zones: VolumioAPIZoneState[];
// }

export interface VolumioAPIMultiroom {
  misc: {
    debug: boolean,
  },
  list: VolumioAPIZoneState[],
}

// export interface VolumioAPICommandResponse {
//   time: number;
//   response: string;
// }

// export interface GetVolumioAPIData<T> {
//   error: Error | null;
//   data?: T;
// }

export enum VolumioAPIStatus {
  PLAY = 'play',
  PAUSE = 'pause',
  STOP = 'stop',
}