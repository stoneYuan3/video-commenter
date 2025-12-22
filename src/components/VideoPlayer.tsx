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
  uploadedVideoUrl,
  gdriveId,
  youtubePlayerCallback,
  videoRef,
  isPlaying,
  togglePlayPause,
}) => {
  const renderVideoContent = () => {
    if (videoSource === 'youtube' && videoId) {
      return (
        <div
          ref={youtubePlayerCallback}
          className="rounded"
        />
      );
    }

    if (videoSource === 'upload' && uploadedVideoUrl) {
      return (
        <div className="relative rounded overflow-hidden bg-black flex items-center justify-center" style={{ height: '480px' }}>
          <video
            ref={videoRef}
            src={uploadedVideoUrl}
            className="max-h-full max-w-full"
            style={{ objectFit: 'contain' }}
            onClick={togglePlayPause}
          />
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ opacity: isPlaying ? 0 : 1, transition: 'opacity 0.3s' }}
          >
            <div className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
      );
    }

    if (videoSource === 'gdrive' && gdriveId) {
      return (
        <div className="rounded overflow-hidden bg-black" style={{ height: '480px' }}>
          <iframe
            src={`https://drive.google.com/file/d/${gdriveId}/preview`}
            width="100%"
            height="480"
            allow="autoplay"
            className="rounded"
            title="Google Drive Video"
          />
        </div>
      );
    }

    return <div>Unsupported video format</div>;
  };

  return (
    <div>
      { renderVideoContent() }
    </div>
  );
};
