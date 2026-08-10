"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

const COLORS = ["#1d4ed8", "#f59e0b", "#e11d48"];

export function IncomeExpenseChart({
  data,
}: {
  data: { month: string; income: number; expense: number }[];
}) {
  return (
    <div className="h-72 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 12 }}
            axisLine={false}
            tickFormatter={(v) => `${Math.round(v / 1000)}k`}
          />
          <Tooltip
            formatter={(value) => formatCurrency(Number(value ?? 0))}
            contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0" }}
          />
          <Legend />
          <Bar dataKey="income" name="Income" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
          <Bar dataKey="expense" name="Expense" fill="#94a3b8" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MaintenanceChart({
  data,
}: {
  data: { collected: number; pending: number; overdue: number };
}) {
  const chartData = [
    { name: "Collected", value: data.collected },
    { name: "Pending", value: data.pending },
    { name: "Overdue", value: data.overdue },
  ].filter((item) => item.value > 0);

  if (!chartData.length) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-slate-500">
        No maintenance data yet
      </div>
    );
  }

  return (
    <div className="h-72 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={3}
          >
            {chartData.map((entry, index) => (
              <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => formatCurrency(Number(value ?? 0))}
            contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0" }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
