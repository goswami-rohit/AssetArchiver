// aiService.ts - ENHANCED RAG with SPEED OPTIMIZATIONS
import OpenAI from 'openai';
import { qdrantClient, searchSimilarEndpoints } from 'server/qdrant';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface EndpointResult {
  name: string;
  endpoint: string;
  description: string;
  similarity: number;
  fields: any;
  requiredFields: any;
  userAction?: string;
  reasoning?: string;
}

interface EndpointCognition {
  endpoint: string;
  name: string;
  description: string;
  keywords: string[];
  fields: any;
  requiredFields: any;
  purpose: string;
  actions: string[];
}

class EnhancedRAGService {
  private openai: OpenAI;
  private endpointCognition: EndpointCognition[] = [];
  private cognitionReady: Promise<void>;
  // 🚀 SPEED CACHE - Cache filtered results for 30 seconds
  private filterCache = new Map<string, { results: EndpointResult[], timestamp: number }>();
  private cacheTimeout = 30000; // 30 seconds

  constructor() {
    this.openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY!,
      defaultHeaders: {
        "HTTP-Referer": process.env.NGROK_URL || "https://telesalesside.onrender.com",
        "X-Title": "Enhanced Field Service RAG Assistant",
      },
    });

    this.cognitionReady = this.loadInstantCognition();
  }

  // 🚀 LOAD ALL ENDPOINTS AT ONCE
  private async loadInstantCognition() {
    console.log("🧠 Loading INSTANT COGNITION from Vector DB...");
    
    const collections = await qdrantClient.getCollections();
    console.log("✅ Qdrant connected! Collections:", collections.collections.length);
    
    const allEndpoints = await qdrantClient.scroll("api_endpoints", {
      limit: 1000,
      with_payload: true,
      with_vector: false
    });

    this.endpointCognition = allEndpoints.points.map(point => ({
      endpoint: point.payload.endpoint || '/api/unknown',
      name: point.payload.name || 'Unknown',
      description: point.payload.description || 'No description',
      keywords: point.payload.keywords || [],
      fields: point.payload.fields || {},
      requiredFields: point.payload.requiredFields || {},
      purpose: point.payload.purpose || point.payload.description || 'General purpose',
      actions: point.payload.actions || ['create', 'view', 'update']
    }));

    console.log(`✅ INSTANT COGNITION loaded: ${this.endpointCognition.length} endpoints`);
  }

  // 🚀 SUPER FAST KEYWORD MATCHING (No AI calls for simple cases!)
  private fastKeywordMatch(userMessage: string): EndpointResult[] {
    const message = userMessage.toLowerCase();
    
    // Quick keyword scoring
    const scored = this.endpointCognition.map(endpoint => {
      let score = 0;
      
      // Direct keyword matches
      if (endpoint.keywords && endpoint.keywords.length > 0) {
        endpoint.keywords.forEach(keyword => {
          if (message.includes(keyword.toLowerCase())) {
            score += 0.5;
          }
        });
      }
      
      // Name matches
      if (message.includes(endpoint.name.toLowerCase())) {
        score += 0.7;
      }
      
      // Common patterns
      if (message.includes('attendance') && endpoint.endpoint.includes('attendance')) score += 0.9;
      if (message.includes('punch') && endpoint.endpoint.includes('punch')) score += 0.9;
      if (message.includes('task') && endpoint.endpoint.includes('task')) score += 0.9;
      if (message.includes('dealer') && endpoint.endpoint.includes('dealer')) score += 0.9;
      if (message.includes('visit') && endpoint.endpoint.includes('visit')) score += 0.9;
      
      return { 
        name: endpoint.name,
        endpoint: endpoint.endpoint,
        description: endpoint.description,
        similarity: score,
        fields: endpoint.fields,
        requiredFields: endpoint.requiredFields
      };
    })
    .filter(ep => ep.similarity > 0.3)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);

    return scored;
  }

  // 🎯 SMART FILTERING WITH CACHE
  private async findRelevantEndpoints(userMessage: string): Promise<EndpointResult[]> {
    await this.cognitionReady;
    
    // Check cache first
    const cacheKey = userMessage.toLowerCase().trim();
    const cached = this.filterCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      console.log("⚡ Using cached results");
      return cached.results;
    }
    
    console.log(`🚀 Fast filtering ${this.endpointCognition.length} endpoints...`);
    
    // Try fast keyword matching first
    const fastResults = this.fastKeywordMatch(userMessage);
    if (fastResults.length > 0 && fastResults[0].similarity > 0.8) {
      console.log(`⚡ Fast keyword match found: ${fastResults[0].name}`);
      this.filterCache.set(cacheKey, { results: fastResults, timestamp: Date.now() });
      return fastResults;
    }
    
    // Only use AI for complex cases
    const completion = await this.openai.chat.completions.create({
      model: "openai/gpt-oss-20b:free",
      messages: [
        {
          role: "system",
          content: `Filter endpoints based on user intent. Return JSON only.

ENDPOINTS: ${JSON.stringify(this.endpointCognition.map(ep => ({
  endpoint: ep.endpoint,
  name: ep.name,
  keywords: ep.keywords
})), null, 2)}

Return ONLY JSON:
{"matches": [{"endpoint": "/api/xxx", "name": "Name", "confidence": 0.9, "userAction": "create"}]}`
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      max_tokens: 300,
      temperature: 0.1,
    });

    const response = completion.choices[0]?.message?.content?.trim();
    
    // 🔧 FIX STUPID JSON PARSING - Extract JSON from response
    let jsonStart = response.indexOf('{');
    let jsonEnd = response.lastIndexOf('}');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      console.log("🔄 No valid JSON found, using fast match");
      return fastResults;
    }
    
    const jsonStr = response.substring(jsonStart, jsonEnd + 1);
    
    try {
      const analysis = JSON.parse(jsonStr);
      
      const results = analysis.matches.map(match => {
        const endpointInfo = this.endpointCognition.find(ep => ep.endpoint === match.endpoint);
        return {
          name: match.name,
          endpoint: match.endpoint,
          description: endpointInfo?.description || 'Matched endpoint',
          similarity: match.confidence,
          fields: endpointInfo?.fields || {},
          requiredFields: endpointInfo?.requiredFields || {},
          userAction: match.userAction
        };
      });

      // Cache results
      this.filterCache.set(cacheKey, { results, timestamp: Date.now() });
      console.log(`✅ AI filtered to ${results.length} relevant endpoints`);
      return results;
      
    } catch (error) {
      console.log("🔄 JSON parse failed, using fast match:", error.message);
      return fastResults;
    }
  }

  // 💬 ENHANCED RAG CHAT
  async chat(messages: ChatMessage[], userId?: number): Promise<string> {
    await this.cognitionReady;
    
    const userMessage = messages[messages.length - 1]?.content || '';
    const relevantEndpoints = await this.findRelevantEndpoints(userMessage);
    
    const endpointContext = relevantEndpoints.length > 0 
      ? relevantEndpoints.map(ep => `- ${ep.name}: ${ep.description}`).join('\n')
      : 'No relevant endpoints found';

    const completion = await this.openai.chat.completions.create({
      model: "openai/gpt-oss-20b:free",
      messages: [
        {
          role: "system",
          content: `You are a helpful field service assistant.

AVAILABLE ENDPOINTS:
${endpointContext}

Be helpful and guide users to use the right endpoint.`
        },
        { role: "user", content: userMessage }
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || "I'm here to help!";
  }

  // 🎯 SMART ENDPOINT FINDER
  async findBestEndpoint(userInput: string): Promise<EndpointResult | null> {
    const endpoints = await this.findRelevantEndpoints(userInput);
    return endpoints.length > 0 ? endpoints[0] : null;
  }

  // ⚡ DIRECT API EXECUTOR
  async executeEndpoint(endpoint: string, data: any, userId?: number): Promise<any> {
    const baseUrl = process.env.BASE_URL || 'https://telesalesside.onrender.com';
    
    console.log(`🎯 Executing ${endpoint} with data:`, data);
    
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Enhanced-RAG-Service/2.0'
      },
      body: JSON.stringify({ userId, ...data })
    });

    const result = await response.json();
    
    if (!response.ok) {
      return { success: false, error: result.error || 'API execution failed' };
    }

    return { success: true, data: result.data, endpoint };
  }

  // 🤖 SUPER FAST RAG CHAT
  async ragChat(userInput: string, userId?: number): Promise<any> {
    console.log("🤖 Starting FAST RAG flow...");
    
    const relevantEndpoints = await this.findRelevantEndpoints(userInput);
    
    if (!relevantEndpoints || relevantEndpoints.length === 0) {
      return {
        success: false,
        message: "I couldn't understand your request. Could you be more specific?",
      };
    }

    const bestEndpoint = relevantEndpoints[0];
    console.log(`🎯 Selected: ${bestEndpoint.name} (${bestEndpoint.similarity})`);

    // 🚀 DETERMINE ACTION QUICKLY
    const isCreate = /create|add|new|submit|record|make|punch/i.test(userInput);
    const isFetch = /show|get|list|view|see|check|find/i.test(userInput);
    
    if (isFetch) {
      const data = await this.fetchData(bestEndpoint.endpoint, userId);
      return {
        success: true,
        message: `Found ${data.length} ${bestEndpoint.name.toLowerCase()} items.`,
        data: data,
        endpoint: bestEndpoint.endpoint,
        action: 'fetch'
      };
    }
    
    if (isCreate) {
      // 🚀 SIMPLE DATA EXTRACTION (No complex AI)
      const extractedData = this.simpleDataExtraction(userInput, bestEndpoint);
      
      if (extractedData.data) {
        const result = await this.executeEndpoint(bestEndpoint.endpoint, extractedData.data, userId);
        return {
          success: result.success,
          message: result.success ? 
            `✅ Successfully created ${bestEndpoint.name.toLowerCase()}!` : 
            `❌ Failed: ${result.error}`,
          data: result.data,
          endpoint: bestEndpoint.endpoint,
          action: 'create'
        };
      }
    }
    
    return {
      success: true,
      message: `I can help you with ${bestEndpoint.name.toLowerCase()}. What would you like to do?`,
      endpoint: bestEndpoint.endpoint,
      action: 'guidance'
    };
  }

  // 🚀 SIMPLE DATA EXTRACTION (No AI calls!)
  private simpleDataExtraction(userInput: string, endpoint: EndpointResult): any {
    console.log("⚡ Simple data extraction...");
    
    // For attendance punch-in, just use current time and location
    if (endpoint.endpoint.includes('attendance') || endpoint.endpoint.includes('punch')) {
      return {
        data: {
          checkInTime: new Date().toISOString(),
          location: 'Mobile App',
          notes: userInput
        }
      };
    }
    
    // For other endpoints, return basic structure
    return {
      data: {
        title: userInput.substring(0, 50),
        description: userInput,
        createdAt: new Date().toISOString()
      }
    };
  }

  // 📊 Fetch data
  async fetchData(endpoint: string, userId?: number, params: any = {}): Promise<any[]> {
    const baseUrl = process.env.BASE_URL || 'https://telesalesside.onrender.com';
    const queryParams = new URLSearchParams({ limit: '10', ...params }).toString();
    const url = `${baseUrl}${endpoint}/user/${userId}?${queryParams}`;
    
    const response = await fetch(url);
    const result = await response.json();
    return response.ok ? (result.data || []) : [];
  }

  // 📋 SIMPLE Structured Data Extraction (Only when needed)
  async extractStructuredData(messages: ChatMessage[], userId?: number): Promise<any> {
    // Skip AI extraction for simple cases
    const userMessage = messages[messages.length - 1]?.content || '';
    return this.simpleDataExtraction(userMessage, { 
      name: 'Generic', 
      endpoint: '/api/generic',
      description: 'Generic endpoint',
      similarity: 0.5,
      fields: {},
      requiredFields: {}
    });
  }
}

export default new EnhancedRAGService();
export { EnhancedRAGService, ChatMessage };