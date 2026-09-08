import type { ReactNode } from "react";
import { Svg, Rect, Line, Text, G } from "@react-pdf/renderer";

// react-pdf's own SVGTextProps type omits `fontSize` even though the
// runtime reads it directly off an SVG-mode <Text>'s props (confirmed in
// @react-pdf/layout's source) — same as every other SVG presentation
// attribute here. This local alias just gives that real capability a type.
const SvgText = Text as unknown as (props: {
  x: number;
  y: number;
  fontSize: number;
  fill: string;
  textAnchor?: "start" | "middle" | "end";
  children: ReactNode;
}) => ReactNode;

export type ChartSeries = {
  label: string;
  color: string;
  values: number[];
};

const AXIS_COLOR = "#d1d5db";
const LABEL_COLOR = "#6b7280";
const VALUE_COLOR = "#374151";
const DEFAULT_FORMATTER = (value: number) => Math.round(value).toLocaleString();

/** Vertical bar chart: one cluster of bars per category, one bar per
 * series within a cluster (e.g. Earning vs Expense per month). Canvas size
 * is fixed and the scale is derived from the data's own max value — there
 * is no axis-tick grid, just a baseline, value labels above each bar, and
 * category labels below. */
export function GroupedBarChart({
  categories,
  series,
  width = 480,
  height = 190,
  valueFormatter = DEFAULT_FORMATTER,
}: {
  categories: string[];
  series: ChartSeries[];
  width?: number;
  height?: number;
  valueFormatter?: (value: number) => string;
}) {
  const paddingTop = 16;
  const paddingBottom = 22;
  const chartHeight = height - paddingTop - paddingBottom;
  const maxValue = Math.max(1, ...series.flatMap((s) => s.values));

  const clusterGap = 10;
  const clusterWidth =
    categories.length > 0
      ? (width - clusterGap * (categories.length + 1)) / categories.length
      : 0;
  const barGap = 2;
  const barWidth =
    series.length > 0
      ? (clusterWidth - barGap * (series.length - 1)) / series.length
      : clusterWidth;

  return (
    <Svg width={width} height={height}>
      <Line
        x1={0}
        y1={height - paddingBottom}
        x2={width}
        y2={height - paddingBottom}
        stroke={AXIS_COLOR}
        strokeWidth={1}
      />
      {categories.map((category, categoryIndex) => {
        const clusterX = clusterGap + categoryIndex * (clusterWidth + clusterGap);
        return (
          <G key={category}>
            {series.map((s, seriesIndex) => {
              const value = s.values[categoryIndex] ?? 0;
              const barHeight =
                maxValue > 0 ? (Math.max(value, 0) / maxValue) * chartHeight : 0;
              const x = clusterX + seriesIndex * (barWidth + barGap);
              const y = height - paddingBottom - barHeight;
              return (
                <G key={s.label}>
                  <Rect
                    x={x}
                    y={y}
                    width={Math.max(barWidth, 0.5)}
                    height={Math.max(barHeight, 0.5)}
                    fill={s.color}
                    rx={1.5}
                  />
                  {value > 0 && (
                    <SvgText
                      x={x + barWidth / 2}
                      y={y - 4}
                      fontSize={6.5}
                      fill={VALUE_COLOR}
                      textAnchor="middle"
                    >
                      {valueFormatter(value)}
                    </SvgText>
                  )}
                </G>
              );
            })}
            <SvgText
              x={clusterX + clusterWidth / 2}
              y={height - paddingBottom + 11}
              fontSize={7}
              fill={LABEL_COLOR}
              textAnchor="middle"
            >
              {category}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

/** Horizontal bar chart: one row per category, one bar per series within
 * that row (e.g. Allocated vs Spent per bucket, or a single-series top-N
 * list like top clients by revenue). Row count drives the height. */
export function HorizontalGroupedBarChart({
  categories,
  series,
  width = 480,
  rowHeight = 16,
  labelWidth = 110,
  valueFormatter = DEFAULT_FORMATTER,
}: {
  categories: string[];
  series: ChartSeries[];
  width?: number;
  rowHeight?: number;
  /** Reserved width on the left for the category label. */
  labelWidth?: number;
  valueFormatter?: (value: number) => string;
}) {
  const barAreaWidth = width - labelWidth - 60;
  const maxValue = Math.max(1, ...series.flatMap((s) => s.values));
  const barGap = 2;
  const barThickness =
    series.length > 0
      ? (rowHeight - barGap * (series.length - 1)) / series.length
      : rowHeight;
  const rowGap = 10;
  const height = categories.length * (rowHeight + rowGap) + rowGap;

  return (
    <Svg width={width} height={height}>
      {categories.map((category, categoryIndex) => {
        const rowY = rowGap + categoryIndex * (rowHeight + rowGap);
        return (
          <G key={category}>
            <SvgText
              x={0}
              y={rowY + rowHeight / 2 + 3}
              fontSize={7.5}
              fill={LABEL_COLOR}
            >
              {category}
            </SvgText>
            {series.map((s, seriesIndex) => {
              const value = s.values[categoryIndex] ?? 0;
              const barWidth =
                maxValue > 0
                  ? (Math.max(value, 0) / maxValue) * barAreaWidth
                  : 0;
              const y = rowY + seriesIndex * (barThickness + barGap);
              return (
                <G key={s.label}>
                  <Rect
                    x={labelWidth}
                    y={y}
                    width={Math.max(barWidth, 0.5)}
                    height={Math.max(barThickness, 0.5)}
                    fill={s.color}
                    rx={1.5}
                  />
                  <SvgText
                    x={labelWidth + barWidth + 4}
                    y={y + barThickness / 2 + 3}
                    fontSize={6.5}
                    fill={VALUE_COLOR}
                  >
                    {valueFormatter(value)}
                  </SvgText>
                </G>
              );
            })}
          </G>
        );
      })}
    </Svg>
  );
}

/** Small color-swatch + label row, for a chart legend under a
 * `GroupedBarChart`/`HorizontalGroupedBarChart` with more than one series. */
export function ChartLegend({ series }: { series: ChartSeries[] }) {
  return (
    <Svg width={480} height={14}>
      {series.map((s, i) => {
        const x = i * 100;
        return (
          <G key={s.label}>
            <Rect x={x} y={2} width={8} height={8} fill={s.color} rx={1.5} />
            <SvgText x={x + 12} y={9.5} fontSize={7.5} fill={LABEL_COLOR}>
              {s.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}
