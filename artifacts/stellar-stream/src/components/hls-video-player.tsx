"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetWatchProgressQueryKey,
  useSaveWatchProgress,
} from "@workspace/api-client-react";
import { AlertTriangle, LoaderCircle } from "lucide-react";

type QualityOption = { value: number; label: string };

export default function HlsVideoPlayer({
  src,
  titleId,
  episodeId = null,
  resumeAt = 0,
  signedIn,
}: {
  src: string;
  titleId: string;
  episodeId?: string | null;
  resumeAt?: number;
  signedIn: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const lastSavedAt = useRef(0);
  const resumeApplied = useRef(false);
  const [qualities, setQualities] = useState<QualityOption[]>([]);
  const [quality, setQuality] = useState(-1);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const saveProgress = useSaveWatchProgress();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setError("");
    setQualities([]);
    setQuality(-1);
    resumeApplied.current = false;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        capLevelToPlayerSize: true,
        maxBufferLength: 30,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const levels = hls.levels.map((level, index) => ({
          value: index,
          label: level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)} kbps`,
        }));
        setQualities([{ value: -1, label: "Auto" }, ...levels]);
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setError("This video could not be played. Try again later.");
        }
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      setQualities([{ value: -1, label: "Auto" }]);
      return () => {
        video.removeAttribute("src");
        video.load();
      };
    }

    setError("This browser does not support HLS video playback.");
    return undefined;
  }, [src]);

  const persistProgress = useCallback(
    (force = false) => {
      const video = videoRef.current;
      if (!signedIn || !video || !Number.isFinite(video.duration)) return;
      const now = Date.now();
      if (!force && now - lastSavedAt.current < 8_000) return;
      const currentTimeSeconds = Math.max(0, Math.floor(video.currentTime));
      const durationSeconds = Math.max(0, Math.floor(video.duration));
      if (durationSeconds === 0) return;

      lastSavedAt.current = now;
      saveProgress.mutate(
        {
          data: {
            titleId,
            episodeId,
            currentTimeSeconds,
            durationSeconds,
          },
        },
        {
          onSuccess: () => {
            void queryClient.invalidateQueries({
              queryKey: getGetWatchProgressQueryKey(),
            });
          },
        },
      );
    },
    [episodeId, queryClient, saveProgress, signedIn, titleId],
  );

  function selectQuality(value: number) {
    setQuality(value);
    if (hlsRef.current) hlsRef.current.currentLevel = value;
  }

  function resumePlayback() {
    const video = videoRef.current;
    if (!video || resumeApplied.current || resumeAt <= 0) return;
    video.currentTime = Math.min(resumeAt, Math.max(0, video.duration - 1));
    resumeApplied.current = true;
  }

  return (
    <div className="hls-player" data-testid="player-video">
      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        onLoadedMetadata={resumePlayback}
        onTimeUpdate={() => persistProgress()}
        onPause={() => persistProgress(true)}
        onEnded={() => persistProgress(true)}
        aria-label="Video player"
      />
      {error && (
        <div className="hls-player-error" role="alert" data-testid="status-player-error">
          <AlertTriangle size={16} /> {error}
        </div>
      )}
      {!error && !qualities.length && (
        <div className="hls-player-loading" aria-live="polite">
          <LoaderCircle size={16} className="animate-spin" />
          <span>Loading video…</span>
        </div>
      )}
      {qualities.length > 1 && (
        <label className="hls-quality">
          <span>Quality</span>
          <select
            aria-label="Playback quality"
            value={quality}
            onChange={(event) => selectQuality(Number(event.target.value))}
            data-testid="select-video-quality"
          >
            {qualities.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {signedIn && saveProgress.isError && (
        <p className="hls-save-error" role="status">
          Playback is working, but your progress could not be saved.
        </p>
      )}
    </div>
  );
}
