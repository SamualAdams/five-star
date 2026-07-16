import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function formatChartDate(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  if (days <= 7) return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  if (days <= 90) return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

export default function SubmissionsChart({ data, days, loading = false, total, height = 140 }) {
  // Show fewer ticks for large horizons
  const tickInterval = days <= 7 ? 0 : days <= 30 ? 2 : days <= 90 ? 6 : 29;

  const formattedData = data.map((d) => ({
    ...d,
    label: formatChartDate(d.date, days),
  }));

  return (
    <div
      style={{
        background: "#fafcfd",
        border: "1px solid #e3eaf0",
        borderRadius: "12px",
        padding: "1rem 0.5rem 0.5rem",
        marginBottom: "1rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 0.75rem", marginBottom: "0.5rem" }}>
        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#5e6770", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Submissions
        </span>
        {!loading && (
          <span style={{ fontSize: "0.82rem", color: "#5e6770" }}>
            {total} total
          </span>
        )}
      </div>
      {loading ? (
        <div style={{ height, display: "grid", placeItems: "center", color: "#5e6770", fontSize: "0.9rem" }}>
          Loading…
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={formattedData} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e3eaf0" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#5e6770" }}
              tickLine={false}
              axisLine={false}
              interval={tickInterval}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "#5e6770" }}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Tooltip
              contentStyle={{ borderRadius: "8px", border: "1px solid #d6dfe6", fontSize: "0.88rem" }}
              labelStyle={{ fontWeight: 700, color: "#2d1b42" }}
              itemStyle={{ color: "#5a8faf" }}
              formatter={(val) => [val, "submissions"]}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#5a8faf"
              strokeWidth={2}
              dot={days <= 14 ? { r: 3, fill: "#5a8faf" } : false}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
