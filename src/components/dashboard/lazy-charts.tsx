"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const chartLoading = () => <Skeleton className="h-52 w-full sm:h-72" />;

export const LazyIncomeExpenseChart = dynamic(
  () => import("./charts").then((module) => module.IncomeExpenseChart),
  { ssr: false, loading: chartLoading },
);

export const LazyMaintenanceChart = dynamic(
  () => import("./charts").then((module) => module.MaintenanceChart),
  { ssr: false, loading: chartLoading },
);
