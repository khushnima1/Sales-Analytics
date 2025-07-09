import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, BarChart3, TrendingUp, Target } from "lucide-react";

interface Analytics {
  totalMarkets: number;
  totalSales2024: number;
  avgGrowthRate: number;
  marketPenetration: number;
  activeMarkets: number;
  growthMarkets: number;
  emergingMarkets: number;
}

export function MetricsOverview() {
  const { data: analytics, isLoading } = useQuery<Analytics>({
    queryKey: ['/api/analytics'],
  });

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

  const metrics = [
    {
      title: "Total Markets",
      value: analytics?.totalMarkets || 0,
      icon: MapPin,
      change: "+12%",
      changeType: "positive" as const,
      subtitle: "vs last period"
    },
    {
      title: "Total Sales (2024)",
      value: formatUnits(analytics?.totalSales2024 || 0),
      icon: BarChart3,
      change: "+18.5%",
      changeType: "positive" as const,
      subtitle: "YoY growth"
    },
    {
      title: "Growth Rate",
      value: `${analytics?.avgGrowthRate?.toFixed(1) || 0}%`,
      icon: TrendingUp,
      change: "",
      changeType: "neutral" as const,
      subtitle: "2022-2025 CAGR"
    },
    {
      title: "Market Penetration",
      value: `${analytics?.marketPenetration?.toFixed(1) || 0}%`,
      icon: Target,
      change: "",
      changeType: "neutral" as const,
      subtitle: "Active markets"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      {metrics.map((metric, index) => (
        <Card key={index} className="border border-neutral-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">{metric.title}</p>
                <p className="text-2xl font-bold text-neutral-900">
                  {isLoading ? "--" : metric.value}
                </p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <metric.icon className="text-primary text-lg" />
              </div>
            </div>
            {metric.change && (
              <div className="mt-4 flex items-center text-sm">
                <span className={`font-medium ${
                  metric.changeType === "positive" ? "text-success" : 
                  metric.changeType === "negative" ? "text-destructive" : 
                  "text-neutral-600"
                }`}>
                  {metric.change}
                </span>
                <span className="text-neutral-500 ml-1">{metric.subtitle}</span>
              </div>
            )}
            {!metric.change && (
              <div className="mt-4 text-sm text-neutral-500">
                {metric.subtitle}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
