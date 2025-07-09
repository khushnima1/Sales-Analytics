import { salesData, type SalesData, type InsertSalesData } from "@shared/schema";

export interface IStorage {
  getAllSalesData(): Promise<SalesData[]>;
  createSalesData(data: InsertSalesData): Promise<SalesData>;
  createMultipleSalesData(data: InsertSalesData[]): Promise<SalesData[]>;
  clearSalesData(): Promise<void>;
  getSalesDataByFilters(years?: string[]): Promise<SalesData[]>;
  updateSalesDataCoordinates(id: number, latitude: number, longitude: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private salesData: SalesData[] = [];
  private salesDataMap = new Map<number, SalesData>();
  private currentId = 1;
  private filterOptionsCache: {
    makers: string[];
    rtos: string[];
    states: string[];
    districts: string[];
  } | null = null;

  async getAllSalesData(): Promise<SalesData[]> {
    return Array.from(this.salesDataMap.values());
  }

  async createSalesData(insertData: InsertSalesData): Promise<SalesData> {
    const id = this.currentId++;
    const data: SalesData = { 
      ...insertData, 
      id,
      maker: insertData.maker || '',
      rto: insertData.rto || '',
      district: insertData.district || '',
      sales2022: insertData.sales2022 || 0,
      sales2023: insertData.sales2023 || 0,
      sales2024: insertData.sales2024 || 0,
      sales2025: insertData.sales2025 || 0,
      total: insertData.total || 0
    };
    this.salesDataMap.set(id, data);
    return data;
  }

  async createMultipleSalesData(insertDataArray: InsertSalesData[]): Promise<SalesData[]> {
    const results: SalesData[] = [];
    
    // Process in batches for better performance
    const batchSize = Math.min(1000, Math.max(100, Math.floor(insertDataArray.length / 10)));
    for (let i = 0; i < insertDataArray.length; i += batchSize) {
      const batch = insertDataArray.slice(i, i + batchSize);
      
      const batchResults = batch.map(insertData => {
        const id = this.currentId++;
        const data: SalesData = { 
          ...insertData, 
          id,
          maker: insertData.maker || '',
          rto: insertData.rto || '',
          district: insertData.district || '',
          sales2022: insertData.sales2022 || 0,
          sales2023: insertData.sales2023 || 0,
          sales2024: insertData.sales2024 || 0,
          sales2025: insertData.sales2025 || 0,
          total: insertData.total || 0
        };
        this.salesDataMap.set(id, data);
        return data;
      });
      
      results.push(...batchResults);
    }
    
    return results;
  }

  async clearSalesData(): Promise<void> {
    this.salesDataMap.clear();
    this.currentId = 1;
    this.filterOptionsCache = null;
  }

  async updateSalesDataCoordinates(id: number, latitude: number, longitude: number): Promise<void> {
    const data = this.salesDataMap.get(id);
    if (data) {
      data.latitude = latitude;
      data.longitude = longitude;
      this.salesDataMap.set(id, data);
    }
  }

  async getSalesDataByFilters(years?: string[]): Promise<SalesData[]> {
    const allData = await this.getAllSalesData();
    
    if (!years || years.length === 0) {
      return allData;
    }

    // For filtering, we return all data since year filtering is handled on frontend
    // This could be optimized to filter on backend if needed
    return allData;
  }
}

export const storage = new MemStorage();
