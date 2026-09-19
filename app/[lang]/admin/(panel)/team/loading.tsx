import { PageHeaderSkeleton, TableSkeleton } from "@/components/admin/skeletons";

export default function TeamLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction />
      <TableSkeleton rows={4} columns={4} />
    </div>
  );
}
