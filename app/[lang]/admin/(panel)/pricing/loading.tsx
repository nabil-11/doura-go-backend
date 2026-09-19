import { FormSectionSkeleton, ListCardSkeleton, PageHeaderSkeleton } from "@/components/admin/skeletons";

export default function PricingLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withAction />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <FormSectionSkeleton fields={4} />
          <FormSectionSkeleton fields={3} />
        </div>
        <ListCardSkeleton rows={3} />
      </div>
    </div>
  );
}
