import {
  ChartCardSkeleton,
  ListCardSkeleton,
  PageHeaderSkeleton,
  StatCardsSkeleton,
} from "@/components/admin/skeletons";

export default function OverviewLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <StatCardsSkeleton />
      <div className="grid gap-6 lg:grid-cols-3">
        <ChartCardSkeleton className="lg:col-span-2" />
        <ListCardSkeleton rows={4} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ListCardSkeleton />
        <ListCardSkeleton />
      </div>
    </div>
  );
}
