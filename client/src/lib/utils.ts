import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatUnits(amount: number): string {
  if (amount >= 10000000) {
    return `${(amount / 10000000).toFixed(1)}Cr units`;
  } else if (amount >= 100000) {
    return `${(amount / 100000).toFixed(1)}L units`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K units`;
  } else {
    return `${amount.toLocaleString()} units`;
  }
}

export function calculateGrowthRate(initialValue: number, finalValue: number): number {
  if (initialValue === 0) return finalValue > 0 ? 100 : 0;
  return ((finalValue - initialValue) / initialValue) * 100;
}

export function getGrowthColor(growth: number): string {
  if (growth > 20) return "text-success";
  if (growth > 0) return "text-warning";
  return "text-destructive";
}

export function validateExcelColumns(data: any[]): boolean {
  if (!data || data.length === 0) return false;
  
  const requiredColumns = ['State', 'City', 'Latitude', 'Longitude', '2022', '2023', '2024', '2025'];
  const firstRow = data[0];
  
  return requiredColumns.every(col => 
    col in firstRow || col.toLowerCase() in firstRow
  );
}
