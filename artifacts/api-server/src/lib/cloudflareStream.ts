type CloudflareEnvelope<T> = {
  success: boolean;
  result?: T;
  errors?: Array<{ message?: string; code?: number }>;
};

export type CloudflareStreamVideo = {
  uid?: string;
  duration?: number;
  readyToStream?: boolean;
  playback?: {
    hls?: string;
    dash?: string;
  };
  status?: {
    state?: string;
    errorReasonText?: string;
  };
};

export class StreamConfigurationError extends Error {
  constructor() {
    super(
      "Cloudflare Stream is not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.",
    );
    this.name = "StreamConfigurationError";
  }
}

export class StreamApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "StreamApiError";
  }
}

function getConfig(): { accountId: string; apiToken: string } {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !apiToken) throw new StreamConfigurationError();
  return { accountId, apiToken };
}

async function streamRequest<T>(
  endpoint: string,
  init?: RequestInit,
): Promise<T> {
  const { accountId, apiToken } = getConfig();
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream${endpoint}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
      signal: init?.signal ?? AbortSignal.timeout(30_000),
    },
  );

  let payload: CloudflareEnvelope<T>;
  try {
    payload = (await response.json()) as CloudflareEnvelope<T>;
  } catch {
    throw new StreamApiError(
      "Cloudflare Stream returned an unreadable response.",
      response.status,
    );
  }

  if (!response.ok || !payload.success || payload.result == null) {
    const message =
      payload.errors
        ?.map((error) => error.message)
        .filter(Boolean)
        .join("; ") || "Cloudflare Stream request failed.";
    throw new StreamApiError(message, response.status);
  }

  return payload.result;
}

export async function createStreamDirectUpload(input: {
  maxDurationSeconds: number;
  creator: string;
  titleId: string;
  episodeId: string | null;
  uploadLength?: number;
  filename?: string;
}): Promise<{ uid: string; uploadURL: string; uploadProtocol: "post" | "tus" }> {
  if (input.uploadLength && input.uploadLength > 200 * 1024 * 1024) {
    const { accountId, apiToken } = getConfig();
    const metadata = [
      `maxDurationSeconds ${Buffer.from(String(input.maxDurationSeconds)).toString("base64")}`,
      ...(input.filename
        ? [`name ${Buffer.from(input.filename.slice(0, 255)).toString("base64")}`]
        : []),
    ].join(",");
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream?direct_user=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Tus-Resumable": "1.0.0",
          "Upload-Length": String(input.uploadLength),
          "Upload-Metadata": metadata,
        },
        signal: AbortSignal.timeout(30_000),
      },
    );

    const uploadURL = response.headers.get("Location");
    if (!response.ok || !uploadURL) {
      const message = await response.text().catch(() => "");
      throw new StreamApiError(
        message || "Cloudflare Stream could not create a resumable upload.",
        response.status,
      );
    }
    const uid = new URL(uploadURL).pathname.split("/").filter(Boolean).at(-1);
    if (!uid) {
      throw new StreamApiError(
        "Cloudflare Stream returned an invalid resumable upload URL.",
        502,
      );
    }
    return { uid, uploadURL, uploadProtocol: "tus" };
  }

  const result = await streamRequest<{ uid?: string; uploadURL?: string }>(
    "/direct_upload",
    {
      method: "POST",
      body: JSON.stringify({
        maxDurationSeconds: input.maxDurationSeconds,
        creator: input.creator.slice(0, 64),
        meta: {
          titleId: input.titleId,
          episodeId: input.episodeId,
          filename: input.filename?.slice(0, 255) ?? null,
        },
      }),
    },
  );

  if (!result.uid || !result.uploadURL) {
    throw new StreamApiError(
      "Cloudflare Stream did not return an upload URL.",
      502,
    );
  }

  return { uid: result.uid, uploadURL: result.uploadURL, uploadProtocol: "post" };
}

export async function getStreamVideo(
  providerUid: string,
): Promise<CloudflareStreamVideo> {
  return streamRequest<CloudflareStreamVideo>(
    `/${encodeURIComponent(providerUid)}`,
    { method: "GET" },
  );
}

export async function deleteStreamVideo(providerUid: string): Promise<void> {
  const { accountId, apiToken } = getConfig();
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream/${encodeURIComponent(providerUid)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiToken}` },
      signal: AbortSignal.timeout(30_000),
    },
  );

  if (response.status === 404) return;
  if (!response.ok) {
    throw new StreamApiError(
      `Cloudflare Stream could not delete video ${providerUid}.`,
      response.status,
    );
  }
}

export function mapStreamStatus(video: CloudflareStreamVideo):
  | "pending"
  | "processing"
  | "ready"
  | "failed" {
  if (video.readyToStream || video.status?.state === "ready") return "ready";
  if (video.status?.state === "error") return "failed";
  if (
    video.status?.state === "pendingupload" ||
    video.status?.state === "downloading"
  ) {
    return "pending";
  }
  return "processing";
}
