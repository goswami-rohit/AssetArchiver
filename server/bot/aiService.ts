// aiService.ts - PURE RAG with FREE OpenAI model ONLY
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

class PureRAGService {
  private openai: OpenAI;
  private endpointContext: any[] = [];
  private ready: Promise<void>;

  constructor() {
    // OpenRouter with FREE model ONLY
    this.openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY!,
      defaultHeaders: {
        "HTTP-Referer": process.env.NGROK_URL || "https://telesalesside.onrender.com",
        "X-Title": "Field Service RAG Assistant",
      },
    });

    this.ready = this.initialize();
  }

  private async initialize() {
    console.log("🚀 Initializing PURE RAG Service with FREE model...");
    await this.loadRAGContext();
  }

  private async loadRAGContext() {
    console.log("📥 Loading static RAG context...");

    try {
      // Load from local embeddings file
      const embeddingsPath = path.join(process.cwd(), 'data', 'endpoint-embeddings.json');
      const fileContent = fs.readFileSync(embeddingsPath, 'utf8');
      this.endpointContext = JSON.parse(fileContent);
      console.log(`✅ RAG context loaded (${this.endpointContext.length} endpoints)`);
    } catch (error) {
      console.error("❌ Failed to load RAG context:", error);
      this.endpointContext = [];
    }
  }

  // 🔍 Static keyword matching for relevant endpoints
  private findRelevantEndpoints(userMessage: string): any[] {
    console.log("🔍 Finding relevant endpoints...");
    
    const query = userMessage.toLowerCase();
    const relevantEndpoints = [];

    for (const endpoint of this.endpointContext) {
      const searchText = `${endpoint.name} ${endpoint.description} ${endpoint.searchTerms}`.toLowerCase();
      
      // Simple keyword matching
      let score = 0;
      const keywords = query.split(' ').filter(word => word.length > 2);
      
      for (const keyword of keywords) {
        if (searchText.includes(keyword)) {
          score++;
        }
      }
      
      if (score > 0) {
        relevantEndpoints.push({ ...endpoint, score });
      }
    }

    // Sort by relevance score and return top 5
    return relevantEndpoints
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  // 💬 Pure RAG Chat using FREE model
  async chat(messages: ChatMessage[], userId?: number): Promise<string> {
    await this.ready;
    console.log("💬 Pure RAG processing...");

    try {
      const userMessage = messages[messages.length - 1]?.content || '';
      
      // 1. RETRIEVE: Find relevant endpoints
      const relevantEndpoints = this.findRelevantEndpoints(userMessage);
      
      // 2. AUGMENT: Build context
      const endpointContext = relevantEndpoints.length > 0 
        ? relevantEndpoints.map(ep => `- ${ep.name}: ${ep.description} (${ep.method} ${ep.endpoint})`).join('\n')
        : 'Available services: Daily Visit Reports, Technical Visit Reports, Journey Plans, Dealer Management, Attendance';
      
      const conversationHistory = messages.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n');
      
      // 3. GENERATE: Use FREE model for response
      const completion = await this.openai.chat.completions.create({
        model: "openai/gpt-oss-20b:free",
        messages: [
          {
            role: "system",
            content: `You are a helpful field service assistant. Help users with their tasks.

AVAILABLE SERVICES:
${endpointContext}

RECENT CONVERSATION:
${conversationHistory}

Guidelines:
- For data collection (DVR/TVR), ask questions step by step to gather required information
- For data queries, guide them to the right endpoints
- Be conversational and helpful
- If collecting data for submission, ask for one field at a time
- Keep responses concise and actionable`
          },
          { role: "user", content: userMessage }
        ],
        max_tokens: 400,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content || "I'm here to help with your field service tasks!";
      console.log("✅ RAG response generated with FREE model");
      return response;
    } catch (error) {
      console.error("❌ RAG Chat failed:", error);
      return "I'm experiencing some technical difficulties. Please try again.";
    }
  }

  // 📋 Extract Structured Data using FREE model
  async extractStructuredData(messages: ChatMessage[], userId?: number): Promise<any> {
    await this.ready;
    console.log("📋 Extracting structured data with FREE model...");

    try {
      const conversation = messages.map(m => `${m.role}: ${m.content}`).join('\n');

      const completion = await this.openai.chat.completions.create({
        model: "openai/gpt-oss-20b:free",
        messages: [
          {
            role: "system",
            content: `Extract structured data from this field service conversation for API submission.

SUPPORTED ENDPOINTS:
1. /api/dvr - Daily Visit Reports
   Required: dealerName, location, visitType
   Optional: dealerType, todayOrderMt, todayCollectionRupees, feedbacks, contactPerson, contactPersonPhoneNo

2. /api/tvr - Technical Visit Reports  
   Required: siteNameConcernedPerson, phoneNo, visitType
   Optional: emailId, clientsRemarks, salespersonRemarks

RESPONSE FORMAT:
Success: {"endpoint": "/api/dvr", "data": {"dealerName": "ABC Corp", "location": "Mumbai", "visitType": "Regular", ...}}
Error: {"error": "Missing required fields: dealerName, location"}

Only return structured data if you can identify the report type and have the required fields.`
          },
          { role: "user", content: conversation }
        ],
        max_tokens: 500,
        temperature: 0.1,
      });

      const response = completion.choices[0]?.message?.content;
      const extracted = JSON.parse(response || '{"error": "Failed to extract data"}');
      
      console.log("✅ Data extraction completed:", extracted.endpoint || extracted.error);
      return extracted;
    } catch (error) {
      console.error("❌ Data extraction failed:", error);
      return { error: "Failed to extract structured data from conversation" };
    }
  }

  // Simple data fetchers
  async fetchRecentDealers(userId?: number): Promise<any[]> {
    try {
      const baseUrl = process.env.BASE_URL || 'https://telesalesside.onrender.com';
      const response = await fetch(`${baseUrl}/api/dealers/user/${userId}?limit=5`);
      const result = await response.json();
      return response.ok ? (result.data || []) : [];
    } catch (error) {
      return [];
    }
  }

  async fetchRecentDVRs(userId?: number): Promise<any[]> {
    try {
      const baseUrl = process.env.BASE_URL || 'https://telesalesside.onrender.com';
      const response = await fetch(`${baseUrl}/api/dvr/user/${userId}?limit=5`);
      const result = await response.json();
      return response.ok ? (result.data || []) : [];
    } catch (error) {
      return [];
    }
  }

  async fetchRecentTVRs(userId?: number): Promise<any[]> {
    try {
      const baseUrl = process.env.BASE_URL || 'https://telesalesside.onrender.com';
      const response = await fetch(`${baseUrl}/api/tvr/user/${userId}?limit=5`);
      const result = await response.json();
      return response.ok ? (result.data || []) : [];
    } catch (error) {
      return [];
    }
  }
}

export default new PureRAGService();
export { PureRAGService, ChatMessage };