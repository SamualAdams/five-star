import { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function formatChartDate(dateStr, days, compact) {
  const d = new Date(dateStr + "T00:00:00");
  if (compact && days <= 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  if (days <= 7) return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  if (days <= 90) return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function getTickInterval(days, compact) {
  if (compact) {
    if (days <= 3) return 0;
    if (days <= 7) return 1;
    if (days <= 30) return 5;
    if (days <= 90) return 14;
    if (days <= 180) return 29;
    return 59;
  }

  if (days <= 7) return 0;
  if (days <= 30) return 2;
  if (days <= 90) return 6;
  return 29;
}

function useChartWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    setWidth(element.getBoundingClientRect().width);

    if (typeof ResizeObserver === "undefined") return undefined;

    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

export default function SubmissionsChart({ data, days, loading = false, total, height = 140 }) {
  const [chartRef, chartWidth] = useChartWidth();
  const compact = chartWidth > 0 ? chartWidth < 420 : false;
  const tickInterval = getTickInterval(days, compact);
  const axisMargin = compact ? { top: 4, right: 8, left: -18, bottom: 8 } : { top: 4, right: 12, left: -20, bottom: 0 };

  const formattedData = useMemo(
    () => data.map((d) => ({
      ...d,
      label: formatChartDate(d.date, days, compact),
    })),
    [data, days, compact]
  );

  return (
    <div
      ref={chartRef}
      style={{
        background: "var(--color-surface-alt)",
        border: "1px solid var(--color-border-muted)",
        borderRadius: "12px",
        padding: "1rem 0.5rem 0.5rem",
        marginBottom: "1rem",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 0.75rem", marginBottom: "0.5rem" }}>
        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--color-neutral)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Submissions
        </span>
        {!loading && (
          <span style={{ fontSize: "0.82rem", color: "var(--color-neutral)" }}>
            {total} total
          </span>
        )}
      </div>
      {loading ? (
        <div style={{ height, display: "grid", placeItems: "center", color: "var(--color-neutral)", fontSize: "0.9rem" }}>
          Loading…
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={formattedData} margin={axisMargin}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-muted)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: compact ? 10 : 11, fill: "var(--color-neutral)" }}
              tickLine={false}
              axisLine={false}
              interval={tickInterval}
              minTickGap={compact ? 14 : 5}
              tickMargin={compact ? 8 : 4}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "var(--color-neutral)" }}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Tooltip
              contentStyle={{ borderRadius: "8px", border: "1px solid var(--color-border)", fontSize: "0.88rem" }}
              labelStyle={{ fontWeight: 700, color: "var(--color-ink)" }}
              itemStyle={{ color: "var(--color-primary)" }}
              formatter={(val) => [val, "submissions"]}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="var(--color-primary)"
              strokeWidth={2}
              dot={days <= 14 ? { r: 3, fill: "var(--color-primary)" } : false}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
