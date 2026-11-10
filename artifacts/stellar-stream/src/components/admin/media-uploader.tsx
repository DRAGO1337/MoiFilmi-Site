"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetVideoAssetQueryKey,
  useAttachArtwork,
  useCreateArtworkUpload,
  useCreateVideoUpload,
  useGetVideoAsset,
  useRefreshVideoAsset,
} from "@workspace/api-client-react";
import { AlertCircle, Check, ImagePlus, LoaderCircle, Upload, Video } from "lucide-react";

const BASIC_UPLOAD_LIMIT = 200 * 1024 * 1024;
const TUS_CHUNK_SIZE = 24 * 1024 * 1024;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The request failed. Try again.";
}

function uploadBasicPost(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Cloudflare rejected the upload (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("The upload connection was interrupted."));
    xhr.onabort = () => reject(new Error("The upload was cancelled."));
    xhr.send(formData);
  });
}

async function uploadTus(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  let offset = 0;
  while (offset < file.size) {
    const end = Math.min(offset + TUS_CHUNK_SIZE, file.size);
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": String(offset),
        "Content-Type": "application/offset+octet-stream",
      },
      body: file.slice(offset, end),
    });
    if (!response.ok) {
      throw new Error(
        `Cloudflare could not accept an upload chunk (${response.status}).`,
      );
    }
    const returnedOffset = Number(response.headers.get("Upload-Offset"));
    offset =
      Number.isFinite(returnedOffset) && returnedOffset > offset
        ? returnedOffset
        : end;
    onProgress(Math.min(99, Math.round((offset / file.size) * 100)));
  }
}

export function ArtworkUploader({
  titleId,
  onSaved,
}: {
  titleId: string;
  onSaved: () => void;
}) {
  const createUpload = useCreateArtworkUpload();
  const attachArtwork = useAttachArtwork();
  const [busyKind, setBusyKind] = useState<"poster" | "backdrop" | null>(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function uploadArtwork(
    kind: "poster" | "backdrop",
    file: File | undefined,
  ) {
    if (!file) return;
    setBusyKind(kind);
    setMessage("");
    setIsError(false);

    try {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        throw new Error("Choose a JPEG, PNG, or WebP image.");
      }
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("Artwork files must be 10 MB or smaller.");
      }
      const target = await createUpload.mutateAsync({
        data: { filename: file.name, contentType: file.type as "image/jpeg" | "image/png" | "image/webp" },
      });
      const response = await fetch(target.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) {
        throw new Error(`Artwork upload failed (${response.status}).`);
      }
      await attachArtwork.mutateAsync({
        titleId,
        data: { kind, objectPath: target.objectPath },
      });
      onSaved();
      setMessage(`${kind === "poster" ? "Poster" : "Backdrop"} uploaded.`);
    } catch (error) {
      setIsError(true);
      setMessage(getErrorMessage(error));
    } finally {
      setBusyKind(null);
    }
  }

  return (
    <div className="admin-media-block">
      <div className="admin-media-label"><ImagePlus size={15} /><span>Artwork</span></div>
      <div className="admin-upload-actions">
        {(["poster", "backdrop"] as const).map((kind) => (
          <label className="admin-file-button" key={kind}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busyKind !== null}
              onChange={(event) => {
                void uploadArtwork(kind, event.currentTarget.files?.[0]);
                event.currentTarget.value = "";
              }}
              data-testid={`input-${kind}-upload`}
            />
            {busyKind === kind ? <LoaderCircle size={14} className="animate-spin" /> : <Upload size={14} />}
            {busyKind === kind ? "Uploading…" : `Upload ${kind}`}
          </label>
        ))}
      </div>
      {message && (
        <p className={isError ? "admin-inline-error" : "admin-inline-success"} role="status" data-testid="status-artwork-upload">
          {isError ? <AlertCircle size={13} /> : <Check size={13} />} {message}
        </p>
      )}
    </div>
  );
}

export function VideoUploader({
  titleId,
  episodeId = null,
  status,
  playbackUrl,
}: {
  titleId: string;
  episodeId?: string | null;
  status: string | null;
  playbackUrl: string | null;
}) {
  const queryClient = useQueryClient();
  const createUpload = useCreateVideoUpload();
  const refreshVideo = useRefreshVideoAsset();
  const [assetId, setAssetId] = useState("");
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const assetQuery = useGetVideoAsset(assetId, {
    query: {
      enabled: Boolean(assetId),
      queryKey: getGetVideoAssetQueryKey(assetId),
    },
  });

  async function uploadVideo(file: File | undefined) {
    if (!file) return;
    setMessage("");
    setIsError(false);
    setUploadPercent(0);

    try {
      if (!file.type.startsWith("video/")) {
        throw new Error("Choose a video file.");
      }
      const upload = await createUpload.mutateAsync({
        data: {
          titleId,
          episodeId,
          maxDurationSeconds: 21_600,
          uploadLength: file.size,
          filename: file.name,
        },
      });
      setAssetId(upload.assetId);
      if (upload.uploadProtocol === "tus" || file.size > BASIC_UPLOAD_LIMIT) {
        await uploadTus(upload.uploadUrl, file, setUploadPercent);
      } else {
        await uploadBasicPost(upload.uploadUrl, file, setUploadPercent);
      }
      setUploadPercent(100);
      setMessage("Upload complete. Cloudflare Stream is processing the video.");
      void queryClient.invalidateQueries({
        queryKey: getGetVideoAssetQueryKey(upload.assetId),
      });
    } catch (error) {
      setIsError(true);
      setMessage(getErrorMessage(error));
      setUploadPercent(null);
    }
  }

  function checkStatus() {
    if (!assetId) return;
    refreshVideo.mutate(
      { assetId },
      {
        onSuccess: (asset) => {
          queryClient.setQueryData(getGetVideoAssetQueryKey(assetId), asset);
          setMessage(
            asset.status === "ready"
              ? "Video is ready for playback."
              : `Video status: ${asset.status}.`,
          );
          setIsError(false);
        },
        onError: (error) => {
          setIsError(true);
          setMessage(getErrorMessage(error));
        },
      },
    );
  }

  const effectiveStatus = assetQuery.data?.status ?? status;

  return (
    <div className="admin-media-block">
      <div className="admin-media-label"><Video size={15} /><span>Video</span></div>
      <div className="admin-video-status" data-testid={`status-video-${episodeId ?? titleId}`}>
        <span className={`admin-status-dot status-${effectiveStatus ?? "missing"}`} />
        <span>{effectiveStatus ?? "No video uploaded"}</span>
        {playbackUrl && <a href={playbackUrl} target="_blank" rel="noreferrer">HLS manifest</a>}
      </div>
      <div className="admin-upload-actions">
        <label className="admin-file-button">
          <input
            type="file"
            accept="video/*"
            disabled={createUpload.isPending || uploadPercent !== null && uploadPercent < 100}
            onChange={(event) => {
              void uploadVideo(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
            data-testid={`input-video-upload-${episodeId ?? titleId}`}
          />
          {createUpload.isPending || (uploadPercent !== null && uploadPercent < 100)
            ? <LoaderCircle size={14} className="animate-spin" />
            : <Upload size={14} />}
          Upload video
        </label>
        {assetId && (
          <button
            className="admin-secondary-button"
            onClick={checkStatus}
            disabled={refreshVideo.isPending}
            data-testid={`button-refresh-video-${assetId}`}
          >
            {refreshVideo.isPending ? <LoaderCircle size={14} className="animate-spin" /> : null}
            Check processing
          </button>
        )}
      </div>
      {uploadPercent !== null && (
        <div className="admin-progress" role="progressbar" aria-valuenow={uploadPercent} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: `${uploadPercent}%` }} />
          <span>{uploadPercent}%</span>
        </div>
      )}
      {message && (
        <p className={isError ? "admin-inline-error" : "admin-inline-success"} role="status" data-testid={`status-video-upload-${episodeId ?? titleId}`}>
          {isError ? <AlertCircle size={13} /> : <Check size={13} />} {message}
        </p>
      )}
      {assetQuery.isError && (
        <p className="admin-inline-error" role="alert">Could not refresh the video asset record.</p>
      )}
    </div>
  );
}
