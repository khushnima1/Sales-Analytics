import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { SalesData } from "@shared/schema";

interface YearFilterProps {
  selectedYears: string[];
  onYearsChange: (years: string[]) => void;
  onApply?: () => void;
}

export function YearFilter({ selectedYears, onYearsChange, onApply }: YearFilterProps) {
  const { data: salesData = [] } = useQuery<SalesData[]>({
    queryKey: ['/api/sales-data'],
  });

  const years = ['2022', '2023', '2024', '2025'];

  const calculateYearTotal = (year: string) => {
    const salesKey = `sales${year}` as keyof SalesData;
    return salesData.reduce((sum, item) => sum + (item[salesKey] as number || 0), 0);
  };

  const formatUnits = (amount: number) => {
    if (amount >= 10000000) {
      return `${(amount / 10000000).toFixed(1)}Cr units`;
    } else if (amount >= 100000) {
      return `${(amount / 100000).toFixed(1)}L units`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K units`;
    } else {
      return `${amount.toLocaleString()} units`;
    }
  };

  const handleYearToggle = (year: string, checked: boolean) => {
    if (checked) {
      onYearsChange([...selectedYears, year]);
    } else {
      onYearsChange(selectedYears.filter(y => y !== year));
    }
  };

  const selectAll = () => {
    onYearsChange(years);
  };

  const clearAll = () => {
    onYearsChange([]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Time Period</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {years.map((year) => (
            <div key={year} className="flex items-center space-x-3 cursor-pointer">
              <Checkbox
                id={year}
                checked={selectedYears.includes(year)}
                onCheckedChange={(checked) => handleYearToggle(year, checked as boolean)}
              />
              <label htmlFor={year} className="flex-1 cursor-pointer">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-neutral-700">{year}</span>
                  <span className="text-sm text-neutral-500">
                    {formatUnits(calculateYearTotal(year))}
                  </span>
                </div>
              </label>
            </div>
          ))}
        </div>

        <div className="mt-4 flex space-x-2">
          <Button onClick={selectAll} size="sm" variant="outline" className="flex-1">
            Select All
          </Button>
          <Button onClick={clearAll} size="sm" variant="outline" className="flex-1">
            Clear All
          </Button>
        </div>

        <Button 
          className="w-full mt-4" 
          disabled={selectedYears.length === 0}
          onClick={onApply}
        >
          Apply Filters
        </Button>
      </CardContent>
    </Card>
  );
}
