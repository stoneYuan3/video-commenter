# Video Frame Preview on Progress Bar Hover - Implementation Plan

## Overview
Add video frame preview thumbnails that appear in a bubble above the progress bar when the user hovers over it. This feature provides frame-accurate previews for better navigation.

## Current Implementation Summary

**Video Player:**
- Uses YouTube IFrame API
- Custom timeline/progress bar at [src/app/video/[id]/page.tsx:1038-1117](src/app/video/[id]/page.tsx#L1038-L1117)
- Native YouTube controls disabled
- Custom controls implemented with Space bar toggle and timeline seek

**Progress Bar Structure:**
- 12px height container (`h-12`)
- Blue progress indicator showing playback position
- Red vertical line for current time
- Comment markers (timestamp and range)
- Existing hover tooltip for comments only

## Technical Approach Options

### Option A: Canvas-Based Frame Capture (Client-Side)
**Pros:**
- Real-time frame extraction
- Works with any video source
- No server/storage required

**Cons:**
- Cannot capture frames from YouTube IFrame API (cross-origin restrictions)
- Performance overhead on client
- Not feasible for YouTube videos

### Option B: YouTube Storyboard API (Direct URL Access)
**Pros:**
- YouTube provides storyboard sprite sheets with multiple frames
- No API key required (uses public URLs)
- Moderate precision (~1 frame per second or better)
- Fast and lightweight

**Cons:**
- Requires reverse-engineering storyboard URL format
- YouTube-specific solution
- Format may change without notice
- Not documented officially

### Option C: Server-Side Thumbnail Generation with FFmpeg
**Pros:**
- High quality, precise frame-accurate thumbnails
- Full control over thumbnail density
- Works for YouTube, uploaded videos, and any future sources
- Best long-term solution

**Cons:**
- Requires backend processing with FFmpeg
- Storage for thumbnail sprite sheets
- Initial implementation complexity
- Processing time on first load

## Recommended Implementation: **Option C - Server-Side Generation (Direct)**

Based on your requirements and preference:
- ✅ High precision needed
- ✅ Future support for uploaded/GDrive videos planned
- ❌ No YouTube API key available
- ✅ User prefers going directly with server-side solution

**Strategy:**
Build complete server-side thumbnail generation system from the start. This provides:
- Frame-accurate previews for all video sources
- Full control over thumbnail quality and density
- No dependency on external APIs
- Clean architecture for future video sources

### Implementation Details

#### 1. Server-Side Thumbnail Generation Architecture

The system will generate sprite sheets server-side using FFmpeg and Sharp:
- Download/access video file (YouTube or uploaded)
- Extract frames at 1-second intervals using FFmpeg
- Stitch frames into sprite grids (5x5 = 25 frames per sprite) using Sharp
- Store sprites in Vercel Blob storage
- Save sprite metadata in Video document
- Serve sprite URLs to frontend for preview display

#### 2. UI Components to Add

**File:** [src/app/video/[id]/page.tsx](src/app/video/[id]/page.tsx)

**New State Variables (around line 135):**
```tsx
const [hoverTime, setHoverTime] = useState<number | null>(null);
const [thumbnailSprites, setThumbnailSprites] = useState<ThumbnailSprites | null>(null);
const [frameLocation, setFrameLocation] = useState<FrameLocation | null>(null);
const [generatingThumbnails, setGeneratingThumbnails] = useState(false);
```

**Load Thumbnails on Video Change:**
```tsx
useEffect(() => {
  if (currentVideo?._id) {
    // Check if video has pre-generated thumbnails
    if (currentVideo.thumbnailSprites) {
      setThumbnailSprites(currentVideo.thumbnailSprites);
    } else {
      // Trigger generation if not available
      setGeneratingThumbnails(true);
      triggerThumbnailGeneration(currentVideo._id)
        .then(sprites => {
          if (sprites) setThumbnailSprites(sprites);
        })
        .finally(() => setGeneratingThumbnails(false));
    }
  }
}, [currentVideo]);
```

**New Mouse Move Handler for Timeline (modify existing handler at line 1043):**
```tsx
const handleTimelineHover = useCallback(
  (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !thumbnailSprites) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const position = (e.clientX - rect.left) / rect.width;
    const time = Math.max(0, Math.min(duration, position * duration));

    setHoverTime(time);

    // Calculate frame location
    const location = getFrameLocationForTime(time, thumbnailSprites);
    setFrameLocation(location);
  },
  [duration, thumbnailSprites]
);

const handleTimelineLeave = () => {
  setHoverTime(null);
  setFrameLocation(null);
};
```

**Preview Bubble Component (add near line 1011, before hoveredComment bubble):**
```tsx
{hoverTime !== null && frameLocation && !isDragging && !hoveredComment && (
  <div
    className="absolute bottom-full mb-2 pointer-events-none z-50"
    style={{
      left: `${(hoverTime / duration) * 100}%`,
      transform: 'translateX(-50%)'
    }}
  >
    <div className="bg-black rounded-lg shadow-2xl overflow-hidden">
      {/* Thumbnail Frame from Sprite Sheet */}
      <div
        className="relative"
        style={{
          width: '160px',
          height: '90px',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            width: `${frameLocation.width}px`,
            height: `${frameLocation.height}px`,
            backgroundImage: `url(${frameLocation.spriteUrl})`,
            backgroundPosition: `-${frameLocation.x}px -${frameLocation.y}px`,
            backgroundRepeat: 'no-repeat',
          }}
        />
      </div>
      {/* Time Label */}
      <div className="px-2 py-1 bg-black/90 text-white text-xs text-center font-mono">
        {formatTime(hoverTime)}
      </div>
      {/* Pointer Arrow */}
      <div
        className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"
      />
    </div>
  </div>
)}
```

**Timeline Container Updates (line 1038-1045):**
```tsx
<div
  ref={timelineRef}
  className="relative h-12 bg-gray-200 rounded-lg cursor-pointer hover:bg-gray-300 transition-colors"
  onClick={handleTimelineClick}
  onMouseDown={handleMouseDown}
  onMouseMove={(e) => {
    handleMouseMove(e);  // existing drag handler
    handleTimelineHover(e);  // new hover handler
  }}
  onMouseLeave={handleTimelineLeave}  // new
  style={{ userSelect: 'none' }}
>
```

#### 3. Backend: Thumbnail Generation Utility

**New utility file:** `src/lib/thumbnailGenerator.ts`

```typescript
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import sharp from 'sharp';
import { put } from '@vercel/blob';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

// Set FFmpeg binary path
ffmpeg.setFfmpegPath(ffmpegStatic as string);

export interface ThumbnailSprites {
  spriteUrls: string[];      // Array of sprite sheet URLs
  frameWidth: number;        // Width of each frame in pixels
  frameHeight: number;       // Height of each frame in pixels
  framesPerRow: number;      // Number of frames per row in sprite
  framesPerCol: number;      // Number of frames per column in sprite
  interval: number;          // Seconds between each frame
  totalFrames: number;       // Total number of frames
  generatedAt: Date;
}

/**
 * Generate thumbnail sprites for a video
 * @param videoUrl - YouTube URL or local video path
 * @param videoId - Video document ID
 * @param duration - Video duration in seconds
 */
export async function generateThumbnailSprites(
  videoUrl: string,
  videoId: string,
  duration: number
): Promise<ThumbnailSprites> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'video-thumbs-'));

  try {
    // Configuration
    const FRAME_WIDTH = 160;
    const FRAME_HEIGHT = 90;
    const FRAMES_PER_ROW = 5;
    const FRAMES_PER_COL = 5;
    const FRAMES_PER_SPRITE = FRAMES_PER_ROW * FRAMES_PER_COL;
    const INTERVAL = 1; // 1 frame per second

    const totalFrames = Math.floor(duration / INTERVAL);
    const spriteCount = Math.ceil(totalFrames / FRAMES_PER_SPRITE);

    // Step 1: Extract frames from video
    const framePaths = await extractFrames(videoUrl, tempDir, duration, INTERVAL);

    // Step 2: Create sprite sheets
    const spriteBuffers = await createSpriteSheets(
      framePaths,
      FRAME_WIDTH,
      FRAME_HEIGHT,
      FRAMES_PER_ROW,
      FRAMES_PER_COL
    );

    // Step 3: Upload sprites to Vercel Blob
    const spriteUrls: string[] = [];
    for (let i = 0; i < spriteBuffers.length; i++) {
      const blob = await put(
        `thumbnails/${videoId}/sprite-${i}.jpg`,
        spriteBuffers[i],
        {
          access: 'public',
          contentType: 'image/jpeg',
        }
      );
      spriteUrls.push(blob.url);
    }

    return {
      spriteUrls,
      frameWidth: FRAME_WIDTH,
      frameHeight: FRAME_HEIGHT,
      framesPerRow: FRAMES_PER_ROW,
      framesPerCol: FRAMES_PER_COL,
      interval: INTERVAL,
      totalFrames,
      generatedAt: new Date(),
    };

  } finally {
    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

/**
 * Extract frames from video at regular intervals
 */
async function extractFrames(
  videoUrl: string,
  outputDir: string,
  duration: number,
  interval: number
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const framePaths: string[] = [];
    const frameCount = Math.floor(duration / interval);

    ffmpeg(videoUrl)
      .outputOptions([
        `-vf fps=1/${interval}`,  // 1 frame every N seconds
        '-frames:v', String(frameCount),
      ])
      .output(path.join(outputDir, 'frame-%04d.jpg'))
      .on('end', async () => {
        // Collect generated frame paths
        const files = await fs.readdir(outputDir);
        framePaths.push(...files.map(f => path.join(outputDir, f)).sort());
        resolve(framePaths);
      })
      .on('error', reject)
      .run();
  });
}

/**
 * Stitch frames into sprite sheet grids
 */
async function createSpriteSheets(
  framePaths: string[],
  frameWidth: number,
  frameHeight: number,
  framesPerRow: number,
  framesPerCol: number
): Promise<Buffer[]> {
  const framesPerSprite = framesPerRow * framesPerCol;
  const spriteCount = Math.ceil(framePaths.length / framesPerSprite);
  const sprites: Buffer[] = [];

  for (let spriteIdx = 0; spriteIdx < spriteCount; spriteIdx++) {
    const startFrame = spriteIdx * framesPerSprite;
    const endFrame = Math.min(startFrame + framesPerSprite, framePaths.length);
    const spritFrames = framePaths.slice(startFrame, endFrame);

    // Create blank canvas
    const spriteWidth = framesPerRow * frameWidth;
    const spriteHeight = framesPerCol * frameHeight;
    const canvas = sharp({
      create: {
        width: spriteWidth,
        height: spriteHeight,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    });

    // Compose frames onto canvas
    const composites = await Promise.all(
      spritFrames.map(async (framePath, idx) => {
        const row = Math.floor(idx / framesPerRow);
        const col = idx % framesPerRow;

        const resized = await sharp(framePath)
          .resize(frameWidth, frameHeight, { fit: 'cover' })
          .toBuffer();

        return {
          input: resized,
          left: col * frameWidth,
          top: row * frameHeight,
        };
      })
    );

    const spriteBuffer = await canvas
      .composite(composites)
      .jpeg({ quality: 80 })
      .toBuffer();

    sprites.push(spriteBuffer);
  }

  return sprites;
}
```

#### 4. Backend: API Endpoint

**New API route:** `src/app/api/videos/[id]/thumbnails/generate/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Video from '@/models/Video';
import { getUserFromRequest } from '@/lib/auth';
import { generateThumbnailSprites } from '@/lib/thumbnailGenerator';
import path from 'path';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    // Optional: Verify user authentication
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const videoId = params.id;
    const video = await Video.findById(videoId);

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Check if thumbnails already exist and are recent
    if (video.thumbnailSprites &&
        video.thumbnailSprites.generatedAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
      return NextResponse.json({
        message: 'Thumbnails already generated',
        thumbnailSprites: video.thumbnailSprites
      });
    }

    // Generate thumbnails
    const videoUrl = video.videoSource.startsWith('http')
      ? video.videoSource
      : path.join(process.cwd(), 'public', video.videoSource);

    const thumbnailSprites = await generateThumbnailSprites(
      videoUrl,
      videoId,
      video.duration || 300 // Fallback to 5 min if duration unknown
    );

    // Update video document
    video.thumbnailSprites = thumbnailSprites;
    await video.save();

    return NextResponse.json({
      message: 'Thumbnails generated successfully',
      thumbnailSprites,
    });

  } catch (error: any) {
    console.error('Thumbnail generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate thumbnails', details: error.message },
      { status: 500 }
    );
  }
}
```

#### 5. Frontend: Utility Functions

**New utility file:** `src/utils/videoThumbnails.ts`

```typescript
export interface ThumbnailSprites {
  spriteUrls: string[];
  frameWidth: number;
  frameHeight: number;
  framesPerRow: number;
  framesPerCol: number;
  interval: number;
  totalFrames: number;
}

export interface FrameLocation {
  spriteUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculate which sprite and position to display for a given time
 */
export function getFrameLocationForTime(
  time: number,
  sprites: ThumbnailSprites
): FrameLocation | null {
  if (!sprites || sprites.spriteUrls.length === 0) return null;

  const frameIndex = Math.floor(time / sprites.interval);
  if (frameIndex >= sprites.totalFrames) return null;

  const framesPerSprite = sprites.framesPerRow * sprites.framesPerCol;
  const spriteIndex = Math.floor(frameIndex / framesPerSprite);
  const frameInSprite = frameIndex % framesPerSprite;

  if (spriteIndex >= sprites.spriteUrls.length) return null;

  const row = Math.floor(frameInSprite / sprites.framesPerRow);
  const col = frameInSprite % sprites.framesPerRow;

  return {
    spriteUrl: sprites.spriteUrls[spriteIndex],
    x: col * sprites.frameWidth,
    y: row * sprites.frameHeight,
    width: sprites.frameWidth,
    height: sprites.frameHeight,
  };
}

/**
 * Trigger thumbnail generation for a video
 */
export async function triggerThumbnailGeneration(videoId: string): Promise<ThumbnailSprites | null> {
  try {
    const response = await fetch(`/api/videos/${videoId}/thumbnails/generate`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to generate thumbnails');
    }

    const data = await response.json();
    return data.thumbnailSprites;
  } catch (error) {
    console.error('Error triggering thumbnail generation:', error);
    return null;
  }
}
```

#### 6. Database Schema Update

**Update Video model** ([src/models/Video.ts](src/models/Video.ts)):
```typescript
import mongoose from 'mongoose';

const VideoSchema = new mongoose.Schema({
  // ... existing fields
  videoTitle: String,
  videoSource: String,
  thumbnail: String,
  duration: Number,

  // NEW FIELD - Add this
  thumbnailSprites: {
    spriteUrls: [String],
    frameWidth: Number,
    frameHeight: Number,
    framesPerRow: Number,
    framesPerCol: Number,
    interval: Number,
    totalFrames: Number,
    generatedAt: Date,
  },
}, { timestamps: true });

export default mongoose.models.Video || mongoose.model('Video', VideoSchema);
```

## Critical Files to Create/Modify

### Backend Files

1. **`src/lib/thumbnailGenerator.ts`** (NEW FILE)
   - `generateThumbnailSprites()` - Main generation function
   - `extractFrames()` - FFmpeg frame extraction
   - `createSpriteSheets()` - Sharp sprite stitching
   - Vercel Blob upload logic

2. **`src/app/api/videos/[id]/thumbnails/generate/route.ts`** (NEW FILE)
   - POST handler for thumbnail generation
   - Authentication check
   - Call generation utility
   - Update video document

3. **[src/models/Video.ts](src/models/Video.ts)** - Video model
   - Add `thumbnailSprites` field to schema

### Frontend Files

4. **`src/utils/videoThumbnails.ts`** (NEW FILE)
   - `getFrameLocationForTime()` - Calculate sprite position
   - `triggerThumbnailGeneration()` - API call wrapper
   - TypeScript interfaces

5. **[src/app/video/[id]/page.tsx](src/app/video/[id]/page.tsx)** - Main video page component
   - Add state variables (line ~135): `thumbnailSprites`, `frameLocation`, `hoverTime`, `generatingThumbnails`
   - Load thumbnails on video change (new useEffect)
   - Add hover handlers (line ~1043): `handleTimelineHover`, `handleTimelineLeave`
   - Add preview bubble component (line ~1011)
   - Update timeline container events (line ~1038)

### Dependencies to Install

6. **`package.json`** - Add new dependencies
   ```bash
   npm install fluent-ffmpeg @ffmpeg-installer/ffmpeg @vercel/blob
   npm install --save-dev @types/fluent-ffmpeg
   ```

## Implementation Phases

### Phase 1: Backend - Thumbnail Generation System
**Goal:** Build the core server-side thumbnail generation infrastructure

1. Install dependencies (fluent-ffmpeg, @ffmpeg-installer/ffmpeg, @vercel/blob)
2. Update Video model to include `thumbnailSprites` field
3. Create `src/lib/thumbnailGenerator.ts` with FFmpeg + Sharp logic
4. Create API endpoint `/api/videos/[id]/thumbnails/generate`
5. Test thumbnail generation with a sample YouTube video

### Phase 2: Frontend - Preview Bubble UI
**Goal:** Display thumbnails on hover over progress bar

1. Create `src/utils/videoThumbnails.ts` utility functions
2. Add state management in page component
3. Add hover handlers for timeline
4. Create preview bubble component with sprite display
5. Trigger thumbnail generation on video load
6. Show loading state while thumbnails generate

### Phase 3: Polish & Optimization
**Goal:** Make the experience smooth and production-ready

1. Add throttling to hover handler (50ms intervals)
2. Implement sprite image preloading
3. Handle error states gracefully
4. Add fade-in animations
5. Handle edge cases (timeline boundaries, missing sprites)
6. Add loading spinner UI
7. Optimize for mobile (consider disabling or resizing)
8. Add caching to avoid regenerating thumbnails

## Verification Steps

1. **Hover Detection:**
   - Move mouse over progress bar
   - Verify bubble appears above cursor position
   - Verify time label shows correct timestamp

2. **Thumbnail Display:**
   - Confirm thumbnail image loads and displays
   - Check image doesn't break layout
   - Verify correct frame shows for hover position
   - Verify fallback for failed image loads

3. **Interaction Conflicts:**
   - Start dragging on timeline → preview should disappear
   - Hover over comment marker → comment tooltip takes priority
   - Leave timeline → preview disappears immediately

4. **Performance:**
   - Move mouse rapidly across timeline
   - Verify no lag or stutter
   - Check network tab for excessive requests

5. **Visual Polish:**
   - Check bubble doesn't clip at timeline edges
   - Verify arrow pointer aligns with timeline
   - Confirm styling matches app design system

## Database Structure Changes

**Yes, but minimal and non-breaking:**

The solution adds a **new optional field** to the existing Video model:

```typescript
thumbnailSprites?: {  // Optional field - won't break existing videos
  spriteUrls: [String],
  frameWidth: Number,
  frameHeight: Number,
  framesPerRow: Number,
  framesPerCol: Number,
  interval: Number,
  totalFrames: Number,
  generatedAt: Date,
}
```

**Impact:**
- ✅ **Non-breaking:** All existing videos continue to work normally
- ✅ **No migration needed:** Old videos simply won't have this field
- ✅ **Backward compatible:** Videos without thumbnails will trigger generation on first view
- ✅ **No data loss:** Nothing is removed or modified in existing structure

## User Requirements (Confirmed)

✅ **Thumbnail Precision:** High precision (frame-accurate or near frame-accurate)
✅ **Future Video Sources:** Yes, will add uploaded/GDrive videos soon
✅ **API Key:** No YouTube API key available
✅ **Implementation Approach:** Server-side generation preferred

## Estimated Implementation Time

- **Phase 1 (Backend Infrastructure):** ~4-5 hours
  - Dependencies and setup: 0.5 hours
  - Database schema update: 0.5 hours
  - FFmpeg frame extraction: 1.5 hours
  - Sharp sprite stitching: 1.5 hours
  - Vercel Blob upload: 0.5 hours
  - API endpoint: 0.5 hours

- **Phase 2 (Frontend Integration):** ~2-3 hours
  - Utility functions: 0.5 hours
  - State management: 0.5 hours
  - Hover handlers: 1 hour
  - Preview bubble UI: 1 hour

- **Phase 3 (Polish & Testing):** ~2-3 hours
  - Throttling and caching: 1 hour
  - Loading/error states: 0.5 hours
  - Edge cases: 0.5 hours
  - End-to-end testing: 1 hour

**Total:** ~8-11 hours of AI implementation time

## Technical Notes

### Performance Optimizations
- **Sprite preloading:** Load sprite images in background after video loads
- **RequestAnimationFrame:** Use RAF for smooth bubble position updates
- **Image caching:** Browser cache + React state cache for sprites
- **Throttling:** Limit hover calculations to 50ms intervals max

### Browser Compatibility
- CSS `background-position` is universally supported
- `transform: translateX(-50%)` for centering is well-supported
- Fade-in animations use CSS transitions (IE10+)
- No polyfills needed for modern browsers

### Mobile Considerations
- Touch events don't support hover - alternative UX needed
- Consider tap-and-hold gesture to show preview
- Reduce bubble size on smaller screens
- May want to disable on mobile initially

### Vercel Deployment Notes
- FFmpeg works on Vercel serverless functions
- Vercel Blob storage has generous free tier
- Consider timeout limits for long videos (max 10 seconds on free tier)
- May need to upgrade for videos longer than 10 minutes

### Cost Considerations
- **Vercel Blob:** $0.15/GB stored, $0.30/GB bandwidth (after free tier)
- **Compute:** Processing time on serverless functions
- **One-time generation:** Thumbnails generated once and cached
- **Estimated cost:** ~$0.01-0.05 per video for typical 5-10 minute videos

## Next Steps

After approval:
1. Install required npm packages
2. Create backend utility file (`src/lib/thumbnailGenerator.ts`)
3. Create API endpoint (`src/app/api/videos/[id]/thumbnails/generate/route.ts`)
4. Update Video model schema
5. Create frontend utility file (`src/utils/videoThumbnails.ts`)
6. Modify video page component to integrate hover preview
7. Test with live YouTube videos
8. Implement polish phase (throttling, caching, loading states)
9. Deploy and monitor performance

---

**Plan Created:** 2026-01-25
**Platform:** Claude Code (Sonnet 4.5)
**Status:** Ready for implementation
