import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Skeletons mirror the real layouts so content doesn't jump when it arrives.

export function PageHeaderSkeleton({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="space-y-2.5">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {withAction ? <Skeleton className="h-8 w-32 rounded-lg" /> : null}
    </div>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <Card key={index} className="gap-3 px-5 py-5">
          <div className="flex items-start justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="size-9 rounded-lg" />
          </div>
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-24" />
        </Card>
      ))}
    </div>
  );
}

export function ChartCardSkeleton({ className }: { className?: string }) {
  const heights = [40, 65, 30, 80, 55, 90, 45, 70, 35, 60, 85, 50, 75, 62];
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <div className="flex h-60 items-end gap-2 border-b pb-px">
          {heights.map((height, index) => (
            <Skeleton key={index} className="flex-1 rounded-b-none" style={{ height: `${height}%` }} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ListCardSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-52" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
            <Skeleton className="h-7 w-16 rounded-lg" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function TableSkeleton({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center gap-4 border-b px-4 py-3">
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={index} className={cn("h-3.5", index === 0 ? "w-40" : "w-20 flex-1")} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-4 border-b px-4 py-3.5 last:border-b-0">
          <div className="flex w-40 items-center gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
          {Array.from({ length: columns - 1 }, (_, column) => (
            <Skeleton key={column} className="h-3.5 flex-1" />
          ))}
        </div>
      ))}
    </Card>
  );
}

export function ToolbarSkeleton() {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex gap-1">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-8 w-24 rounded-lg" />
        ))}
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <Skeleton className="h-9 w-40 rounded-lg" />
      </div>
    </div>
  );
}

export function ListPageSkeleton({ withAction = false, columns = 5 }: { withAction?: boolean; columns?: number }) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction={withAction} />
      <ToolbarSkeleton />
      <TableSkeleton columns={columns} />
    </div>
  );
}

export function FormSectionSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">
        {Array.from({ length: fields }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function DetailPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-28" />
      <Card className="flex-row items-center gap-5 px-6 py-6">
        <Skeleton className="size-20 rounded-2xl" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="hidden h-8 w-40 rounded-lg sm:block" />
      </Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <FormSectionSkeleton fields={6} />
          <FormSectionSkeleton fields={4} />
        </div>
        <ListCardSkeleton rows={4} />
      </div>
    </div>
  );
}
