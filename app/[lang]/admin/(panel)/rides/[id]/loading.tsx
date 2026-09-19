import { FormSectionSkeleton, ListCardSkeleton } from "@/components/admin/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function RideLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-28" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <FormSectionSkeleton fields={2} />
          <FormSectionSkeleton fields={4} />
        </div>
        <ListCardSkeleton rows={4} />
      </div>
    </div>
  );
}
