'use client'
import { InfiniteScroll } from "@/components/infinite-scroll";
import { DEFAULT_LIMIT } from "@/constants";
import { trpc } from "@/trpc/client";
import Link from "next/link";
import { Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { toast } from "sonner";
import { SubscriptionItem, SubscriptionItemSkeleton } from "../componets/subscription-item";


export const AllSubscriptionsSection = () => {
    return (<Suspense
        fallback={<AllSubscriptionsSkeleton />}>
        <ErrorBoundary fallback={<p>Error...</p>}>
            <AllSubscriptionsSectionSuspense />
        </ErrorBoundary>
    </Suspense>
    )
}
const AllSubscriptionsSkeleton = () => {
    return (
        <div>
            <div className="gap-4 flex flex-col">
                {Array.from({ length: 8 }).map((_, index) => (
                    <SubscriptionItemSkeleton key={index} />
                ))}
            </div>
        </div>
    )
}

const AllSubscriptionsSectionSuspense = () => {
    const utils = trpc.useUtils();
    const [subscriptions, query] = trpc.subscriptions.getMany.useSuspenseInfiniteQuery({ limit: DEFAULT_LIMIT },
        { getNextPageParam: (lastPage) => lastPage.nextCursor }
    )
    const unsubscribe = trpc.subscriptions.remove.useMutation({
        onSuccess: (data) => {
            toast.success("Unsubscribed")
            utils.videos.getManySubscribed.invalidate();
            utils.users.getOne.invalidate({ id: data.creatorId });
            utils.subscriptions.getMany.invalidate();
        },
        onError: () => {
            toast.error("Something went wrong")
        }
    })
    return (<>
        <div className="gap-4 flex flex-col">
            {subscriptions.pages.flatMap((page) => page.items).map((subscription) => (
                <Link prefetch key={subscription.creatorId} href={`/users/${subscription.user.id}`}>
                    <SubscriptionItem
                        name={subscription.user.name}
                        imageUrl={subscription.user.imageUrl}
                        subscriberCount={subscription.user.subscriberCount}
                        onUnsubscribe={() => {
                            unsubscribe.mutate({
                                userId: subscription.creatorId
                            })
                        }}
                        disabled={unsubscribe.isPending} />
                </Link>
            ))}
        </div>
        <InfiniteScroll hasNextPage={query.hasNextPage} isFetchingNextPage={query.isFetchingNextPage} fetchNextPage={query.fetchNextPage} />
    </>)
}