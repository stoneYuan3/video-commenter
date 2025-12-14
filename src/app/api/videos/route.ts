import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Video from '@/models/Video';
import { getUserFromRequest } from '@/lib/auth';

// GET all videos for the logged-in user
export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const videos = await Video.find({ userId: user.userId })
      .sort({ createdAt: -1 });

    return NextResponse.json({ videos }, { status: 200 });
  } catch (error: any) {
    console.error('Get videos error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}

// POST create a new video (supports both single and multiple videos)
export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const body = await req.json();
    const { title, videos, videoSource, videoId, gdriveId, uploadedVideoUrl, thumbnail, duration } = body;

    // Validation
    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Prepare video data
    let videoData: any = {
      userId: user.userId,
      title: title.trim(),
      permission: 'invited-only',
    };

    // NEW: Handle videos array (multi-video)
    if (videos && Array.isArray(videos) && videos.length > 0) {
      videoData.videos = videos.map((v: any, index: number) => ({
        videoSource: v.videoSource || 'youtube',
        videoId: v.videoId,
        gdriveId: v.gdriveId,
        uploadedVideoUrl: v.uploadedVideoUrl,
        duration: v.duration,
        thumbnail: v.thumbnail,
        order: v.order ?? index,
      }));

      // BACKWARD COMPATIBILITY: Also set first video in old fields
      const firstVideo = videos[0];
      videoData.videoSource = firstVideo.videoSource || 'youtube';
      videoData.videoId = firstVideo.videoId;
      videoData.gdriveId = firstVideo.gdriveId;
      videoData.uploadedVideoUrl = firstVideo.uploadedVideoUrl;
      videoData.thumbnail = firstVideo.thumbnail || thumbnail;
      videoData.duration = firstVideo.duration || duration || 0;
    }
    // LEGACY: Handle single video (old format)
    else if (videoSource) {
      videoData.videoSource = videoSource;
      videoData.videoId = videoId;
      videoData.gdriveId = gdriveId;
      videoData.uploadedVideoUrl = uploadedVideoUrl;
      videoData.thumbnail = thumbnail;
      videoData.duration = duration || 0;

      // Also create videos array with single item for forward compatibility
      videoData.videos = [{
        videoSource,
        videoId,
        gdriveId,
        uploadedVideoUrl,
        duration: duration || 0,
        thumbnail,
        order: 0,
      }];
    } else {
      return NextResponse.json(
        { error: 'Either videos array or videoSource is required' },
        { status: 400 }
      );
    }

    const video = await Video.create(videoData);

    const populatedVideo = await Video.findById(video._id)
      .populate('userId', 'username name email');

    return NextResponse.json(
      { message: 'Video created successfully', video: populatedVideo },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create video error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}
