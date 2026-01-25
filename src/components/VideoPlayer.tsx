import React from 'react';

interface VideoPlayerProps {
  videoSource: 'youtube' | 'upload' | 'gdrive';
  videoId?: string | null;
  uploadedVideoUrl?: string | null;
  gdriveId?: string | null;
  youtubePlayerCallback?: (node: HTMLDivElement | null) => void;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  isPlaying?: boolean;
  togglePlayPause?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoSource,
  videoId,
  youtubePlayerCallback,
}) => {
  const renderVideoContent = () => {
    if (videoSource === 'youtube' && videoId) {
      return (
        <div
          ref={youtubePlayerCallback}
          className="rounded"
          style={{ minHeight: '480px', width: '100%' }}
        />
      );
    }

    return <div>Unsupported video format</div>;
  };

  return (
    <div className="w-full">
      { renderVideoContent() }
    </div>
  );
};
