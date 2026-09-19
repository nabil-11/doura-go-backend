"use client";

import { ChartColumnIcon, Table2Icon } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { useLocale } from "@/components/i18n/locale-provider";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { localeMeta } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

type Point = { day: string; label: string; fullLabel: string; completed: number };

type Labels = {
  title: string;
  subtitle: string;
  total: string;
  rides: string;
  date: string;
  chartView: string;
  tableView: string;
  empty: string;
};

/**
 * Single series (completed rides per day): no legend box, the title names it.
 * Bars ≤24px with 4px rounded tops, hairline grid, hover tooltip, and a table
 * view carrying the same values.
 */
export function RidesChartCard({ data, labels, className }: { data: Point[]; labels: Labels; className?: string }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const locale = useLocale();
  const rtl = localeMeta[locale].dir === "rtl";
  const empty = data.every((point) => point.completed === 0);

  const config = {
    completed: { label: labels.rides, color: "var(--chart-1)" },
  } satisfies ChartConfig;

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <CardDescription>
          {labels.subtitle} · {labels.total}
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={view}
            onValueChange={(value) => value && setView(value as "chart" | "table")}
          >
            <ToggleGroupItem value="chart" aria-label={labels.chartView} title={labels.chartView}>
              <ChartColumnIcon />
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label={labels.tableView} title={labels.tableView}>
              <Table2Icon />
            </ToggleGroupItem>
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="grid h-64 place-items-center rounded-lg border border-dashed px-6 text-center text-sm text-muted-foreground">
            {labels.empty}
          </div>
        ) : view === "chart" ? (
          <ChartContainer config={config} className="aspect-auto h-64 w-full">
            <BarChart data={data} margin={{ top: 8, left: 4, right: 4, bottom: 0 }} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={16}
                reversed={rtl}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={32}
                orientation={rtl ? "right" : "left"}
                tickFormatter={(value: number) => formatNumber(locale, value)}
              />
              <ChartTooltip
                cursor={{ fill: "var(--muted)", fillOpacity: 0.6 }}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    labelFormatter={(_, payload) => (payload?.[0]?.payload as Point | undefined)?.fullLabel}
                  />
                }
              />
              <Bar dataKey="completed" fill="var(--color-completed)" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="max-h-64 overflow-y-auto rounded-lg border">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>{labels.date}</TableHead>
                  <TableHead className="text-end">{labels.rides}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...data].reverse().map((point) => (
                  <TableRow key={point.day}>
                    <TableCell>{point.fullLabel}</TableCell>
                    <TableCell className="tabular text-end font-medium">{formatNumber(locale, point.completed)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
