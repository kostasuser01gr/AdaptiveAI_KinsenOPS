/**
 * HeatmapTableBlock — Renders a data heatmap as a color-coded table.
 * Values interpolated between min/max colors.
 */
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface HeatmapTableData {
  type: "heatmap_table";
  title?: string;
  rowHeaders: string[];
  colHeaders: string[];
  data: number[][];
  minColor?: string;
  maxColor?: string;
  valueFormatter?: string;
}

function interpolateColor(min: string, max: string, ratio: number): string {
  const parseHex = (hex: string) => {
    const h = hex.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = parseHex(min);
  const [r2, g2, b2] = parseHex(max);
  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);
  return `rgb(${r}, ${g}, ${b})`;
}

function formatValue(val: number, formatter?: string): string {
  if (formatter === "percent") return `${val}%`;
  if (formatter === "currency") return `$${val.toLocaleString()}`;
  return val.toLocaleString();
}

export function HeatmapTableBlock({ block }: { block: HeatmapTableData }) {
  const flat = block.data.flat();
  const minVal = Math.min(...flat);
  const maxVal = Math.max(...flat);
  const range = maxVal - minVal || 1;
  const minColor = block.minColor || "#e8f5e9";
  const maxColor = block.maxColor || "#1b5e20";

  return (
    <Card>
      {block.title && (
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{block.title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="overflow-x-auto pb-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left text-xs font-medium text-muted-foreground" />
              {block.colHeaders.map((col, i) => (
                <th key={i} className="p-2 text-center text-xs font-medium text-muted-foreground border-b">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rowHeaders.map((row, ri) => (
              <tr key={ri}>
                <td className="p-2 text-xs font-medium text-muted-foreground border-r whitespace-nowrap">
                  {row}
                </td>
                {(block.data[ri] || []).map((val, ci) => {
                  const ratio = (val - minVal) / range;
                  const bg = interpolateColor(minColor, maxColor, ratio);
                  const textColor = ratio > 0.5 ? "#fff" : "#111";
                  return (
                    <td
                      key={ci}
                      className="p-2 text-center text-xs font-mono tabular-nums border border-border/30 rounded-sm"
                      style={{ backgroundColor: bg, color: textColor }}
                    >
                      {formatValue(val, block.valueFormatter)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
