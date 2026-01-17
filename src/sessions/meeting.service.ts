import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface DailyRoomResponse {
  id: string;
  name: string;
  url: string;
  created_at: string;
  config: {
    max_participants?: number;
    enable_recording?: string;
    start_video_off?: boolean;
    start_audio_off?: boolean;
  };
}

interface DailyTokenResponse {
  token: string;
}

interface MeetingRoom {
  roomId: string;
  roomName: string;
  meetingUrl: string;
  provider: 'daily';
}

interface MeetingToken {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class MeetingService {
  private readonly logger = new Logger(MeetingService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.daily.co/v1';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('DAILY_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.warn('DAILY_API_KEY not configured. Meeting features will be disabled.');
    }
  }

  /**
   * Check if Daily.co is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Create a meeting room for a session
   */
  async createRoom(sessionId: string, options?: {
    maxParticipants?: number;
    enableRecording?: boolean;
    expiresInMinutes?: number;
  }): Promise<MeetingRoom> {
    if (!this.isConfigured()) {
      throw new InternalServerErrorException('Meeting service not configured');
    }

    const roomName = `indeen-session-${sessionId}`;
    const expiresAt = options?.expiresInMinutes
      ? Math.floor(Date.now() / 1000) + options.expiresInMinutes * 60
      : Math.floor(Date.now() / 1000) + 24 * 60 * 60; // Default 24 hours

    try {
      const response = await fetch(`${this.baseUrl}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          name: roomName,
          privacy: 'private',
          properties: {
            max_participants: options?.maxParticipants || 2,
            enable_recording: options?.enableRecording ? 'cloud' : 'none',
            start_video_off: false,
            start_audio_off: false,
            enable_screenshare: true,
            enable_chat: true,
            exp: expiresAt,
            eject_at_room_exp: true,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Failed to create Daily.co room: ${error}`);
        throw new InternalServerErrorException('Failed to create meeting room');
      }

      const room = await response.json() as DailyRoomResponse;

      this.logger.log(`Created meeting room: ${room.name}`);

      return {
        roomId: room.id,
        roomName: room.name,
        meetingUrl: room.url,
        provider: 'daily',
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error(`Error creating meeting room: ${error}`);
      throw new InternalServerErrorException('Failed to create meeting room');
    }
  }

  /**
   * Generate a meeting token for a participant
   */
  async generateToken(
    roomName: string,
    options: {
      participantName: string;
      isOwner?: boolean;
      expiresInMinutes?: number;
    },
  ): Promise<MeetingToken> {
    if (!this.isConfigured()) {
      throw new InternalServerErrorException('Meeting service not configured');
    }

    const expiresAt = options.expiresInMinutes
      ? Math.floor(Date.now() / 1000) + options.expiresInMinutes * 60
      : Math.floor(Date.now() / 1000) + 2 * 60 * 60; // Default 2 hours

    try {
      const response = await fetch(`${this.baseUrl}/meeting-tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          properties: {
            room_name: roomName,
            user_name: options.participantName,
            is_owner: options.isOwner || false,
            exp: expiresAt,
            enable_screenshare: true,
            start_video_off: false,
            start_audio_off: false,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Failed to generate meeting token: ${error}`);
        throw new InternalServerErrorException('Failed to generate meeting token');
      }

      const data = await response.json() as DailyTokenResponse;

      return {
        token: data.token,
        expiresAt: new Date(expiresAt * 1000),
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error(`Error generating meeting token: ${error}`);
      throw new InternalServerErrorException('Failed to generate meeting token');
    }
  }

  /**
   * Delete a meeting room
   */
  async deleteRoom(roomName: string): Promise<void> {
    if (!this.isConfigured()) {
      return; // Silently skip if not configured
    }

    try {
      const response = await fetch(`${this.baseUrl}/rooms/${roomName}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok && response.status !== 404) {
        const error = await response.text();
        this.logger.error(`Failed to delete Daily.co room: ${error}`);
      } else {
        this.logger.log(`Deleted meeting room: ${roomName}`);
      }
    } catch (error) {
      this.logger.error(`Error deleting meeting room: ${error}`);
    }
  }

  /**
   * Get room info
   */
  async getRoomInfo(roomName: string): Promise<DailyRoomResponse | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/rooms/${roomName}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json() as DailyRoomResponse;
    } catch (error) {
      this.logger.error(`Error getting room info: ${error}`);
      return null;
    }
  }

  /**
   * Create or get existing room for a session
   */
  async getOrCreateRoom(sessionId: string): Promise<MeetingRoom> {
    const roomName = `indeen-session-${sessionId}`;
    const existingRoom = await this.getRoomInfo(roomName);

    if (existingRoom) {
      return {
        roomId: existingRoom.id,
        roomName: existingRoom.name,
        meetingUrl: existingRoom.url,
        provider: 'daily',
      };
    }

    return this.createRoom(sessionId);
  }
}
