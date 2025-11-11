# Video Production Guide

## Overview

The csuite-pivot platform now includes comprehensive video production capabilities powered by the Director Video MCP ecosystem. These tools enable you to create, edit, optimize, and distribute video content at scale.

## Features

### 1. Media Transcription
Automatically transcribe videos and audio files with:
- Word-level timestamps
- Speaker identification
- Sentiment analysis
- Auto-generated chapters
- Viral moment extraction

**Supported Formats:**
- Video: MP4, MOV, AVI, WebM
- Audio: MP3, WAV, M4A, FLAC, OGG

### 2. Viral Clip Extraction
AI-powered analysis to identify and extract the most engaging moments from long-form content:
- Automated highlight detection
- Sentiment-based scoring
- Keyword extraction
- Configurable clip duration (15-60 seconds)

### 3. Platform Optimization
Automatically optimize videos for different social media platforms:
- **YouTube**: 16:9, 1920x1080, 30fps
- **TikTok**: 9:16, 1080x1920, max 3 minutes
- **Instagram Story**: 9:16, 1080x1920, max 60 seconds
- **Instagram Feed**: 1:1, 1080x1080, max 60 seconds
- **Instagram Reel**: 9:16, 1080x1920, max 90 seconds
- **Facebook**: 16:9, 1280x720, 30fps
- **LinkedIn**: 16:9, 1920x1080, max 10 minutes
- **Twitter**: 16:9, 1280x720, max 2:20

### 4. Automatic Captions
Add professional captions to your videos:
- Word-by-word syncing
- Customizable styles (font, color, position)
- Multiple caption positions (top, center, bottom)
- Highlight keywords option

### 5. Video Rendering
Create custom video compositions:
- Multi-track timeline editing
- Video and audio mixing
- Text overlays and graphics
- Transitions and effects

## API Keys Required

To use the video production features, you'll need API keys from the following services:

### AssemblyAI (Transcription)
- **Purpose**: Speech-to-text, speaker identification, sentiment analysis
- **Get Key**: https://www.assemblyai.com
- **Pricing**: Pay-as-you-go, ~$0.00025/second (~$0.90/hour)
- **Free Tier**: $50 credit for new users

### Shotstack (Video Rendering)
- **Purpose**: Video editing, rendering, caption overlay
- **Get Key**: https://shotstack.io
- **Pricing**: Starts at $49/month for development, production pricing varies
- **Free Tier**: Sandbox environment for testing

### Pexels (Optional - Stock Videos/Images)
- **Purpose**: B-roll footage and stock images
- **Get Key**: https://www.pexels.com/api
- **Pricing**: Free

### Unsplash (Optional - Stock Images)
- **Purpose**: High-quality stock photography
- **Get Key**: https://unsplash.com/developers
- **Pricing**: Free (rate limited)

### Freesound (Optional - Audio)
- **Purpose**: Stock music and sound effects
- **Get Key**: https://freesound.org/apiv2/apply
- **Pricing**: Free

### Runway ML (Optional - AI Enhancement)
- **Purpose**: AI video generation and upscaling
- **Get Key**: https://runwayml.com
- **Pricing**: Credit-based, varies by feature

### ElevenLabs (Optional - Voice Synthesis)
- **Purpose**: Text-to-speech and voice cloning
- **Get Key**: https://elevenlabs.io
- **Pricing**: Starts at $5/month
- **Free Tier**: 10,000 characters/month

## Setup Instructions

### 1. Install Dependencies

```bash
cd csuite-pivot
pnpm install
```

### 2. Configure Environment Variables

Add the following to your `.env` file:

```env
# Required for transcription
ASSEMBLYAI_API_KEY=your_key_here

# Required for video editing/rendering
SHOTSTACK_API_KEY=your_key_here

# Optional - Stock Assets
PEXELS_API_KEY=your_key_here
UNSPLASH_API_KEY=your_key_here
FREESOUND_API_KEY=your_key_here

# Optional - AI Enhancement
RUNWAY_API_KEY=your_key_here
ELEVENLABS_API_KEY=your_key_here
```

### 3. Run Database Migrations

```bash
pnpm db:migrate:dev
```

This will create the `video_jobs` and `video_transcripts` tables.

### 4. Start the Application

```bash
# Terminal 1: Start API server
pnpm dev:api

# Terminal 2: Start web app
pnpm dev:web
```

## Usage Examples

### Via Web Interface

1. Navigate to `/video` in the dashboard
2. Enter a video URL or upload a file
3. Select the action (Transcribe, Add Captions, Optimize)
4. Click "Start Processing"
5. Monitor progress in the job queue
6. Download results when complete

### Via API

#### Transcribe a Video

```bash
POST /video/transcribe
Content-Type: application/json

{
  "url": "https://example.com/video.mp4",
  "language": "en",
  "speakerLabels": true,
  "extractViralMoments": true
}
```

Response:
```json
{
  "id": "job_abc123",
  "type": "transcribe",
  "status": "processing",
  "progress": 10,
  "transcriptId": null
}
```

#### Extract Viral Clips

```bash
POST /video/extract-clips
Content-Type: application/json

{
  "transcriptId": "transcript_xyz789",
  "count": 5,
  "minDuration": 15,
  "maxDuration": 45
}
```

#### Add Captions

```bash
POST /video/add-captions
Content-Type: application/json

{
  "videoUrl": "https://example.com/video.mp4",
  "transcriptId": "transcript_xyz789",
  "style": {
    "position": "bottom",
    "fontSize": "48px",
    "color": "#FFFFFF",
    "backgroundColor": "#000000"
  }
}
```

#### Optimize for Platform

```bash
POST /video/optimize
Content-Type: application/json

{
  "videoUrl": "https://example.com/video.mp4",
  "platform": "tiktok"
}
```

#### Check Job Status

```bash
GET /video/jobs/{jobId}
```

Response:
```json
{
  "id": "job_abc123",
  "type": "transcribe",
  "status": "completed",
  "progress": 100,
  "transcriptId": "transcript_xyz789",
  "outputUrls": null
}
```

#### List All Jobs

```bash
GET /video/jobs?status=completed&limit=20
```

## Workflow Examples

### Podcast to Social Media Pipeline

1. **Transcribe**: Upload full podcast episode
2. **Extract Clips**: Generate 5 viral moments (30-60 seconds each)
3. **Add Captions**: Create captioned versions for each clip
4. **Optimize**: Create versions for each platform
   - TikTok (9:16)
   - Instagram Reel (9:16)
   - YouTube Short (9:16)
   - LinkedIn (16:9)
   - Twitter (16:9)

### Webinar Repurposing

1. **Transcribe**: Full webinar recording
2. **Extract Clips**: Key insights and Q&A highlights
3. **Platform Optimization**:
   - LinkedIn posts (16:9, professional)
   - Instagram Stories (9:16, engaging)
   - YouTube (16:9, full quality)

### Content Marketing Automation

1. **CMO Persona Integration**: The CMO can recommend video strategies during board meetings
2. **Automated Workflows**: Set up recurring transcription jobs for weekly content
3. **Multi-Platform Distribution**: One source video → optimized for 8+ platforms

## CMO Persona Integration

The CMO persona now has access to video production recommendations. During board meetings, the CMO can:
- Suggest video content strategies based on analytics
- Recommend platforms for distribution
- Identify content repurposing opportunities
- Propose transcript-based content ideas

Example CMO recommendation:
> "Based on our analytics showing strong LinkedIn engagement, I recommend transcribing our recent webinar and extracting 3-5 key insights as 60-second clips. We can then optimize these for LinkedIn (16:9) and Instagram Reels (9:16) to maximize reach across professional and consumer audiences."

## Troubleshooting

### Job Stuck in "Processing"
- Check API service logs for errors
- Verify API keys are valid
- Ensure video URL is publicly accessible
- Check Shotstack/AssemblyAI service status

### Transcription Failed
- Verify AssemblyAI API key
- Check audio quality (clear speech required)
- Ensure supported language (en, es, fr, de, etc.)
- Try shorter video segments first

### Render Failed
- Verify Shotstack API key
- Check if using sandbox (has watermark)
- Ensure all asset URLs are valid
- Review composition format for errors

### Performance Issues
- Transcription: ~1x real-time (60 min video = ~60 min to transcribe)
- Rendering: ~2-5 min for 1 min video (varies by complexity)
- Consider using job queue for batch processing

## Best Practices

1. **URL Hosting**: Use reliable hosting (S3, CloudFront) for source videos
2. **File Formats**: MP4 with H.264 codec for best compatibility
3. **Caption Timing**: Review auto-captions for accuracy before publishing
4. **Platform Specs**: Always optimize for target platform before publishing
5. **Batch Processing**: Submit multiple jobs at once for efficiency
6. **Cost Management**: Monitor API usage across services
7. **Testing**: Use sandbox environments (Shotstack) before production

## Costs Estimate

For a typical workflow (60-minute video → 5 clips → 3 platforms):

- **Transcription**: $0.90 (60 min @ AssemblyAI)
- **Rendering**: $2-5 (15 renders @ Shotstack)
- **Total**: ~$3-6 per complete workflow

## Future Enhancements

Planned features:
- Stock asset integration (automatic B-roll suggestions)
- AI-powered voice-over generation
- Background music recommendations
- Automated thumbnail generation
- Video analytics integration
- Bulk upload and batch processing UI
- Template library for common formats

## Support

For issues or questions:
1. Check API service status pages
2. Review logs in `/video/jobs/{id}`
3. Consult vendor documentation
4. Contact support team

## References

- [AssemblyAI Documentation](https://www.assemblyai.com/docs)
- [Shotstack API Reference](https://shotstack.io/docs/api/)
- [Director MCP Ecosystem](https://github.com/sparky9/video/tree/claude/video-assistant-mcp-ecosystem-011CUp94yBYU46Fqd39U49Xo)
