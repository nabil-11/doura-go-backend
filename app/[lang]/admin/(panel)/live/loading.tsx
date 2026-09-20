import { PageHeaderSkeleton } from "@/components/admin/skeletons";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function LiveLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-9 w-36 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-[clamp(20rem,58vh,36rem)] w-full rounded-xl" />
        <Skeleton className="h-9 w-56 rounded-lg" />
        <Card className="overflow-hidden p-0">
          <div className="divide-y">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="flex items-center gap-4 px-4 py-3.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="ms-auto h-5 w-24 rounded-full" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
