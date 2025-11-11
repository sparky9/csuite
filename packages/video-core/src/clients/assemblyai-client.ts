import { AssemblyAI, Transcript } from 'assemblyai';
import type { TranscriptData, ViralMoment } from '../types.js';

export interface AssemblyAIConfig {
  apiKey: string;
}

export class AssemblyAIClient {
  private client: AssemblyAI;

  constructor(config: AssemblyAIConfig) {
    this.client = new AssemblyAI({
      apiKey: config.apiKey,
    });
  }

  async transcribe(
    audioUrl: string,
    options: {
      speakerLabels?: boolean;
      language?: string;
    } = {}
  ): Promise<{ transcriptId: string }> {
    const transcript = await this.client.transcripts.transcribe({
      audio: audioUrl,
      speaker_labels: options.speakerLabels,
      language_code: options.language as any,
      punctuate: true,
      format_text: true,
      auto_chapters: true,
      sentiment_analysis: true,
      iab_categories: true,
    });

    if (transcript.status === 'error') {
      throw new Error(`Transcription failed: ${transcript.error}`);
    }

    return { transcriptId: transcript.id };
  }

  async getTranscript(transcriptId: string): Promise<TranscriptData | null> {
    const transcript = await this.client.transcripts.get(transcriptId);

    if (transcript.status === 'processing' || transcript.status === 'queued') {
      return null;
    }

    if (transcript.status === 'error') {
      throw new Error(`Transcript error: ${transcript.error}`);
    }

    return this.convertToTranscriptData(transcript);
  }

  async waitForTranscript(
    transcriptId: string,
    maxWaitMs: number = 300000
  ): Promise<TranscriptData> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const data = await this.getTranscript(transcriptId);

      if (data) {
        return data;
      }

      // Wait 2 seconds before polling again
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error('Transcription timeout');
  }

  private convertToTranscriptData(transcript: Transcript): TranscriptData {
    const words = transcript.words?.map((w) => ({
      text: w.text,
      start: w.start,
      end: w.end,
      confidence: w.confidence,
    }));

    const speakers = transcript.utterances?.map((u) => ({
      speaker: u.speaker,
      start: u.start,
      end: u.end,
      text: u.text,
      confidence: u.confidence,
    }));

    // Extract viral moments from chapters and sentiment
    const viralMoments = this.extractViralMoments(transcript);

    return {
      id: transcript.id,
      text: transcript.text || '',
      words,
      speakers,
      viralMoments,
  duration: transcript.audio_duration ?? undefined,
      language: transcript.language_code,
    };
  }

  private extractViralMoments(transcript: Transcript): ViralMoment[] {
    const moments: ViralMoment[] = [];

    // Extract from auto chapters
    if (transcript.chapters) {
  transcript.chapters.forEach((chapter) => {
        // Look for emotionally charged or topical chapters
        const score = this.calculateViralScore(chapter.summary, chapter.headline);

        if (score > 0.6) {
          moments.push({
            title: chapter.headline,
            description: chapter.summary,
            start: chapter.start,
            end: chapter.end,
            score,
            keywords: [],
          });
        }
      });
    }

    // Extract from sentiment analysis
    if (transcript.sentiment_analysis_results) {
      const sentimentGroups = this.groupBySentiment(
        transcript.sentiment_analysis_results
      );

      // Find high-emotion segments
      sentimentGroups.forEach((group) => {
        if (group.score > 0.7) {
          moments.push({
            title: `${group.sentiment} moment`,
            description: group.text,
            start: group.start,
            end: group.end,
            score: group.score,
            keywords: [],
            sentiment: group.sentiment,
          });
        }
      });
    }

    // Sort by score and return top moments
    return moments.sort((a, b) => b.score - a.score).slice(0, 10);
  }

  private calculateViralScore(summary: string, headline: string): number {
    const viralKeywords = [
      'shocking',
      'amazing',
      'incredible',
      'revealed',
      'secret',
      'mistake',
      'truth',
      'surprising',
      'unexpected',
      'breakthrough',
      'game-changer',
      'revolutionary',
    ];

    const text = (summary + ' ' + headline).toLowerCase();
    let score = 0.5; // Base score

    viralKeywords.forEach((keyword) => {
      if (text.includes(keyword)) {
        score += 0.1;
      }
    });

    return Math.min(score, 1.0);
  }

  private groupBySentiment(
    sentiments: Array<{ text: string; start: number; end: number; sentiment: string; confidence: number }>
  ): Array<{ sentiment: string; text: string; start: number; end: number; score: number }> {
    const groups: Array<{
      sentiment: string;
      text: string;
      start: number;
      end: number;
      score: number;
    }> = [];

    let currentGroup: any = null;

    sentiments.forEach((s) => {
      if (
        !currentGroup ||
        currentGroup.sentiment !== s.sentiment ||
        s.start - currentGroup.end > 5000
      ) {
        if (currentGroup) {
          groups.push(currentGroup);
        }
        currentGroup = {
          sentiment: s.sentiment,
          text: s.text,
          start: s.start,
          end: s.end,
          score: s.confidence,
        };
      } else {
        currentGroup.text += ' ' + s.text;
        currentGroup.end = s.end;
        currentGroup.score = Math.max(currentGroup.score, s.confidence);
      }
    });

    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups;
  }
}
