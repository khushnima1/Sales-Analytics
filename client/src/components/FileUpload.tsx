import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { FileSpreadsheet } from "lucide-react";
import { useRef, useState } from "react";

export function FileUpload() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<{
    uploadId?: string;
    status?: 'processing' | 'completed' | 'error';
    totalRows?: number;
    processedRows?: number;
    insertedRecords?: number;
    progressPercent?: number;
    error?: string;
  }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Poll for filter options until they are available
  const pollFilterOptions = async () => {
    const maxAttempts = 60; // Poll for up to 1 minute
    let attempts = 0;
    
    const poll = async (): Promise<void> => {
      try {
        const response = await axios.get('/api/filter-options');
        const options = response.data;
        
        // Check if we have any filter options
        if (options.makers.length > 0 || options.rtos.length > 0 || options.states.length > 0 || options.districts.length > 0) {
          // Update filter options in cache
          queryClient.setQueryData(['/api/filter-options'], options);
          return;
        }
        
        // Continue polling if no options yet
        if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 1000); // Poll every second
        }
      } catch (error) {
        console.error('Failed to fetch filter options:', error);
        if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 2000); // Retry after 2 seconds on error
        }
      }
    };
    
    poll();
  };

  // Poll for upload status - longer timeout for large files
  const pollUploadStatus = async (uploadId: string) => {
    const maxAttempts = 1800; // 30 minutes max for very large files (1 second intervals)
    let attempts = 0;
    
    const poll = async (): Promise<void> => {
      try {
        const response = await axios.get(`/api/upload-status/${uploadId}`);
        const status = response.data;
        
        setProcessingStatus(status);
        
        if (status.status === 'completed') {
          const processingTimeSeconds = Math.round(status.processingTime / 1000);
          const recordsText = status.insertedRecords > 10000 ? 
            `${(status.insertedRecords / 1000).toFixed(1)}k` : 
            status.insertedRecords.toString();
          
          toast({
            title: "Processing Complete!",
            description: `Successfully imported ${recordsText} records in ${processingTimeSeconds}s. Coordinates are being updated in the background.`,
          });
          
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['/api/sales-data'] });
          queryClient.invalidateQueries({ queryKey: ['/api/analytics'] });
          
          // Clear processing status after a delay
          setTimeout(() => setProcessingStatus({}), 3000);
          return;
        }
        
        if (status.status === 'error') {
          toast({
            title: "Processing Failed",
            description: status.error || "Failed to process Excel file",
            variant: "destructive",
          });
          setProcessingStatus({});
          return;
        }
        
        // Continue polling if still processing
        if (status.status === 'processing' && attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 1000); // Poll every second
        }
      } catch (error) {
        console.error('Failed to check upload status:', error);
        if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 2000); // Retry after 2 seconds
        }
      }
    };
    
    poll();
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      setUploadProgress(0);
      const response = await axios.post('/api/upload-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        },
      });
      setUploadProgress(100);
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: "Upload Successful!",
        description: "File uploaded instantly! Processing data in background...",
      });
      
      setUploadProgress(0);
      
      // Start polling for processing status
      if (data.uploadId) {
        setProcessingStatus({ uploadId: data.uploadId, status: 'processing' });
        pollUploadStatus(data.uploadId);
      }

      // Invalidate and refetch filter options immediately
      queryClient.invalidateQueries({ queryKey: ['/api/filter-options'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales-data'] });
      queryClient.invalidateQueries({ queryKey: ['/api/analytics'] });
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload file",
        variant: "destructive",
      });
      setUploadProgress(0);
      setProcessingStatus({});
    },
  });

  const handleFileSelect = (file: File) => {
    if (!file) return;

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an Excel file (.xlsx or .xls)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (100MB for large Excel files)
    if (file.size > 100 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload a file smaller than 100MB",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Data Import</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-neutral-300 hover:border-primary'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleClick}
        >
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
            <FileSpreadsheet className="text-primary text-xl" />
          </div>
          <p className="text-sm font-medium text-neutral-900 mb-1">Upload Excel File</p>
          <p className="text-xs text-neutral-500 mb-3">Drag & drop or click to browse</p>
          <p className="text-xs text-neutral-400">Supports .xlsx, .xls files up to 100MB</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {uploadMutation.isPending && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-neutral-600 mb-2">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="w-full" />
          </div>
        )}

        {processingStatus.status === 'processing' && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-blue-600 mb-2">
              <span>
                {processingStatus.totalRows && processingStatus.totalRows > 50000 
                  ? "Processing large Excel file..." 
                  : "Processing Excel data..."}
              </span>
              <span>{processingStatus.progressPercent || 0}%</span>
            </div>
            <Progress value={processingStatus.progressPercent || 0} className="w-full" />
            {processingStatus.totalRows && (
              <p className="text-xs text-neutral-500 mt-1">
                {processingStatus.totalRows > 10000 ? (
                  <>
                    {Math.round((processingStatus.processedRows || 0) / 1000 * 10) / 10}k of {Math.round(processingStatus.totalRows / 1000 * 10) / 10}k rows processed
                  </>
                ) : (
                  <>
                    {processingStatus.processedRows || 0} of {processingStatus.totalRows} rows processed
                  </>
                )}
              </p>
            )}
          </div>
        )}

        {processingStatus.status === 'completed' && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="text-sm text-green-700 font-medium">
              ✅ Processing Complete!
            </div>
            <div className="text-xs text-green-600">
              {processingStatus.insertedRecords} records imported successfully
            </div>
          </div>
        )}

        {processingStatus.status === 'error' && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-sm text-red-700 font-medium">
              ❌ Processing Failed
            </div>
            <div className="text-xs text-red-600">
              {processingStatus.error}
            </div>
          </div>
        )}

        <div className="mt-4 text-xs text-neutral-500">
          <p className="font-medium mb-1">Required Columns:</p>
          <ul className="space-y-0.5">
            <li>• Year, Maker, RTO Code, RTO</li>
            <li>• city, District, state</li>
            <li>• JAN, FEB, MAR, APR, MAY, JUN, JUL, AUG, SEP, OCT, NOV, DEC</li>
            <li>• total</li>
          </ul>
          <p className="text-green-600 font-medium mt-2">⚡ Instant upload - all processing happens in the background!</p>
        </div>
      </CardContent>
    </Card>
  );
}
