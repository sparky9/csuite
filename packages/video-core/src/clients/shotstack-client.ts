import axios, { AxiosInstance } from 'axios';
import type { VideoComposition, CompositionElement } from '../types.js';

export interface ShotstackConfig {
  apiKey: string;
  environment?: 'stage' | 'production';
}

interface ShotstackRenderResponse {
  success: boolean;
  message: string;
  response: {
    id: string;
    message: string;
  };
}

interface ShotstackStatusResponse {
  success: boolean;
  message: string;
  response: {
    id: string;
    status: 'queued' | 'fetching' | 'rendering' | 'saving' | 'done' | 'failed';
    url?: string;
    error?: string;
    duration?: number;
    renderTime?: number;
  };
}

export class ShotstackClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(config: ShotstackConfig) {
    const env = config.environment || 'stage';
    this.baseUrl = `https://api.shotstack.io/${env}`;

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  async renderVideo(composition: VideoComposition): Promise<{ renderId: string }> {
    const payload = this.convertToShotstackFormat(composition);

    const response = await this.client.post<ShotstackRenderResponse>(
      '/render',
      payload
    );

    if (!response.data.success) {
      throw new Error(`Render failed: ${response.data.message}`);
    }

    return { renderId: response.data.response.id };
  }

  async getRenderStatus(renderId: string): Promise<{
    status: string;
    url?: string;
    error?: string;
    progress?: number;
  }> {
    const response = await this.client.get<ShotstackStatusResponse>(
      `/render/${renderId}`
    );

    if (!response.data.success) {
      throw new Error(`Status check failed: ${response.data.message}`);
    }

    const data = response.data.response;

    // Calculate approximate progress
    let progress = 0;
    switch (data.status) {
      case 'queued':
        progress = 10;
        break;
      case 'fetching':
        progress = 25;
        break;
      case 'rendering':
        progress = 50;
        break;
      case 'saving':
        progress = 90;
        break;
      case 'done':
        progress = 100;
        break;
      case 'failed':
        progress = 0;
        break;
    }

    return {
      status: data.status,
      url: data.url,
      error: data.error,
      progress,
    };
  }

  async waitForRender(
    renderId: string,
    maxWaitMs: number = 600000
  ): Promise<string> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.getRenderStatus(renderId);

      if (status.status === 'done' && status.url) {
        return status.url;
      }

      if (status.status === 'failed') {
        throw new Error(`Render failed: ${status.error || 'Unknown error'}`);
      }

      // Wait 3 seconds before polling again
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    throw new Error('Render timeout');
  }

  private convertToShotstackFormat(composition: VideoComposition): any {
    const { timeline, output } = composition;

    // Convert our composition format to Shotstack's format
    const tracks = timeline.tracks.map((track) => ({
      clips: track.map((element) => this.convertElement(element)),
    }));

    return {
      timeline: {
        background: timeline.background || '#000000',
        tracks,
      },
      output: {
        format: output.format,
        resolution: output.resolution,
        fps: output.fps || 30,
        quality: output.quality || 'medium',
      },
    };
  }

  private convertElement(element: CompositionElement): any {
    switch (element.type) {
      case 'video':
        return {
          asset: {
            type: 'video',
            src: element.src,
            volume: element.volume ?? 1,
          },
          start: element.start,
          length: element.length,
          offset: element.offset,
          transition: element.transition,
        };

      case 'image':
        return {
          asset: {
            type: 'image',
            src: element.src,
          },
          start: element.start,
          length: element.length,
          transition: element.transition,
        };

      case 'audio':
        return {
          asset: {
            type: 'audio',
            src: element.src,
            volume: element.volume ?? 1,
            effect: element.effect,
          },
          start: element.start,
          length: element.length,
        };

      case 'text':
        return {
          asset: {
            type: 'html',
            html: `<p style="font-size: ${element.style?.fontSize || '48px'}; font-family: ${element.style?.fontFamily || 'Arial'}; color: ${element.style?.color || '#FFFFFF'}; background-color: ${element.style?.backgroundColor || 'transparent'};">${element.text}</p>`,
            css: '',
            width: 1920,
            height: 1080,
            position: element.position?.x || 'center',
          },
          start: element.start,
          length: element.length,
        };

      default:
        throw new Error(`Unknown element type: ${(element as any).type}`);
    }
  }

  async createCaptionedVideo(
    videoUrl: string,
    captions: Array<{ text: string; start: number; end: number }>,
    style?: any
  ): Promise<{ renderId: string }> {
    const captionClips = captions.map((caption) => ({
      asset: {
        type: 'html',
        html: `<p style="font-size: ${style?.fontSize || '48px'}; font-family: ${style?.fontFamily || 'Arial'}; color: ${style?.color || '#FFFFFF'}; background-color: ${style?.backgroundColor || 'rgba(0,0,0,0.7)'}; padding: 10px; text-align: center;">${caption.text}</p>`,
        css: '',
        width: 1920,
        height: 200,
        position: style?.position || 'bottom',
      },
      start: caption.start / 1000, // Convert ms to seconds
      length: (caption.end - caption.start) / 1000,
    }));

    const payload = {
      timeline: {
        background: '#000000',
        tracks: [
          {
            clips: [
              {
                asset: {
                  type: 'video',
                  src: videoUrl,
                },
                start: 0,
                length: 'auto',
              },
            ],
          },
          {
            clips: captionClips,
          },
        ],
      },
      output: {
        format: 'mp4',
        resolution: 'hd',
      },
    };

    const response = await this.client.post<ShotstackRenderResponse>(
      '/render',
      payload
    );

    if (!response.data.success) {
      throw new Error(`Caption render failed: ${response.data.message}`);
    }

    return { renderId: response.data.response.id };
  }
}
