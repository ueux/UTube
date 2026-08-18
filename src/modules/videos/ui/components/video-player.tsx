'use client'

import MuxPLayer from "@mux/mux-player-react"
import { THUMBNAIL_FALLBACK } from "../../constants";

interface VideoPlayerProps{
    playbackId?: string | null | undefined;
    thumbnailUrl?: string | null | undefined;
    autoPlay?: boolean;
    onPlay?:()=>void
}

export const VideoPlayerSkeleton = () => {
    return  <div className="aspect-video bg-black rounded-xl"/>
}

export const VideoPlayer = ({ playbackId, thumbnailUrl,autoPlay,onPlay }: VideoPlayerProps) => {

    return (<MuxPLayer playbackId={playbackId||""}
        poster={thumbnailUrl ||THUMBNAIL_FALLBACK}
        playerInitTime={0}
        autoPlay={autoPlay}
        thumbnailTime={0}
        className="w-full h-full object-fill"
        accentColor="#FF2056"
        onPlay={onPlay}
    />)
}