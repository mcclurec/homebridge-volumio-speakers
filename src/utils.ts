import { Logger } from 'homebridge';

export const DefaultWebsocketPort = 3000;

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
    logger.error('Socket connection error:', socket.io.uri, err);
  });
  socket.on('reconnect_error', (err: Error) => {
    logger.error('Socket reconnection error:', err);
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
  mute: boolean;
  status: VolumioAPIStatus;
  volume: number;
  album?: string;
  albumart?: string;
  artist?: string;
  bitdepth?: string;
  channels?: number;
  consume?: boolean;
  disableVolumeControl?: boolean;
  duration?: number;
  position?: number;
  random?: boolean;
  repeat?: boolean;
  repeatSingle?: boolean;
  samplerate?: string;
  seek?: number;
  service?: string;
  stream?: string | boolean;
  title?: string;
  trackType?: string;
  updatedb?: boolean;
  uri?: string;
  volatile?: boolean;
}

export interface VolumioAPIZoneState {
  id: string;
  host: string;
  isSelf: boolean;
  name: string;
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