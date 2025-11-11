import { z } from 'zod';

// ============================================================================
// Video Job Types
// ============================================================================

export const VideoJobType = z.enum([
  'transcribe',
  'extract_clips',
  'render',
  'add_captions',
  'optimize',
  'generate_broll',
  'text_to_speech',
  'video_generation',
]);

export type VideoJobType = z.infer<typeof VideoJobType>;

export const VideoJobStatus = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
]);

export type VideoJobStatus = z.infer<typeof VideoJobStatus>;

// ============================================================================
// Transcript Types
// ============================================================================

export interface TranscriptWord {
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export interface TranscriptSentence {
  text: string;
  start: number;
  end: number;
  confidence: number;
  words: TranscriptWord[];
}

export interface SpeakerSegment {
  speaker: string;
  start: number;
  end: number;
  text: string;
  confidence: number;
}

export interface ViralMoment {
  title: string;
  description: string;
  start: number;
  end: number;
  score: number;
  keywords: string[];
  sentiment?: string;
}

export interface TranscriptData {
  id: string;
  text: string;
  words?: TranscriptWord[];
  sentences?: TranscriptSentence[];
  speakers?: SpeakerSegment[];
  viralMoments?: ViralMoment[];
  duration?: number;
  language?: string;
}

// ============================================================================
// Video Composition Types
// ============================================================================

export interface VideoClip {
  type: 'video' | 'image';
  src: string;
  start: number;
  length: number;
  offset?: number;
  volume?: number;
  transition?: {
    in?: string;
    out?: string;
  };
}

export interface AudioClip {
  type: 'audio';
  src: string;
  start: number;
  length: number;
  volume?: number;
  effect?: string;
}

export interface TextOverlay {
  type: 'text';
  text: string;
  start: number;
  length: number;
  position?: {
    x: string;
    y: string;
  };
  style?: {
    fontSize?: string;
    fontFamily?: string;
    color?: string;
    backgroundColor?: string;
  };
}

export type CompositionElement = VideoClip | AudioClip | TextOverlay;

export interface VideoComposition {
  id?: string;
  timeline: {
    background?: string;
    tracks: CompositionElement[][];
  };
  output: {
    format: string;
    resolution: string;
    fps?: number;
    quality?: string;
  };
}

// ============================================================================
// Platform Optimization Types
// ============================================================================

export const PlatformType = z.enum([
  'youtube',
  'tiktok',
  'instagram_story',
  'instagram_feed',
  'instagram_reel',
  'facebook',
  'linkedin',
  'twitter',
  'custom',
]);

export type PlatformType = z.infer<typeof PlatformType>;

export interface PlatformSpec {
  name: string;
  aspectRatio: string;
  resolution: {
    width: number;
    height: number;
  };
  maxDuration?: number;
  maxFileSize?: number;
  format: string;
  fps?: number;
}

export const PLATFORM_SPECS: Record<PlatformType, PlatformSpec> = {
  youtube: {
    name: 'YouTube',
    aspectRatio: '16:9',
    resolution: { width: 1920, height: 1080 },
    format: 'mp4',
    fps: 30,
  },
  tiktok: {
    name: 'TikTok',
    aspectRatio: '9:16',
    resolution: { width: 1080, height: 1920 },
    maxDuration: 180,
    format: 'mp4',
    fps: 30,
  },
  instagram_story: {
    name: 'Instagram Story',
    aspectRatio: '9:16',
    resolution: { width: 1080, height: 1920 },
    maxDuration: 60,
    format: 'mp4',
    fps: 30,
  },
  instagram_feed: {
    name: 'Instagram Feed',
    aspectRatio: '1:1',
    resolution: { width: 1080, height: 1080 },
    maxDuration: 60,
    format: 'mp4',
    fps: 30,
  },
  instagram_reel: {
    name: 'Instagram Reel',
    aspectRatio: '9:16',
    resolution: { width: 1080, height: 1920 },
    maxDuration: 90,
    format: 'mp4',
    fps: 30,
  },
  facebook: {
    name: 'Facebook',
    aspectRatio: '16:9',
    resolution: { width: 1280, height: 720 },
    format: 'mp4',
    fps: 30,
  },
  linkedin: {
    name: 'LinkedIn',
    aspectRatio: '16:9',
    resolution: { width: 1920, height: 1080 },
    maxDuration: 600,
    format: 'mp4',
    fps: 30,
  },
  twitter: {
    name: 'Twitter',
    aspectRatio: '16:9',
    resolution: { width: 1280, height: 720 },
    maxDuration: 140,
    format: 'mp4',
    fps: 30,
  },
  custom: {
    name: 'Custom',
    aspectRatio: '16:9',
    resolution: { width: 1920, height: 1080 },
    format: 'mp4',
    fps: 30,
  },
};

// ============================================================================
// Stock Asset Types
// ============================================================================

export interface StockVideo {
  id: string;
  url: string;
  thumbnailUrl: string;
  duration: number;
  width: number;
  height: number;
  source: 'pexels' | 'unsplash' | 'custom';
  description?: string;
}

export interface StockImage {
  id: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  source: 'pexels' | 'unsplash' | 'custom';
  description?: string;
  photographer?: string;
}

export interface StockAudio {
  id: string;
  url: string;
  previewUrl?: string;
  duration: number;
  source: 'freesound' | 'custom';
  name: string;
  tags?: string[];
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export const TranscribeRequestSchema = z.object({
  url: z.string().url(),
  language: z.string().optional(),
  extractViralMoments: z.boolean().default(true),
  speakerLabels: z.boolean().default(false),
});

export type TranscribeRequest = z.infer<typeof TranscribeRequestSchema>;

export const ExtractClipsRequestSchema = z.object({
  transcriptId: z.string(),
  count: z.number().min(1).max(10).default(3),
  minDuration: z.number().min(5).default(15),
  maxDuration: z.number().min(10).default(60),
});

export type ExtractClipsRequest = z.infer<typeof ExtractClipsRequestSchema>;

export const RenderVideoRequestSchema = z.object({
  composition: z.any(), // VideoComposition schema
  outputFormat: z.string().default('mp4'),
  quality: z.enum(['draft', 'standard', 'high']).default('standard'),
});

export type RenderVideoRequest = z.infer<typeof RenderVideoRequestSchema>;

export const AddCaptionsRequestSchema = z.object({
  videoUrl: z.string().url(),
  transcriptId: z.string(),
  style: z
    .object({
      position: z.enum(['top', 'center', 'bottom']).default('bottom'),
      fontSize: z.string().default('48px'),
      fontFamily: z.string().default('Arial'),
      color: z.string().default('#FFFFFF'),
      backgroundColor: z.string().default('#000000'),
      highlightColor: z.string().optional(),
    })
    .optional(),
});

export type AddCaptionsRequest = z.infer<typeof AddCaptionsRequestSchema>;

export const OptimizeVideoRequestSchema = z.object({
  videoUrl: z.string().url(),
  platform: PlatformType,
  customSpec: z
    .object({
      aspectRatio: z.string(),
      width: z.number(),
      height: z.number(),
      maxDuration: z.number().optional(),
      format: z.string(),
    })
    .optional(),
});

export type OptimizeVideoRequest = z.infer<typeof OptimizeVideoRequestSchema>;
