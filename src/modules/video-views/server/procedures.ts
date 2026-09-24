import { db } from "@/db";
import { videos, videoViews } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import z from "zod";

export const videoViewsRouter = createTRPCRouter({
    create: protectedProcedure.input(z.object({ videoId: z.string().uuid() }))
        .mutation(async ({ input, ctx }) => {
            const { videoId } = input
            const { id: userId } = ctx.user;
            const [existingVideo] = await db
                .select({ id: videos.id, userId: videos.userId, visibility: videos.visibility })
                .from(videos)
                .where(eq(videos.id, videoId))
            if (!existingVideo) throw new TRPCError({ code: "NOT_FOUND" })
            if (existingVideo.visibility !== "public" && existingVideo.userId !== userId) throw new TRPCError({ code: "FORBIDDEN" })
            await db.insert(videoViews).values({ userId, videoId }).onConflictDoNothing()
            const [videoView] = await db.select().from(videoViews)
                .where(and(
                    eq(videoViews.videoId,videoId),
                    eq(videoViews.userId,userId)
                ))
            return videoView
    })
})
