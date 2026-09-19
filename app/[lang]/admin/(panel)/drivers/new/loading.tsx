import { FormSectionSkeleton, PageHeaderSkeleton } from "@/components/admin/skeletons";

export default function NewDriverLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeaderSkeleton />
      <FormSectionSkeleton fields={8} />
      <FormSectionSkeleton fields={2} />
      <FormSectionSkeleton fields={5} />
    </div>
  );
}
