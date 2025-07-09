import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface MapControlsProps {
  viewMode: 'heatmap' | 'markers' | 'clusters';
  onViewModeChange: (mode: 'heatmap' | 'markers' | 'clusters') => void;
  showLabels: boolean;
  onShowLabelsChange: (show: boolean) => void;
}

export function MapControls({ 
  viewMode, 
  onViewModeChange, 
  showLabels, 
  onShowLabelsChange 
}: MapControlsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Map Controls</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-neutral-700 mb-2 block">View Mode</Label>
            <Select value={viewMode} onValueChange={onViewModeChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="heatmap">Heat Map</SelectItem>
                <SelectItem value="markers">Pin Markers</SelectItem>
                <SelectItem value="clusters">Clustered View</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium text-neutral-700 mb-2 block">Color Scale</Label>
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-neutral-500">Low</span>
              <div className="flex-1 h-3 rounded-full bg-gradient-to-r from-blue-200 via-yellow-300 to-red-500"></div>
              <span className="text-neutral-500">High</span>
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-200">
            <div className="flex items-center justify-between">
              <Label htmlFor="show-labels" className="text-sm font-medium text-neutral-700">
                Show Labels
              </Label>
              <Switch
                id="show-labels"
                checked={showLabels}
                onCheckedChange={onShowLabelsChange}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
