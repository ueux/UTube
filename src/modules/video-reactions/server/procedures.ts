import { db } from "@/db";
import { videos, videoReactions } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import z from "zod";

const assertViewableVideo = async (videoId: string, userId: string) => {
  const [existingVideo] = await db
    .select({ id: videos.id, userId: videos.userId, visibility: videos.visibility })
    .from(videos)
    .where(eq(videos.id, videoId));
  if (!existingVideo) throw new TRPCError({ code: "NOT_FOUND" });
  if (existingVideo.visibility !== "public" && existingVideo.userId !== userId)
    throw new TRPCError({ code: "FORBIDDEN" });
};

export const videoReactionsRouter = createTRPCRouter({
  like: protectedProcedure
    .input(z.object({ videoId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { videoId } = input;
      const { id: userId } = ctx.user;
      await assertViewableVideo(videoId, userId);
      const [existingVideoReactionLike] = await db
        .select()
        .from(videoReactions)
        .where(
          and(eq(videoReactions.videoId, videoId), eq(videoReactions.userId, userId),eq(videoReactions.type,"like"))
        );
        if (existingVideoReactionLike) {
            const [deletedViewerReaction] = await db.delete(videoReactions).where(and(
              eq(videoReactions.videoId, videoId), eq(videoReactions.userId, userId)
            )).returning()
            return deletedViewerReaction
      }
      const [createdVideoReaction] = await db
        .insert(videoReactions)
          .values({ userId, videoId, type: "like" })
          .onConflictDoUpdate({
              target:[videoReactions.userId, videoReactions.videoId],
              set: {type:"like",}
          })
        .returning();
      return createdVideoReaction;
    }),
    dislike: protectedProcedure
    .input(z.object({ videoId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const { videoId } = input;
      const { id: userId } = ctx.user;
      await assertViewableVideo(videoId, userId);
      const [existingVideoReactionDislike] = await db
        .select()
        .from(videoReactions)
        .where(
          and(eq(videoReactions.videoId, videoId), eq(videoReactions.userId, userId),eq(videoReactions.type,"dislike"))
        );
        if (existingVideoReactionDislike) {
            const [deletedViewerReaction] = await db.delete(videoReactions).where(and(
              eq(videoReactions.videoId, videoId), eq(videoReactions.userId, userId)
            )).returning()
            return deletedViewerReaction
      }
      const [createdVideoReaction] = await db
        .insert(videoReactions)
          .values({ userId, videoId, type: "dislike" })
          .onConflictDoUpdate({
              target:[videoReactions.userId, videoReactions.videoId],
              set: {type:"dislike",}
          })
        .returning();
      return createdVideoReaction;
    }),
});
