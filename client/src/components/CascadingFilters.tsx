import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { ScrollArea } from './ui/scroll-area';
import { useMutation } from '@tanstack/react-query';
import { X } from 'lucide-react';
import axios from 'axios';

interface FilterOptions {
  makers: string[];
  rtos: string[];
  states: string[];
  districts: string[];
}

interface CascadingFiltersProps {
  onFiltersChange: (data: any[]) => void;
  onMakersChange: (makers: string[]) => void;
  onRTOsChange: (rtos: string[]) => void;
  onStatesChange: (states: string[]) => void;
  onDistrictsChange: (districts: string[]) => void;
  selectedMakers: string[];
  selectedRTOs: string[];
  selectedStates: string[];
  selectedDistricts: string[];
}

export function CascadingFilters({
  onFiltersChange,
  onMakersChange,
  onRTOsChange,
  onStatesChange,
  onDistrictsChange,
  selectedMakers = [],
  selectedRTOs = [],
  selectedStates = [],
  selectedDistricts = []
}: CascadingFiltersProps) {
  const [availableOptions, setAvailableOptions] = useState<FilterOptions>({
    makers: [],
    rtos: [],
    states: [],
    districts: []
  });

  const cascadingFilterMutation = useMutation({
    mutationFn: async (filters: { makers?: string[]; rtos?: string[]; states?: string[]; districts?: string[] }) => {
      const response = await axios.post('/api/cascading-filters', filters);
      return response.data;
    },
    onSuccess: (data) => {
      setAvailableOptions(data.availableOptions);
      onFiltersChange(data.filteredData);
    }
  });

  // Update filters whenever selections change
  useEffect(() => {
    cascadingFilterMutation.mutate({
      makers: selectedMakers,
      rtos: selectedRTOs,
      states: selectedStates,
      districts: selectedDistricts
    });
  }, [selectedMakers, selectedRTOs, selectedStates, selectedDistricts]);

  const handleFilterChange = (filterType: string, value: string, checked: boolean) => {
    let updatedSelection: string[] = [];
    let updateFunction: (values: string[]) => void;

    switch (filterType) {
      case 'maker':
        updatedSelection = checked
          ? [...selectedMakers, value]
          : selectedMakers.filter(v => v !== value);
        updateFunction = onMakersChange;
        break;
      case 'rto':
        updatedSelection = checked
          ? [...selectedRTOs, value]
          : selectedRTOs.filter(v => v !== value);
        updateFunction = onRTOsChange;
        break;
      case 'state':
        updatedSelection = checked
          ? [...selectedStates, value]
          : selectedStates.filter(v => v !== value);
        updateFunction = onStatesChange;
        break;
      case 'district':
        updatedSelection = checked
          ? [...selectedDistricts, value]
          : selectedDistricts.filter(v => v !== value);
        updateFunction = onDistrictsChange;
        break;
      default:
        return;
    }

    updateFunction(updatedSelection);
  };

  const handleClearAll = () => {
    onMakersChange([]);
    onRTOsChange([]);
    onStatesChange([]);
    onDistrictsChange([]);
    // This will trigger the useEffect to update the data
  };

  const renderFilterPopover = (
    type: string,
    label: string,
    options: string[],
    selectedValues: string[],
    disabled: boolean = false
  ) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-start w-[200px]" disabled={disabled}>
          <span className="truncate">{label} ({selectedValues.length})</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <ScrollArea className="h-[300px] p-2">
          <div className="space-y-2">
            <div className="flex items-center space-x-2 px-2 py-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 flex-1"
                onClick={() => handleSelectAll(type, options)}
              >
                {selectedValues.length === options.length ? 'Clear All' : 'Select All'}
              </Button>
            </div>
            <div className="space-y-1">
              {options.map((option) => (
                <label
                  key={option}
                  className="flex items-center space-x-2 px-2 py-1 hover:bg-accent rounded-md cursor-pointer"
                >
                  <Checkbox
                    checked={selectedValues.includes(option)}
                    onCheckedChange={(checked) => handleFilterChange(type, option, checked === true)}
                  />
                  <span className="text-sm">{option}</span>
                </label>
              ))}
            </div>
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );

  const handleSelectAll = (type: string, options: string[]) => {
    const isAllSelected = (selected: string[], available: string[]) =>
      selected.length === available.length;

    switch (type) {
      case 'maker':
        onMakersChange(isAllSelected(selectedMakers, options) ? [] : options);
        break;
      case 'rto':
        onRTOsChange(isAllSelected(selectedRTOs, options) ? [] : options);
        break;
      case 'state':
        onStatesChange(isAllSelected(selectedStates, options) ? [] : options);
        break;
      case 'district':
        onDistrictsChange(isAllSelected(selectedDistricts, options) ? [] : options);
        break;
    }
  };

  const hasActiveFilters = selectedMakers.length > 0 || selectedRTOs.length > 0 || 
                          selectedStates.length > 0 || selectedDistricts.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 p-2">
        {renderFilterPopover('maker', 'Maker', availableOptions.makers, selectedMakers)}
        {renderFilterPopover('rto', 'RTO', availableOptions.rtos, selectedRTOs)}
        {renderFilterPopover('state', 'State', availableOptions.states, selectedStates)}
        {renderFilterPopover('district', 'District', availableOptions.districts, selectedDistricts)}
        
        {hasActiveFilters && (
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={handleClearAll}
          >
            <X className="h-4 w-4" />
            Clear All Filters
          </Button>
        )}
      </div>
      
      <div className="text-sm text-gray-500 px-2">
        {hasActiveFilters ? (
          <span>
            Active filters: {[
              selectedMakers.length && `${selectedMakers.length} makers`,
              selectedRTOs.length && `${selectedRTOs.length} RTOs`,
              selectedStates.length && `${selectedStates.length} states`,
              selectedDistricts.length && `${selectedDistricts.length} districts`
            ].filter(Boolean).join(', ')}
          </span>
        ) : (
          <span>No active filters</span>
        )}
      </div>
    </div>
  );
} 