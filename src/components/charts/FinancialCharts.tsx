"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import type { TrendSeries } from "@/lib/data/types";
import { formatByUnit } from "@/lib/format";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const AXIS = "hsl(215 20% 55%)";
const GRID = "hsl(217 33% 20%)";
const EMERALD = "hsl(152 69% 44%)";
const BLUE = "hsl(213 94% 60%)";
const RED = "hsl(0 72% 55%)";

function tooltipFormatter(unit: TrendSeries["unit"], currency: string) {
  return (value: number | string) =>
    [formatByUnit(typeof value === "number" ? value : null, unit, currency), ""] as [string, string];
}

interface ChartData {
  fiscalYear: number;
  value: number | null;
}

function toData(series: TrendSeries): ChartData[] {
  return series.points.map((p) => ({ fiscalYear: p.fiscalYear, value: p.value }));
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-52 w-full">{children}</div>
      </CardContent>
    </Card>
  );
}

const axisProps = {
  stroke: AXIS,
  tick: { fill: AXIS, fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: GRID },
};

const tooltipStyle = {
  contentStyle: {
    background: "hsl(222 44% 9%)",
    border: "1px solid hsl(217 33% 20%)",
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: "hsl(210 40% 96%)" },
  cursor: { fill: "hsl(217 33% 20% / 0.4)" },
};

function compactTick(unit: TrendSeries["unit"], currency: string) {
  return (v: number) => formatByUnit(v, unit, currency);
}

export function FinancialCharts({
  trends,
  currency,
}: {
  trends: TrendSeries[];
  currency: string;
}) {
  const byId = Object.fromEntries(trends.map((t) => [t.id, t]));
  const revenue = byId.revenue;
  const netIncome = byId.net_income;
  const margin = byId.net_margin;
  const fcf = byId.fcf;
  const debt = byId.total_debt;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {revenue && (
        <ChartCard title="Annual Revenue">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={toData(revenue)} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="fiscalYear" {...axisProps} />
              <YAxis {...axisProps} width={56} tickFormatter={compactTick("currency", currency)} />
              <Tooltip {...tooltipStyle} formatter={tooltipFormatter("currency", currency)} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} fill={EMERALD} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {netIncome && (
        <ChartCard title="Annual Net Income">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={toData(netIncome)} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="fiscalYear" {...axisProps} />
              <YAxis {...axisProps} width={56} tickFormatter={compactTick("currency", currency)} />
              <Tooltip {...tooltipStyle} formatter={tooltipFormatter("currency", currency)} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {toData(netIncome).map((d, i) => (
                  <Cell key={i} fill={(d.value ?? 0) >= 0 ? EMERALD : RED} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {margin && (
        <ChartCard title="Net Profit Margin">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={toData(margin)} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="fiscalYear" {...axisProps} />
              <YAxis {...axisProps} width={44} tickFormatter={compactTick("percent", currency)} />
              <Tooltip {...tooltipStyle} formatter={tooltipFormatter("percent", currency)} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={BLUE}
                strokeWidth={2.5}
                dot={{ r: 3, fill: BLUE }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {fcf && (
        <ChartCard title="Free Cash Flow">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={toData(fcf)} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="fiscalYear" {...axisProps} />
              <YAxis {...axisProps} width={56} tickFormatter={compactTick("currency", currency)} />
              <Tooltip {...tooltipStyle} formatter={tooltipFormatter("currency", currency)} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {toData(fcf).map((d, i) => (
                  <Cell key={i} fill={(d.value ?? 0) >= 0 ? EMERALD : RED} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {debt && (
        <ChartCard title="Total Debt Trend">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={toData(debt)} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="fiscalYear" {...axisProps} />
              <YAxis {...axisProps} width={56} tickFormatter={compactTick("currency", currency)} />
              <Tooltip {...tooltipStyle} formatter={tooltipFormatter("currency", currency)} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={RED}
                strokeWidth={2.5}
                dot={{ r: 3, fill: RED }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}
