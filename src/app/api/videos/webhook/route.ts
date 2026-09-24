import { db } from "@/db";
import { videos } from "@/db/schema";
import { mux } from "@/lib/mux";
import {
  VideoAssetCreatedWebhookEvent,
  VideoAssetDeletedWebhookEvent,
  VideoAssetErroredWebhookEvent,
  VideoAssetReadyWebhookEvent,
  VideoAssetTrackReadyWebhookEvent,
} from "@mux/mux-node/resources/webhooks";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { UTApi } from "uploadthing/server";

const SIGNING_SECRET = process.env.MUX_WEBHOOK_SECRET;
type WebhookEvent =
  | VideoAssetCreatedWebhookEvent
  | VideoAssetReadyWebhookEvent
  | VideoAssetErroredWebhookEvent
  | VideoAssetTrackReadyWebhookEvent
  | VideoAssetDeletedWebhookEvent;

export const POST = async (req: Request) => {
  if (!SIGNING_SECRET) throw new Error("MUX_WEBHOOK_SECRET is not set");
  const headersPayload = await headers();
  const muxSignature = headersPayload.get("mux-signature");
  if (!muxSignature) return new Response("No signature found", { status: 401 });
  const payload = await req.json();
  const body = JSON.stringify(payload);
  try {
    mux.webhooks.verifySignature(body, {
      "mux-signature": muxSignature,
    });
  } catch {
    return new Response("Invalid signature", { status: 401 });
  }
  switch (payload.type as WebhookEvent["type"]) {
    case "video.asset.created": {
      const data = payload.data as VideoAssetCreatedWebhookEvent["data"];
      if (!data.upload_id)
        return new Response("No upload id found", { status: 400 });
      await db
        .update(videos)
        .set({
          muxAssetId: data.id,
          muxStatus: data.status,
        })
        .where(eq(videos.muxUploadId, data.upload_id));
      break;
    }
    case "video.asset.ready": {
      const data = payload.data as VideoAssetReadyWebhookEvent["data"];
      const playbackId = data.playback_ids?.[0].id;
      if (!data.upload_id)
        return new Response("No upload Id found", { status: 400 });
      if (!playbackId)
        return new Response("Missing playback Id", { status: 400 });
      const tempThumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg`;
      const tempPreviewlUrl = `https://image.mux.com/${playbackId}/animated.gif`;
      const duration = data.duration ? Math.round(data.duration * 1000) : 0;
      const utapi = new UTApi();
      const[uploadedThumbnail,uploadedPreview]=await utapi.uploadFilesFromUrl([
          tempThumbnailUrl,tempPreviewlUrl
      ]);
      if (!uploadedThumbnail?.data || !uploadedPreview?.data) {
        console.error("Failed to upload thumbnail/preview to UploadThing", {
          thumbnail: uploadedThumbnail?.error,
          preview: uploadedPreview?.error,
        });
        return new Response("Failed to upload thumbnail or preview", { status: 500 });
      }
      const { key: thumbnailKey, ufsUrl: thumbnailUrl } = uploadedThumbnail.data;
      const {key:previewKey,ufsUrl:previewUrl}=uploadedPreview.data;
      await db
        .update(videos)
        .set({
          muxStatus: data.status,
          muxPlaybackId: playbackId,
          muxAssetId: data.id,
          thumbnailUrl: thumbnailUrl,
          thumbnailKey:thumbnailKey,
          previewUrl: previewUrl,
          previewKey:previewKey,
          duration: duration,
        })
        .where(eq(videos.muxUploadId, data.upload_id));
      break;
    }
    case "video.asset.errored": {
      const data = payload.data as VideoAssetErroredWebhookEvent["data"];
      if (!data.upload_id)
        return new Response("No upload Id found", { status: 400 });
      await db
        .update(videos)
        .set({
          muxStatus: data.status,
        })
        .where(eq(videos.muxUploadId, data.upload_id));
      break;
    }
    case "video.asset.deleted": {
      const data = payload.data as VideoAssetDeletedWebhookEvent["data"];
      if (!data.upload_id)
        return new Response("No upload Id found", { status: 400 });
      await db
        .delete(videos)
        .where(eq(videos.muxUploadId, data.upload_id));
      break;
    }
    case "video.asset.track.ready": {
          const data = payload.data as VideoAssetTrackReadyWebhookEvent["data"] & {
          asset_id:string
      };
          const assetId = data.asset_id
                if (!assetId)
        return new Response("Missing asset ID", { status: 400 });
      await db
        .update(videos)
        .set({
            muxTrackStatus: data.status,
            muxTrackId:data.id
        })
        .where(eq(videos.muxAssetId, assetId));
      break;
    }
  }
  return new Response("Webhook received", { status: 200 });
};
