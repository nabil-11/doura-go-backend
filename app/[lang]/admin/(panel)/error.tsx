"use client";

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect } from "react";

import { EmptyState } from "@/components/admin/empty-state";
import { useDictionary } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function PanelError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const dict = useDictionary();

  useEffect(() => {
    console.error(error);
  }, [error]);

  const isDatabase = /Mongo|ECONNREFUSED|querySrv|Server selection/i.test(`${error.name} ${error.message}`);

  return (
    <Card className="mx-auto max-w-lg">
      <EmptyState
        icon={TriangleAlertIcon}
        title={dict.errorPage.title}
        description={isDatabase ? dict.errors.database : dict.errorPage.description}
      >
        <Button onClick={reset}>
          <RotateCcwIcon />
          {dict.common.retry}
        </Button>
        {error.digest ? <p className="font-mono text-xs text-muted-foreground">{error.digest}</p> : null}
      </EmptyState>
    </Card>
  );
}
