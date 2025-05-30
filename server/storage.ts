import { 
  vendors, 
  inquiries, 
  priceResponses, 
  botConfig, 
  apiKeys,
  type Vendor, 
  type InsertVendor,
  type Inquiry,
  type InsertInquiry,
  type PriceResponse,
  type InsertPriceResponse,
  type BotConfig,
  type InsertBotConfig,
  type ApiKey,
  type InsertApiKey
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Vendors
  getVendors(city?: string, material?: string): Promise<Vendor[]>;
  getVendor(id: number): Promise<Vendor | undefined>;
  getVendorByVendorId(vendorId: string): Promise<Vendor | undefined>;
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  updateVendor(id: number, vendor: Partial<Vendor>): Promise<Vendor | undefined>;
  getTopVendors(limit?: number, material?: string): Promise<Vendor[]>;

  // Inquiries
  getInquiries(limit?: number): Promise<Inquiry[]>;
  getInquiry(id: number): Promise<Inquiry | undefined>;
  getInquiryByInquiryId(inquiryId: string): Promise<Inquiry | undefined>;
  createInquiry(inquiry: InsertInquiry): Promise<Inquiry>;
  updateInquiry(id: number, inquiry: Partial<Inquiry>): Promise<Inquiry | undefined>;

  // Price Responses
  getPriceResponses(inquiryId?: string, vendorId?: string): Promise<PriceResponse[]>;
  createPriceResponse(response: InsertPriceResponse): Promise<PriceResponse>;
  getLatestPrices(city?: string, material?: string, limit?: number): Promise<PriceResponse[]>;

  // Bot Config
  getBotConfig(): Promise<BotConfig | undefined>;
  updateBotConfig(config: Partial<BotConfig>): Promise<BotConfig>;

  // API Keys
  getApiKeys(): Promise<ApiKey[]>;
  createApiKey(apiKey: InsertApiKey): Promise<ApiKey>;
  validateApiKey(keyValue: string): Promise<boolean>;

  // Analytics
  getDashboardMetrics(): Promise<{
    totalInquiries: number;
    activeVendors: number;
    responseRate: number;
    messagesSent: number;
    todayInquiries: number;
    citiesCovered: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getVendor(id: number): Promise<Vendor | undefined> {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id));
    return vendor || undefined;
  }

  async getVendorByVendorId(vendorId: string): Promise<Vendor | undefined> {
    const [vendor] = await db.select().from(vendors).where(eq(vendors.vendorId, vendorId));
    return vendor || undefined;
  }

  async createVendor(insertVendor: InsertVendor): Promise<Vendor> {
    const [vendor] = await db
      .insert(vendors)
      .values(insertVendor)
      .returning();
    return vendor;
  }

  async updateVendor(id: number, vendor: Partial<Vendor>): Promise<Vendor | undefined> {
    const [updated] = await db
      .update(vendors)
      .set(vendor)
      .where(eq(vendors.id, id))
      .returning();
    return updated || undefined;
  }

  async getVendors(city?: string, material?: string): Promise<Vendor[]> {
    let query = db.select().from(vendors);
    
    // Note: Complex filtering with city and material would require proper SQL conditions
    // For now, we'll get all vendors and filter in memory
    const allVendors = await query;
    
    let filtered = allVendors;
    if (city) {
      filtered = filtered.filter(v => v.city.toLowerCase() === city.toLowerCase());
    }
    if (material) {
      filtered = filtered.filter(v => v.materials.includes(material.toLowerCase()));
    }
    
    return filtered.sort((a, b) => (b.responseCount || 0) - (a.responseCount || 0));
  }

  async getTopVendors(limit = 10, material?: string): Promise<Vendor[]> {
    const vendors = await this.getVendors(undefined, material);
    return vendors.slice(0, limit);
  }

  async getInquiry(id: number): Promise<Inquiry | undefined> {
    const [inquiry] = await db.select().from(inquiries).where(eq(inquiries.id, id));
    return inquiry || undefined;
  }

  async getInquiryByInquiryId(inquiryId: string): Promise<Inquiry | undefined> {
    const [inquiry] = await db.select().from(inquiries).where(eq(inquiries.inquiryId, inquiryId));
    return inquiry || undefined;
  }

  async createInquiry(insertInquiry: InsertInquiry): Promise<Inquiry> {
    const [inquiry] = await db
      .insert(inquiries)
      .values(insertInquiry)
      .returning();
    return inquiry;
  }

  async updateInquiry(id: number, inquiry: Partial<Inquiry>): Promise<Inquiry | undefined> {
    const [updated] = await db
      .update(inquiries)
      .set(inquiry)
      .where(eq(inquiries.id, id))
      .returning();
    return updated || undefined;
  }

  async getInquiries(limit = 50): Promise<Inquiry[]> {
    let query = db.select().from(inquiries);
    
    const results = await query;
    const sorted = results.sort((a, b) => 
      new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
    );
    
    return limit ? sorted.slice(0, limit) : sorted;
  }

  async getPriceResponses(inquiryId?: string, vendorId?: string): Promise<PriceResponse[]> {
    let query = db.select().from(priceResponses);
    
    // For complex filtering, we'd need to build proper WHERE conditions
    const results = await query;
    
    let filtered = results;
    if (inquiryId) {
      filtered = filtered.filter(r => r.inquiryId === inquiryId);
    }
    if (vendorId) {
      filtered = filtered.filter(r => r.vendorId === vendorId);
    }
    
    return filtered.sort((a, b) => 
      new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
    );
  }

  async createPriceResponse(insertResponse: InsertPriceResponse): Promise<PriceResponse> {
    const [response] = await db
      .insert(priceResponses)
      .values(insertResponse)
      .returning();
    return response;
  }

  async getLatestPrices(city?: string, material?: string, limit = 20): Promise<PriceResponse[]> {
    const responses = await this.getPriceResponses();
    
    let filtered = responses;
    if (material) {
      filtered = filtered.filter(r => r.material.toLowerCase() === material.toLowerCase());
    }
    
    // Filter by city through vendor lookup
    if (city) {
      const cityVendors = await this.getVendors(city);
      const vendorIds = cityVendors.map(v => v.vendorId);
      filtered = filtered.filter(r => vendorIds.includes(r.vendorId));
    }
    
    return filtered.slice(0, limit);
  }

  async getBotConfig(): Promise<BotConfig | undefined> {
    const [config] = await db.select().from(botConfig).limit(1);
    return config || undefined;
  }

  async updateBotConfig(config: Partial<BotConfig>): Promise<BotConfig> {
    const existing = await this.getBotConfig();
    
    if (existing) {
      const [updated] = await db
        .update(botConfig)
        .set(config)
        .where(eq(botConfig.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(botConfig)
        .values({
          messageTemplate: config.messageTemplate || "",
          maxVendorsPerInquiry: config.maxVendorsPerInquiry ?? 3,
          messagesPerMinute: config.messagesPerMinute ?? 20,
          autoResponseEnabled: config.autoResponseEnabled ?? true,
          botActive: config.botActive ?? true
        })
        .returning();
      return created;
    }
  }

  async getApiKeys(): Promise<ApiKey[]> {
    const keys = await db.select().from(apiKeys);
    return keys.filter(k => k.isActive);
  }

  async createApiKey(insertApiKey: InsertApiKey): Promise<ApiKey> {
    const [apiKey] = await db
      .insert(apiKeys)
      .values(insertApiKey)
      .returning();
    return apiKey;
  }

  async validateApiKey(keyValue: string): Promise<boolean> {
    const [apiKey] = await db.select().from(apiKeys).where(eq(apiKeys.keyValue, keyValue));
    return apiKey ? Boolean(apiKey.isActive) : false;
  }

  async getDashboardMetrics() {
    const allInquiries = await db.select().from(inquiries);
    const allVendors = await db.select().from(vendors);
    const allResponses = await db.select().from(priceResponses);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayInquiries = allInquiries.filter(i => 
      new Date(i.timestamp || 0) >= today
    ).length;
    
    const activeVendors = allVendors.filter(v => v.isActive).length;
    
    const totalInquiries = allInquiries.length;
    const totalResponses = allResponses.length;
    const responseRate = totalInquiries > 0 ? Math.round((totalResponses / totalInquiries) * 100) : 0;
    
    const messagesSent = totalInquiries * 3;
    
    const cities = new Set(allVendors.map(v => v.city));
    const citiesCovered = cities.size;
    
    return {
      totalInquiries,
      activeVendors,
      responseRate,
      messagesSent,
      todayInquiries,
      citiesCovered
    };
  }
}

export class MemStorage implements IStorage {
  private vendors: Map<number, Vendor>;
  private inquiries: Map<number, Inquiry>;
  private priceResponses: Map<number, PriceResponse>;
  private botConfigs: Map<number, BotConfig>;
  private apiKeys: Map<number, ApiKey>;
  private currentId: number;

  constructor() {
    this.vendors = new Map();
    this.inquiries = new Map();
    this.priceResponses = new Map();
    this.botConfigs = new Map();
    this.apiKeys = new Map();
    this.currentId = 1;
    this.initializeData();
  }

  private initializeData() {
    // Initialize with sample vendors
    const sampleVendors: InsertVendor[] = [
      {
        vendorId: "vendor_001",
        name: "Kumar Construction Supplies",
        phone: "+91 98765 43210",
        city: "Guwahati",
        materials: ["cement", "tmt"],
        responseCount: 47,
        responseRate: "92.5",
        rank: 1
      },
      {
        vendorId: "vendor_002", 
        name: "Mumbai Steel Center",
        phone: "+91 98765 43211",
        city: "Mumbai",
        materials: ["tmt"],
        responseCount: 35,
        responseRate: "78.2",
        rank: 2
      },
      {
        vendorId: "vendor_003",
        name: "Delhi Building Materials",
        phone: "+91 98765 43212", 
        city: "Delhi",
        materials: ["cement", "tmt"],
        responseCount: 28,
        responseRate: "85.1",
        rank: 3
      }
    ];

    sampleVendors.forEach(vendor => this.createVendor(vendor));

    // Initialize with sample inquiries
    const sampleInquiries: InsertInquiry[] = [
      {
        inquiryId: "INQ-001",
        userName: "Rajesh Kumar",
        userPhone: "+91 98765 43213",
        city: "Guwahati",
        material: "cement",
        brand: "ACC",
        quantity: "50 bags",
        vendorsContacted: ["vendor_001"],
        responseCount: 1,
        status: "responded"
      },
      {
        inquiryId: "INQ-002", 
        userName: "Priya Sharma",
        userPhone: "+91 98765 43214",
        city: "Mumbai",
        material: "tmt",
        brand: "Tata Steel",
        quantity: "2 tons",
        vendorsContacted: ["vendor_002"],
        responseCount: 0,
        status: "pending"
      },
      {
        inquiryId: "INQ-003",
        userName: "Amit Singh",
        city: "Delhi", 
        material: "cement",
        vendorsContacted: ["vendor_003"],
        responseCount: 1,
        status: "completed"
      }
    ];

    sampleInquiries.forEach(inquiry => this.createInquiry(inquiry));

    // Initialize bot config
    this.updateBotConfig({
      messageTemplate: `Hi [Vendor Name], I'm [User Name] from [City].

I'm looking for today's rate for [Material].
Can you please share:
- Latest Rate
- GST %  
- Delivery Charges (if any)

Thanks!`,
      maxVendorsPerInquiry: 3,
      messagesPerMinute: 20,
      autoResponseEnabled: true,
      botActive: true
    });

    // Initialize API keys
    this.createApiKey({
      keyName: "Production API",
      keyValue: "pk_live_1234567890abcdef",
      isActive: true
    });
  }

  async getVendors(city?: string, material?: string): Promise<Vendor[]> {
    let vendors = Array.from(this.vendors.values());
    
    if (city) {
      vendors = vendors.filter(v => v.city.toLowerCase() === city.toLowerCase());
    }
    
    if (material) {
      vendors = vendors.filter(v => v.materials.includes(material.toLowerCase()));
    }
    
    return vendors.sort((a, b) => (b.responseCount || 0) - (a.responseCount || 0));
  }

  async getVendor(id: number): Promise<Vendor | undefined> {
    return this.vendors.get(id);
  }

  async getVendorByVendorId(vendorId: string): Promise<Vendor | undefined> {
    return Array.from(this.vendors.values()).find(v => v.vendorId === vendorId);
  }

  async createVendor(insertVendor: InsertVendor): Promise<Vendor> {
    const id = this.currentId++;
    const vendor: Vendor = {
      id,
      ...insertVendor,
      lastQuoted: null,
      isActive: insertVendor.isActive ?? true,
      responseCount: insertVendor.responseCount ?? 0,
      responseRate: insertVendor.responseRate ?? "0",
      rank: insertVendor.rank ?? 0,
      createdAt: new Date()
    };
    this.vendors.set(id, vendor);
    return vendor;
  }

  async updateVendor(id: number, update: Partial<Vendor>): Promise<Vendor | undefined> {
    const vendor = this.vendors.get(id);
    if (!vendor) return undefined;
    
    const updated = { ...vendor, ...update };
    this.vendors.set(id, updated);
    return updated;
  }

  async getTopVendors(limit = 10, material?: string): Promise<Vendor[]> {
    const vendors = await this.getVendors(undefined, material);
    return vendors.slice(0, limit);
  }

  async getInquiries(limit = 50): Promise<Inquiry[]> {
    const inquiries = Array.from(this.inquiries.values())
      .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
    
    return limit ? inquiries.slice(0, limit) : inquiries;
  }

  async getInquiry(id: number): Promise<Inquiry | undefined> {
    return this.inquiries.get(id);
  }

  async getInquiryByInquiryId(inquiryId: string): Promise<Inquiry | undefined> {
    return Array.from(this.inquiries.values()).find(i => i.inquiryId === inquiryId);
  }

  async createInquiry(insertInquiry: InsertInquiry): Promise<Inquiry> {
    const id = this.currentId++;
    const inquiry: Inquiry = {
      id,
      ...insertInquiry,
      userPhone: insertInquiry.userPhone ?? null,
      brand: insertInquiry.brand ?? null,
      quantity: insertInquiry.quantity ?? null,
      responseCount: insertInquiry.responseCount ?? 0,
      status: insertInquiry.status ?? "pending",
      timestamp: new Date()
    };
    this.inquiries.set(id, inquiry);
    return inquiry;
  }

  async updateInquiry(id: number, update: Partial<Inquiry>): Promise<Inquiry | undefined> {
    const inquiry = this.inquiries.get(id);
    if (!inquiry) return undefined;
    
    const updated = { ...inquiry, ...update };
    this.inquiries.set(id, updated);
    return updated;
  }

  async getPriceResponses(inquiryId?: string, vendorId?: string): Promise<PriceResponse[]> {
    let responses = Array.from(this.priceResponses.values());
    
    if (inquiryId) {
      responses = responses.filter(r => r.inquiryId === inquiryId);
    }
    
    if (vendorId) {
      responses = responses.filter(r => r.vendorId === vendorId);
    }
    
    return responses.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  }

  async createPriceResponse(insertResponse: InsertPriceResponse): Promise<PriceResponse> {
    const id = this.currentId++;
    const response: PriceResponse = {
      id,
      ...insertResponse,
      deliveryCharge: insertResponse.deliveryCharge ?? "0",
      timestamp: new Date()
    };
    this.priceResponses.set(id, response);
    return response;
  }

  async getLatestPrices(city?: string, material?: string, limit = 20): Promise<PriceResponse[]> {
    let responses = Array.from(this.priceResponses.values());
    
    if (material) {
      responses = responses.filter(r => r.material.toLowerCase() === material.toLowerCase());
    }
    
    // Filter by city through vendor lookup
    if (city) {
      const vendors = await this.getVendors(city);
      const vendorIds = vendors.map(v => v.vendorId);
      responses = responses.filter(r => vendorIds.includes(r.vendorId));
    }
    
    return responses
      .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
      .slice(0, limit);
  }

  async getBotConfig(): Promise<BotConfig | undefined> {
    const configs = Array.from(this.botConfigs.values());
    return configs[0];
  }

  async updateBotConfig(config: Partial<BotConfig>): Promise<BotConfig> {
    const existing = await this.getBotConfig();
    
    if (existing) {
      const updated = { ...existing, ...config };
      this.botConfigs.set(existing.id, updated);
      return updated;
    } else {
      const id = this.currentId++;
      const newConfig: BotConfig = {
        id,
        messageTemplate: config.messageTemplate || "",
        maxVendorsPerInquiry: config.maxVendorsPerInquiry ?? 3,
        messagesPerMinute: config.messagesPerMinute ?? 20,
        autoResponseEnabled: config.autoResponseEnabled ?? true,
        botActive: config.botActive ?? true
      };
      this.botConfigs.set(id, newConfig);
      return newConfig;
    }
  }

  async getApiKeys(): Promise<ApiKey[]> {
    return Array.from(this.apiKeys.values()).filter(k => k.isActive);
  }

  async createApiKey(insertApiKey: InsertApiKey): Promise<ApiKey> {
    const id = this.currentId++;
    const apiKey: ApiKey = {
      id,
      ...insertApiKey,
      isActive: insertApiKey.isActive ?? true,
      lastUsed: null,
      createdAt: new Date()
    };
    this.apiKeys.set(id, apiKey);
    return apiKey;
  }

  async validateApiKey(keyValue: string): Promise<boolean> {
    const apiKey = Array.from(this.apiKeys.values()).find(k => k.keyValue === keyValue);
    return apiKey ? Boolean(apiKey.isActive) : false;
  }

  async getDashboardMetrics() {
    const allInquiries = Array.from(this.inquiries.values());
    const allVendors = Array.from(this.vendors.values());
    const allResponses = Array.from(this.priceResponses.values());
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayInquiries = allInquiries.filter(i => 
      new Date(i.timestamp || 0) >= today
    ).length;
    
    const activeVendors = allVendors.filter(v => v.isActive).length;
    
    const totalInquiries = allInquiries.length;
    const totalResponses = allResponses.length;
    const responseRate = totalInquiries > 0 ? Math.round((totalResponses / totalInquiries) * 100) : 0;
    
    const messagesSent = totalInquiries * 3; // Assuming 3 vendors contacted per inquiry
    
    const cities = new Set(allVendors.map(v => v.city));
    const citiesCovered = cities.size;
    
    return {
      totalInquiries,
      activeVendors,
      responseRate,
      messagesSent,
      todayInquiries,
      citiesCovered
    };
  }
}

export const storage = new DatabaseStorage();
