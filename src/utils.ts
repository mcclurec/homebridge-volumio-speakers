import { Logger } from 'homebridge';

export function socketManagement(socket: SocketIOClient.Socket, logger: Logger): void {
  socket.on('connect', () => {
    logger.info('Socket connected:', socket.io.uri);
  });
  socket.on('reconnect_attempt', (attemptNumber: number) => {
    logger.info('Socket reconnecting... Attempt:', attemptNumber);
  });
  socket.on('disconnect', (reason: string) => {
    logger.warn('Socket disconnected:', reason);
  });
  socket.on('connect_error', (err: Error) => {
    logger.error('Socket connection error:', err.message);
  });
  socket.on('reconnect_error', (err: Error) => {
    logger.error('Socket reconnection error:', err.message);
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
  volume = Math.min(volume, 100);
  volume = Math.max(volume, 0);
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

export interface VolumioAPIMultiroom {
  misc: {
    debug: boolean,
  },
  list: VolumioAPIZoneState[],
}

export enum VolumioAPIStatus {
  PLAY = 'play',
  PAUSE = 'pause',
  STOP = 'stop',
}