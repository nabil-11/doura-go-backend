import { ShieldAlertIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

import { EmptyState } from "./empty-state";

export function AccessDenied({ dict }: { dict: Dictionary }) {
  return (
    <Card className="mx-auto max-w-lg">
      <EmptyState icon={ShieldAlertIcon} title={dict.admin.denied.title} description={dict.admin.denied.description} />
    </Card>
  );
}
