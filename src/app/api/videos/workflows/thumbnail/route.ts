import { and, eq } from "drizzle-orm";
import { UTApi, UTFile } from "uploadthing/server";
import { serve } from "@upstash/workflow/nextjs";
import { GoogleGenAI } from "@google/genai";
import { db } from "@/db";
import { videos } from "@/db/schema";

interface InputType {
  userId: string;
  videoId: string;
  prompt: string;
}

export const { POST } = serve(async (context) => {
  const utapi = new UTApi();
  const input = context.requestPayload as InputType;
  const { videoId, userId, prompt } = input;

  const video = await context.run("get-video", async () => {
    const [existingVideo] = await db
      .select()
      .from(videos)
      .where(and(eq(videos.id, videoId), eq(videos.userId, userId)));

    if (!existingVideo) {
      throw new Error("Not found");
    }

    return existingVideo;
  });

  const imageBuffer = await context.run("generate-thumbnail", async () => {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!,
    });

    const interaction = await ai.interactions.create({
      model: "gemini-3.1-flash-image",
      input: prompt,
      response_format: {
        type: "image",
        aspect_ratio: "16:9",
        image_size: "2K",
      },
    });

    const generatedImage = interaction.output_image;

    if (!generatedImage) {
      throw new Error("Gemini failed to generate an image");
    }
    if (!generatedImage.data) {
      throw new Error("Gemini returned an image without data");
    }

    return Buffer.from(generatedImage.data, "base64");
  });

  await context.run("cleanup-thumbnail", async () => {
    if (video.thumbnailKey) {
      await utapi.deleteFiles(video.thumbnailKey);
      await db
        .update(videos)
        .set({ thumbnailKey: null, thumbnailUrl: null })
        .where(and(eq(videos.id, videoId), eq(videos.userId, userId)));
    }
  });

  const uploadedThumbnail = await context.run("upload-thumbnail", async () => {
    const file = new UTFile([imageBuffer], `thumbnail-${videoId}.png`, {
      type: "image/png",
    });

    const response = await utapi.uploadFiles(file);

    if (!response.data) {
      throw new Error(response.error?.message ?? "Failed to upload thumbnail");
    }

    return response.data;
  });

  await context.run("update-video", async () => {
    await db
      .update(videos)
      .set({
        thumbnailKey: uploadedThumbnail.key,
        thumbnailUrl: uploadedThumbnail.ufsUrl,
      })
      .where(and(eq(videos.id, video.id), eq(videos.userId, video.userId)));
  });
});
