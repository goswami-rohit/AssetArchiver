import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertVendorSchema, insertInquirySchema, insertPriceResponseSchema, insertBotConfigSchema } from "@shared/schema";
import { z } from "zod";

// API key validation middleware
const validateApiKey = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  
  const token = authHeader.substring(7);
  const isValid = await storage.validateApiKey(token);
  
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Dashboard metrics endpoint
  app.get("/api/metrics", async (req, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch metrics" });
    }
  });

  // Get latest pricing data - public endpoint with API key
  app.get("/api/rates", validateApiKey, async (req, res) => {
    try {
      const { city, material, limit } = req.query;
      const rates = await storage.getLatestPrices(
        city as string,
        material as string,
        limit ? parseInt(limit as string) : undefined
      );
      
      // Enhance with vendor information
      const enhancedRates = await Promise.all(
        rates.map(async (rate) => {
          const vendor = await storage.getVendorByVendorId(rate.vendorId);
          return {
            ...rate,
            vendorName: vendor?.name,
            vendorCity: vendor?.city
          };
        })
      );
      
      res.json({
        status: "success",
        data: enhancedRates
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rates" });
    }
  });

  // Submit vendor response
  app.post("/api/vendor-response", validateApiKey, async (req, res) => {
    try {
      const responseData = insertPriceResponseSchema.parse(req.body);
      const response = await storage.createPriceResponse(responseData);
      
      // Update vendor last quoted time
      const vendor = await storage.getVendorByVendorId(responseData.vendorId);
      if (vendor) {
        await storage.updateVendor(vendor.id, { 
          lastQuoted: new Date(),
          responseCount: (vendor.responseCount || 0) + 1
        });
      }
      
      res.json({
        status: "success",
        data: response
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to submit response" });
      }
    }
  });

  // Get top vendors
  app.get("/api/top-vendors", validateApiKey, async (req, res) => {
    try {
      const { material, limit } = req.query;
      const vendors = await storage.getTopVendors(
        limit ? parseInt(limit as string) : undefined,
        material as string
      );
      
      res.json({
        status: "success",
        data: vendors
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch top vendors" });
    }
  });

  // Log inquiry
  app.post("/api/inquiry-log", async (req, res) => {
    try {
      const inquiryData = insertInquirySchema.parse(req.body);
      const inquiry = await storage.createInquiry(inquiryData);
      
      res.json({
        status: "success", 
        data: inquiry
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to log inquiry" });
      }
    }
  });

  // Admin endpoints (no API key required for internal use)
  
  // Get all inquiries
  app.get("/api/admin/inquiries", async (req, res) => {
    try {
      const { limit } = req.query;
      const inquiries = await storage.getInquiries(
        limit ? parseInt(limit as string) : undefined
      );
      res.json(inquiries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch inquiries" });
    }
  });

  // Get all vendors
  app.get("/api/admin/vendors", async (req, res) => {
    try {
      const { city, material } = req.query;
      const vendors = await storage.getVendors(city as string, material as string);
      res.json(vendors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vendors" });
    }
  });

  // Create vendor
  app.post("/api/admin/vendors", async (req, res) => {
    try {
      const vendorData = insertVendorSchema.parse(req.body);
      const vendor = await storage.createVendor(vendorData);
      res.json(vendor);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid vendor data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create vendor" });
      }
    }
  });

  // Get bot configuration
  app.get("/api/admin/bot-config", async (req, res) => {
    try {
      const config = await storage.getBotConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bot config" });
    }
  });

  // Update bot configuration
  app.put("/api/admin/bot-config", async (req, res) => {
    try {
      const configData = insertBotConfigSchema.partial().parse(req.body);
      const config = await storage.updateBotConfig(configData);
      res.json(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid config data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update bot config" });
      }
    }
  });

  // Get API keys
  app.get("/api/admin/api-keys", async (req, res) => {
    try {
      const apiKeys = await storage.getApiKeys();
      res.json(apiKeys);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch API keys" });
    }
  });

  // Get price responses/updates
  app.get("/api/admin/price-responses", async (req, res) => {
    try {
      const { inquiryId, vendorId } = req.query;
      const responses = await storage.getPriceResponses(
        inquiryId as string,
        vendorId as string
      );
      
      // Enhance with vendor information
      const enhancedResponses = await Promise.all(
        responses.map(async (response) => {
          const vendor = await storage.getVendorByVendorId(response.vendorId);
          return {
            ...response,
            vendorName: vendor?.name,
            vendorCity: vendor?.city
          };
        })
      );
      
      res.json(enhancedResponses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch price responses" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
