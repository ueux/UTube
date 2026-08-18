'use client'

import { DEFAULT_LIMIT } from '@/constants'
import { trpc } from '@/trpc/client'
import React, { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { VideoRowCard, VideoRowCardSkeleton } from '../components/video-row-card'
import { VideoGridCard, VideoGridCardSkeleton } from '../components/video-grid-card'
import { InfiniteScroll } from '@/components/infinite-scroll'

interface SuggestionsSectionProps {
  videoId: string,
  isManual?:boolean
}

export const SuggestionsSection = ({ videoId ,isManual}: SuggestionsSectionProps) => {
  return (
    <Suspense fallback={<SuggestionsSectionSkeleton />}>
      <ErrorBoundary fallback={<>Error</>}>
        <SuggestionsSectionSuspense videoId={videoId} isManual={isManual} />
      </ErrorBoundary>
    </Suspense>
  )
}

const SuggestionsSectionSkeleton = () => {
  return (<>
    <div className='hidden md:block space-y-3'>
      {Array.from({ length: 8 }).map((_, i) => (
        <VideoRowCardSkeleton key={i} size="compact"/>
      ))}
    </div>
    <div className='block md:hidden space-y-10'>
      {Array.from({ length: 8 }).map((_, i) => (
        <VideoGridCardSkeleton key={i}/>
      ))}
    </div>
  </>)
}

const SuggestionsSectionSuspense = ({ videoId ,isManual}: SuggestionsSectionProps) => {
  const [suggestions, query] = trpc.suggestions.getMany.useSuspenseInfiniteQuery({ videoId, limit: DEFAULT_LIMIT },
    { getNextPageParam: (lastPage) => lastPage.nextCursor })
  return (<>
    <div className='hidden md:block space-y-10'>
      {suggestions.pages.flatMap((page) => page.items.map((video) => (
        <VideoRowCard key={video.id} data={video} size={"compact"} />
      )))}
    </div>
    <div className='block md:hidden space-y-10'>
      {suggestions.pages.flatMap((page) => page.items.map((video) => (
        <VideoGridCard key={video.id} data={video}  />
      )))}
    </div>
    <InfiniteScroll isManual={isManual} hasNextPage={query.hasNextPage} isFetchingNextPage={query.isFetchingNextPage} fetchNextPage={query.fetchNextPage}/>
  </>)
}