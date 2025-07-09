import { insertSalesDataSchema, type InsertSalesData } from "@shared/schema";
import 'dotenv/config';
import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import * as XLSX from "xlsx";
import { storage } from "./storage";

// Generate unique upload ID
function generateUploadId(): string {
  return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Geocoding cache to avoid duplicate API calls
const geocodingCache = new Map<string, { latitude: number; longitude: number }>();

// Upload status tracking
const uploadStatus = new Map<string, {
  status: 'processing' | 'completed' | 'error';
  totalRows: number;
  processedRows: number;
  insertedRecords: number;
  error?: string;
  startTime: number;
}>();

// Background Excel processing service
async function processExcelInBackground(fileBuffer: Buffer, uploadId: string) {
  try {
    console.log(`Starting background processing for upload ${uploadId}`);
    uploadStatus.set(uploadId, {
      status: 'processing',
      totalRows: 0,
      processedRows: 0,
      insertedRecords: 0,
      startTime: Date.now()
    });

    // Parse Excel file
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    const totalRows = jsonData.length;
    uploadStatus.get(uploadId)!.totalRows = totalRows;

    // Validate and transform data in chunks for better performance
    const salesDataArray: InsertSalesData[] = [];
    const chunkSize = Math.min(2000, Math.max(500, Math.floor(totalRows / 20))); // Dynamic chunk size based on file size
    
    // Track unique makers and RTOs for validation
    const uniqueMakers = new Set<string>();
    const uniqueRTOs = new Set<string>();
    
    for (let i = 0; i < jsonData.length; i += chunkSize) {
      const chunk = jsonData.slice(i, i + chunkSize);
      
      for (const row of chunk) {
        try {
          const rowData = row as any;
          
          // Find maker column - try different possible names
          let maker = '';
          const possibleMakerColumns = ['Maker', 'maker', 'MAKER', 'Manufacturer', 'manufacturer', 'MANUFACTURER', 'Company', 'company', 'COMPANY'];
          for (const col of possibleMakerColumns) {
            if (rowData[col] !== undefined) {
              maker = String(rowData[col]).trim();
              break;
            }
          }

          // Find RTO column - try different possible names
          let rto = '';
          const possibleRTOColumns = ['RTO', 'rto', 'Rto', 'RTO_Code', 'rto_code', 'RTO Code', 'rto code'];
          for (const col of possibleRTOColumns) {
            if (rowData[col] !== undefined) {
              rto = String(rowData[col]).trim();
              break;
            }
          }

          const year = parseInt(rowData['Year'] || rowData['year'] || '0');
          const state = rowData['state'] || rowData['State'] || '';
          const city = rowData['city'] || rowData['City'] || '';
          const district = rowData['District'] || rowData['district'] || '';

          // Skip invalid rows
          if (!maker || !rto || !state || !city) {
            console.log('Skipping invalid row:', { maker, rto, state, city });
            continue;
          }

          // Track unique values
          uniqueMakers.add(maker);
          uniqueRTOs.add(rto);

          // Only process years 2022-2025
          if (![2022, 2023, 2024, 2025].includes(year)) continue;

          // Set default coordinates (will be geocoded in background)
          let latitude = 0;
          let longitude = 0;

          // Sum all months for the year
          const months = [
            'JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'
          ];
          let yearTotal = 0;
          const monthValues: Record<string, number> = {};
          for (const m of months) {
            const val = parseInt(rowData[m] || rowData[m.toLowerCase()] || '0');
            yearTotal += val;
            monthValues[m] = val;
          }
          const total = parseInt(rowData['total'] || rowData['Total'] || '0') || yearTotal;

          // Prepare sales fields
          let sales2022 = 0, sales2023 = 0, sales2024 = 0, sales2025 = 0;
          if (year === 2022) sales2022 = yearTotal;
          if (year === 2023) sales2023 = yearTotal;
          if (year === 2024) sales2024 = yearTotal;
          if (year === 2025) sales2025 = yearTotal;

          const salesData: InsertSalesData & Record<string, number | string> = {
            state,
            city,
            maker,
            rto,
            district,
            latitude,
            longitude,
            sales2022,
            sales2023,
            sales2024,
            sales2025,
            total,
            ...monthValues
          };

          // Validate with schema
          const validatedData = insertSalesDataSchema.parse(salesData);
          salesDataArray.push({ ...validatedData, ...monthValues });
        } catch (error) {
          console.error('Error processing row:', error);
          continue;
        }
      }
      
      // Update progress
      const status = uploadStatus.get(uploadId)!;
      status.processedRows = Math.min(i + chunkSize, totalRows);
      
      // Allow other operations to process
      if (totalRows > 10000) {
        await new Promise(resolve => setImmediate(resolve));
      } else {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    if (salesDataArray.length === 0) {
      uploadStatus.set(uploadId, {
        ...uploadStatus.get(uploadId)!,
        status: 'error',
        error: 'No valid data found in the Excel file. Please check the format and required columns.'
      });
      return;
    }

    console.log('Found unique makers:', Array.from(uniqueMakers));
    console.log('Found unique RTOs:', Array.from(uniqueRTOs));

    // Clear existing data and insert new data
    await storage.clearSalesData();
    const insertedData = await storage.createMultipleSalesData(salesDataArray);

    // Update final status
    uploadStatus.set(uploadId, {
      ...uploadStatus.get(uploadId)!,
      status: 'completed',
      insertedRecords: insertedData.length,
      processedRows: totalRows
    });

    // Start background geocoding
    updateCoordinatesInBackground().catch(error => {
      console.error('Background geocoding failed:', error);
    });

    console.log(`Background processing completed for upload ${uploadId}: ${insertedData.length} records inserted`);
  } catch (error) {
    console.error(`Background processing error for upload ${uploadId}:`, error);
    uploadStatus.set(uploadId, {
      ...uploadStatus.get(uploadId)!,
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to process Excel file'
    });
  }
}

// Background geocoding service
async function updateCoordinatesInBackground() {
  try {
    const apiKey = process.env.GOOGLE_MAP_API || process.env.GOOGLE_GEOCODING_API;
    if (!apiKey) return;

    const allData = await storage.getAllSalesData();
    const itemsNeedingGeocode = allData.filter(item => 
      item.latitude === 0 && item.longitude === 0 && item.state && item.city
    );

    console.log(`Geocoding ${itemsNeedingGeocode.length} locations in background...`);
    
    // Process in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < itemsNeedingGeocode.length; i += batchSize) {
      const batch = itemsNeedingGeocode.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (item) => {
        const cacheKey = `${item.city}, ${item.state}`;
        
        // Check cache first
        if (geocodingCache.has(cacheKey)) {
          const coords = geocodingCache.get(cacheKey)!;
          await storage.updateSalesDataCoordinates(item.id!, coords.latitude, coords.longitude);
          return;
        }

        try {
          const address = `${item.city}, ${item.state}, India`;
          const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
          const geocodeResponse = await fetch(geocodeUrl);
          const geocodeData = await geocodeResponse.json();
          
          if (geocodeData.status === 'OK' && geocodeData.results.length > 0) {
            const location = geocodeData.results[0].geometry.location;
            const coords = { latitude: location.lat, longitude: location.lng };
            
            // Cache the result
            geocodingCache.set(cacheKey, coords);
            
            // Update in database
            await storage.updateSalesDataCoordinates(item.id!, coords.latitude, coords.longitude);
          }
        } catch (error) {
          console.error(`Geocoding failed for ${cacheKey}:`, error);
        }
      }));

      // Add delay between batches to respect rate limits
      if (i + batchSize < itemsNeedingGeocode.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('Background geocoding completed');
  } catch (error) {
    console.error('Background geocoding error:', error);
  }
}

interface MulterRequest extends Request {
  file?: any;
}

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB for large Excel files
  },
  fileFilter: (req: any, file: any, cb: any) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.oasis.opendocument.spreadsheet'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Please upload an Excel file.'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Add health check endpoint
  app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "healthy" });
  });
  
  // Get all sales data
  app.get("/api/sales-data", async (req, res) => {
    try {
      const data = await storage.getAllSalesData();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sales data" });
    }
  });

  // Instant upload - process Excel in background
  app.post("/api/upload-excel", upload.single('file'), async (req: MulterRequest, res) => {
    try {
      console.log('Upload request received:', {
        hasFile: !!req.file,
        contentType: req.headers['content-type'],
        bodyKeys: Object.keys(req.body || {}),
        fileKeys: req.file ? Object.keys(req.file) : []
      });
      
      if (!req.file) {
        console.log('No file found in request');
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Generate unique upload ID
      const uploadId = generateUploadId();
      
      // Start background processing immediately (don't await)
      processExcelInBackground(req.file.buffer, uploadId).catch(error => {
        console.error('Background Excel processing failed:', error);
      });

      // Return immediately - processing happens in background
      res.json({ 
        message: "File uploaded successfully! Processing in background...",
        uploadId,
        status: 'processing'
      });

    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to upload file" 
      });
    }
  });

  // Get analytics/metrics
  app.get("/api/analytics", async (req, res) => {
    try {
      const data = await storage.getAllSalesData();
      
      if (data.length === 0) {
        return res.json({
          totalMarkets: 0,
          totalSales2024: 0,
          avgGrowthRate: 0,
          marketPenetration: 0,
          activeMarkets: 0,
          growthMarkets: 0,
          emergingMarkets: 0
        });
      }

      const totalMarkets = data.length;
      const totalSales2024 = data.reduce((sum, item) => sum + item.sales2024, 0);
      
      // Calculate average growth rate (2022 to 2025)
      const growthRates = data.map(item => {
        if (item.sales2022 === 0) return 0;
        return ((item.sales2025 - item.sales2022) / item.sales2022) * 100;
      }).filter(rate => !isNaN(rate) && isFinite(rate));
      
      const avgGrowthRate = growthRates.length > 0 
        ? growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length 
        : 0;

      // Market categorization
      const activeMarkets = data.filter(item => item.total > 0).length;
      const growthMarkets = data.filter(item => {
        if (item.sales2022 === 0) return item.sales2025 > 0;
        return ((item.sales2025 - item.sales2022) / item.sales2022) > 0.1; // >10% growth
      }).length;
      const emergingMarkets = data.filter(item => {
        if (item.sales2022 === 0) return item.sales2025 > 0;
        return ((item.sales2025 - item.sales2022) / item.sales2022) > 0.5; // >50% growth
      }).length;

      const marketPenetration = totalMarkets > 0 ? (activeMarkets / totalMarkets) * 100 : 0;

      res.json({
        totalMarkets,
        totalSales2024,
        avgGrowthRate: Math.round(avgGrowthRate * 10) / 10,
        marketPenetration: Math.round(marketPenetration * 10) / 10,
        activeMarkets,
        growthMarkets,
        emergingMarkets
      });

    } catch (error) {
      res.status(500).json({ message: "Failed to calculate analytics" });
    }
  });

  // Geocoding proxy endpoint
  app.post("/api/geocode", async (req, res) => {
    try {
      const { address } = req.body;
      const apiKey = process.env.GOOGLE_MAP_API || process.env.GOOGLE_GEOCODING_API || process.env.VITE_GOOGLE_MAPS_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ message: "Google Maps API key not configured" });
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
      );
      
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Geocoding failed" });
    }
  });

  // Get Google Maps API key
  app.get("/api/maps-config", async (req, res) => {
    try {
      const apiKey = process.env.GOOGLE_MAP_API || process.env.GOOGLE_GEOCODING_API;
      res.json({ apiKey: apiKey || null });
    } catch (error) {
      res.status(500).json({ message: "Failed to get maps configuration" });
    }
  });

  // Clear all sales data
  app.post("/api/clear-sales-data", async (req, res) => {
    try {
      await storage.clearSalesData();
      res.json({ message: "Sales data cleared" });
    } catch (error) {
      res.status(500).json({ message: "Failed to clear sales data" });
    }
  });

  // Trigger background geocoding
  app.post("/api/update-coordinates", async (req, res) => {
    try {
      // Start background geocoding
      updateCoordinatesInBackground().catch(error => {
        console.error('Background geocoding failed:', error);
      });
      res.json({ message: "Coordinate update started in background" });
    } catch (error) {
      res.status(500).json({ message: "Failed to start coordinate update" });
    }
  });

  // Get upload status
  app.get("/api/upload-status/:uploadId", async (req, res) => {
    try {
      const { uploadId } = req.params;
      const status = uploadStatus.get(uploadId);
      
      if (!status) {
        return res.status(404).json({ message: "Upload not found" });
      }
      
      const response = {
        ...status,
        processingTime: Date.now() - status.startTime,
        progressPercent: status.totalRows > 0 ? Math.round((status.processedRows / status.totalRows) * 100) : 0
      };
      
      res.json(response);
    } catch (error) {
      res.status(500).json({ message: "Failed to get upload status" });
    }
  });

  // Get dynamic filter options based on uploaded data
  app.get("/api/filter-options", async (req, res) => {
    try {
      const filterOptions = await storage.getFilterOptions();
      console.log(`Found ${filterOptions.makers.length} makers, ${filterOptions.rtos.length} RTOs, ${filterOptions.states.length} states, ${filterOptions.districts.length} districts`);
      res.json(filterOptions);
    } catch (error) {
      console.error('Failed to get filter options:', error);
      res.status(500).json({ message: "Failed to get filter options" });
    }
  });

  // Get cascading filter options based on selections
  app.post("/api/cascading-filters", async (req, res) => {
    try {
      const { makers = [], rtos = [], states = [], districts = [] } = req.body;
      const allData = await storage.getAllSalesData();

      // First, get the filtered data based on current selections
      const filteredData = allData.filter(item => {
        const makerMatch = makers.length === 0 || makers.includes(item.maker);
        const rtoMatch = rtos.length === 0 || rtos.includes(item.rto);
        const stateMatch = states.length === 0 || states.includes(item.state);
        const districtMatch = districts.length === 0 || districts.includes(item.district);
        return makerMatch && rtoMatch && stateMatch && districtMatch;
      });

      // Then, calculate available options for each filter based on other selected filters
      const makerOptions = new Set<string>();
      const rtoOptions = new Set<string>();
      const stateOptions = new Set<string>();
      const districtOptions = new Set<string>();

      allData.forEach(item => {
        // For Maker options, check against other filters except maker
        if ((rtos.length === 0 || rtos.includes(item.rto)) &&
            (states.length === 0 || states.includes(item.state)) &&
            (districts.length === 0 || districts.includes(item.district))) {
          makerOptions.add(item.maker);
        }

        // For RTO options, check against other filters except RTO
        if ((makers.length === 0 || makers.includes(item.maker)) &&
            (states.length === 0 || states.includes(item.state)) &&
            (districts.length === 0 || districts.includes(item.district))) {
          rtoOptions.add(item.rto);
        }

        // For State options, check against other filters except state
        if ((makers.length === 0 || makers.includes(item.maker)) &&
            (rtos.length === 0 || rtos.includes(item.rto)) &&
            (districts.length === 0 || districts.includes(item.district))) {
          stateOptions.add(item.state);
        }

        // For District options, check against other filters except district
        if ((makers.length === 0 || makers.includes(item.maker)) &&
            (rtos.length === 0 || rtos.includes(item.rto)) &&
            (states.length === 0 || states.includes(item.state))) {
          districtOptions.add(item.district);
        }
      });

      // Convert Sets to sorted arrays and remove any null/undefined values
      const availableOptions = {
        makers: Array.from(makerOptions).filter(Boolean).sort(),
        rtos: Array.from(rtoOptions).filter(Boolean).sort(),
        states: Array.from(stateOptions).filter(Boolean).sort(),
        districts: Array.from(districtOptions).filter(Boolean).sort()
      };

      res.json({
        filteredData,
        availableOptions
      });
    } catch (error) {
      console.error('Error applying filters:', error);
      res.status(500).json({ message: "Failed to apply filters" });
    }
  });

  // Get geocoding status
  app.get("/api/geocoding-status", async (req, res) => {
    try {
      const allData = await storage.getAllSalesData();
      const totalRecords = allData.length;
      const geocodedRecords = allData.filter(item => 
        item.latitude !== 0 || item.longitude !== 0
      ).length;
      
      res.json({
        totalRecords,
        geocodedRecords,
        pendingGeocode: totalRecords - geocodedRecords,
        percentComplete: totalRecords > 0 ? Math.round((geocodedRecords / totalRecords) * 100) : 0
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get geocoding status" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
