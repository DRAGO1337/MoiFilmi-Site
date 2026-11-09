import {
  mediaAssetsTable,
  type MediaAsset,
} from "@workspace/db";
import {
  deleteStreamVideo,
} from "./cloudflareStream";
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from "./objectStorage";

const objectStorage = new ObjectStorageService();

export async function removeMediaAssets(assets: MediaAsset[]): Promise<void> {
  for (const asset of assets) {
    if (asset.provider === "cloudflare_stream" && asset.providerUid) {
      await deleteStreamVideo(asset.providerUid);
    }

    if (asset.provider === "replit_object_storage" && asset.objectPath) {
      try {
        const file = await objectStorage.getObjectEntityFile(asset.objectPath);
        await file.delete({ ignoreNotFound: true });
      } catch (error) {
        if (!(error instanceof ObjectNotFoundError)) throw error;
      }
    }
  }
}

export { mediaAssetsTable };
