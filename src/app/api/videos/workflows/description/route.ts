import { and, eq } from "drizzle-orm";
import { serve } from "@upstash/workflow/nextjs"
import { GoogleGenAI } from "@google/genai";
import { db } from "@/db";
import { videos } from "@/db/schema";

interface InputType {
  userId: string;
  videoId: string;
};

const DESCRIPTION_SYSTEM_PROMPT = `Your task is to summarize the transcript of a video. Please follow these guidelines:
- Be brief. Condense the content into a summary that captures the key points and main ideas without losing important details.
- Avoid jargon or overly complex language unless necessary for the context.
- Focus on the most critical information, ignoring filler, repetitive statements, or irrelevant tangents.
- ONLY return the summary, no other text, annotations, or comments.
- Aim for a summary that is 3-5 sentences long and no more than 200 characters.`;

export const { POST } = serve(
  async (context) => {
    const input = context.requestPayload as InputType;
    const { videoId, userId } = input;

    const video = await context.run("get-video", async () => {
      const [existingVideo] = await db
        .select()
        .from(videos)
        .where(and(
          eq(videos.id, videoId),
          eq(videos.userId, userId),
        ));

      if (!existingVideo) {
        throw new Error("Not found");
      }

      return existingVideo;
    });

    const transcript = await context.run("get-transcript", async () => {
      if (!video.muxPlaybackId || !video.muxTrackId) {
        throw new Error("Transcript not ready");
      }
      const trackUrl = `https://stream.mux.com/${video.muxPlaybackId}/text/${video.muxTrackId}.txt`;
      const response = await fetch(trackUrl);
      if (!response.ok) {
        throw new Error("Failed to fetch transcript");
      }
      const text = await response.text();

      if (!text) {
        throw new Error("Bad request");
      }

      return text;
    })

    const description = await context.run("generate-description", async () => {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: transcript,
        config: {
          systemInstruction: DESCRIPTION_SYSTEM_PROMPT,
        },
      });

      return response.text?.trim();
    });

    if (!description) {
      throw new Error("Bad request");
    }

    await context.run("update-video", async () => {
      await db
        .update(videos)
        .set({
          description,
        })
        .where(and(
          eq(videos.id, video.id),
          eq(videos.userId, video.userId),
        ))
    })
  }
)