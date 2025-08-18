// aiService.ts - ENHANCED RAG with AI-Powered Intelligence
import OpenAI from 'openai';
import { qdrantClient, searchSimilarEndpoints } from './qdrant';

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
}

class EnhancedRAGService {
  private openai: OpenAI;
  private ready: Promise<void>;

  constructor() {
    // OpenRouter with FREE model
    this.openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY!,
      defaultHeaders: {
        "HTTP-Referer": process.env.NGROK_URL || "https://telesalesside.onrender.com",
        "X-Title": "Enhanced Field Service RAG Assistant",
      },
    });

    this.ready = this.initialize();
  }

  private async initialize() {
    console.log("🚀 Initializing Enhanced RAG Service with AI Intelligence...");
    await this.testQdrantConnection();
  }

  private async testQdrantConnection() {
    try {
      console.log("🔌 Testing Qdrant connection...");
      const collections = await qdrantClient.getCollections();
      console.log("✅ Qdrant connected! Collections:", collections.collections.length);
    } catch (error) {
      console.error("❌ Qdrant connection failed:", error);
    }
  }

  // 🤖 AI-POWERED ENDPOINT DISCOVERY (No embeddings needed!)
  private async findRelevantEndpoints(userMessage: string): Promise<EndpointResult[]> {
    console.log("🤖 AI-powered endpoint discovery...");
    
    try {
      // Let AI analyze the user intent and match to endpoints
      const aiAnalysis = await this.analyzeUserIntent(userMessage);
      
      if (aiAnalysis.endpoints && aiAnalysis.endpoints.length > 0) {
        console.log(`✅ AI found ${aiAnalysis.endpoints.length} relevant endpoints`);
        return aiAnalysis.endpoints;
      }
      
      // Fallback to simple matching if AI fails
      return this.simpleKeywordMatch(userMessage);
      
    } catch (error) {
      console.error("❌ AI endpoint discovery failed:", error);
      return this.simpleKeywordMatch(userMessage);
    }
  }

  // 🧠 AI INTENT ANALYSIS (Pure LLM reasoning!)
  private async analyzeUserIntent(userMessage: string): Promise<any> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: "openai/gpt-oss-20b:free",
        messages: [
          {
            role: "system",
            content: `You are an API endpoint classifier for a field service system.

AVAILABLE ENDPOINTS:
- /api/dvr - Dealer Visit Reports (creating/viewing dealer visits, field visits)
- /api/tvr - Territory Visit Reports (territory planning, travel reports)
- /api/tasks - Task Management (pending tasks, assignments, work items)
- /api/dealers - Dealer Management (dealer info, creating dealers, store details)
- /api/attendance - Attendance Tracking (check in/out, presence, work hours)
- /api/pjp - Journey Planning (route planning, schedules, itineraries)

ANALYZE the user message and return JSON with:
{
  "intent": "primary user intent",
  "confidence": 0.0-1.0,
  "endpoints": [
    {
      "name": "API Name",
      "endpoint": "/api/xxx",
      "description": "why this matches",
      "similarity": 0.0-1.0,
      "action": "fetch|create|update",
      "fields": {},
      "requiredFields": {}
    }
  ]
}

Focus on understanding WHAT the user wants to do, not just keywords.`
          },
          {
            role: "user", 
            content: `User message: "${userMessage}"`
          }
        ],
        max_tokens: 400,
        temperature: 0.1,
      });

      const response = completion.choices[0]?.message?.content;
      const analysis = JSON.parse(response || '{"endpoints": []}');
      
      console.log(`🎯 AI identified ${analysis.endpoints?.length || 0} relevant endpoints`);
      return analysis;
      
    } catch (error) {
      console.error("❌ AI intent analysis failed:", error);
      return { endpoints: [] };
    }
  }

  // 🔄 SIMPLE BACKUP (when AI fails)
  private simpleKeywordMatch(userMessage: string): EndpointResult[] {
    const message = userMessage.toLowerCase();
    
    if (message.includes('task') || message.includes('pending') || message.includes('work')) {
      return [{
        name: 'Tasks',
        endpoint: '/api/tasks',
        description: 'Task management system',
        similarity: 0.7,
        fields: {},
        requiredFields: {}
      }];
    }
    
    if (message.includes('visit') || message.includes('dvr') || message.includes('dealer')) {
      return [{
        name: 'DVR',
        endpoint: '/api/dvr',
        description: 'Dealer visit reports',
        similarity: 0.7,
        fields: {},
        requiredFields: {}
      }];
    }
    
    console.log("🔄 Using fallback: Tasks endpoint");
    return [{
      name: 'Tasks',
      endpoint: '/api/tasks',
      description: 'Default task endpoint',
      similarity: 0.5,
      fields: {},
      requiredFields: {}
    }];
  }

  // 💬 ENHANCED RAG CHAT with AI Intelligence
  async chat(messages: ChatMessage[], userId?: number): Promise<string> {
    await this.ready;
    console.log("💬 Enhanced RAG processing with AI intelligence...");

    try {
      const userMessage = messages[messages.length - 1]?.content || '';
      
      // 1. RETRIEVE: AI-powered endpoint discovery
      const relevantEndpoints = await this.findRelevantEndpoints(userMessage);
      
      // 2. AUGMENT: Build enhanced context
      const endpointContext = relevantEndpoints.length > 0 
        ? relevantEndpoints.map(ep => 
            `- ${ep.name}: ${ep.description} (${ep.endpoint}) [Confidence: ${ep.similarity.toFixed(2)}]`
          ).join('\n')
        : 'Available services: DVR, TVR, PJP, Dealers, Attendance, Tasks';
      
      const conversationHistory = messages.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n');
      
      // 3. GENERATE: Enhanced response with UI awareness
      const completion = await this.openai.chat.completions.create({
        model: "openai/gpt-oss-20b:free",
        messages: [
          {
            role: "system",
            content: `You are an intelligent field service assistant with API consciousness.

AVAILABLE ENDPOINTS (AI Discovery Results):
${endpointContext}

CONVERSATION HISTORY:
${conversationHistory}

GUIDELINES:
- You have AI-powered awareness of all API endpoints
- For data collection, guide users step-by-step with specific field requirements
- Provide UI-aware responses with button/form suggestions
- Be precise about which endpoint to use based on user intent
- If user wants to submit data, extract structured information for API calls
- Keep responses actionable and conversational`
          },
          { role: "user", content: userMessage }
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content || "I'm here to help with intelligent API routing!";
      console.log("✅ Enhanced RAG response generated");
      return response;
    } catch (error) {
      console.error("❌ Enhanced RAG Chat failed:", error);
      return "I'm experiencing some technical difficulties. Please try again.";
    }
  }

  // 🎯 SMART ENDPOINT FINDER
  async findBestEndpoint(userInput: string): Promise<EndpointResult | null> {
    try {
      const endpoints = await this.findRelevantEndpoints(userInput);
      return endpoints.length > 0 ? endpoints[0] : null;
    } catch (error) {
      console.error("❌ Best endpoint finding failed:", error);
      return null;
    }
  }

  // ⚡ DIRECT API EXECUTOR
  async executeEndpoint(endpoint: string, data: any, userId?: number): Promise<any> {
    try {
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
        console.error(`❌ API execution failed for ${endpoint}:`, result);
        return { success: false, error: result.error || 'API execution failed', details: result.details };
      }

      console.log(`✅ Successfully executed ${endpoint}`);
      return { success: true, data: result.data, endpoint };
    } catch (error) {
      console.error(`❌ Direct execution failed for ${endpoint}:`, error);
      return { success: false, error: 'Network or execution error' };
    }
  }

  // 🤖 INTELLIGENT RAG CHAT (Complete AI-Powered Flow)
  async ragChat(userInput: string, userId?: number): Promise<any> {
    console.log("🤖 Starting AI-powered RAG flow...");
    
    try {
      // 1. AI analyzes user intent and finds endpoints
      const relevantEndpoints = await this.findRelevantEndpoints(userInput);
      
      if (!relevantEndpoints || relevantEndpoints.length === 0) {
        return {
          success: false,
          message: "I couldn't understand your request. Could you be more specific about what you'd like to do?",
          suggestion: "Try asking about tasks, visits, dealers, or attendance."
        };
      }

      const bestEndpoint = relevantEndpoints[0];
      console.log(`🎯 AI selected: ${bestEndpoint.name} (${bestEndpoint.similarity})`);

      // 2. Check if user wants to fetch data or create something
      const actionIntent = await this.determineUserAction(userInput, bestEndpoint);
      
      if (actionIntent.action === 'fetch') {
        // Fetch existing data
        const data = await this.fetchData(bestEndpoint.endpoint, userId);
        return {
          success: true,
          message: await this.formatDataResponse(data, bestEndpoint.name, userInput),
          data: data,
          endpoint: bestEndpoint.endpoint,
          action: 'fetch'
        };
      } else if (actionIntent.action === 'create') {
        // Try to extract data for creation
        const extractedData = await this.extractStructuredData([{ role: 'user', content: userInput }], userId);
        
        if (extractedData && !extractedData.error) {
          const result = await this.executeEndpoint(bestEndpoint.endpoint, extractedData.data, userId);
          return {
            success: result.success,
            message: result.success ? 
              `✅ Successfully created ${bestEndpoint.name.toLowerCase()}!` : 
              `❌ Failed to create ${bestEndpoint.name.toLowerCase()}: ${result.error}`,
            data: result.data,
            endpoint: bestEndpoint.endpoint,
            action: 'create'
          };
        }
      }
      
      // 3. Provide guidance
      return {
        success: true,
        message: await this.generateGuidanceResponse(userInput, bestEndpoint),
        endpoint: bestEndpoint.endpoint,
        action: 'guidance'
      };
      
    } catch (error) {
      console.error("❌ AI-powered RAG flow failed:", error);
      return {
        success: false,
        message: "I encountered an error. Please try rephrasing your request.",
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // 🤔 AI DETERMINES USER ACTION
  private async determineUserAction(userInput: string, endpoint: any): Promise<{ action: string; confidence: number }> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: "openai/gpt-oss-20b:free",
        messages: [
          {
            role: "system",
            content: `Determine if user wants to FETCH existing data or CREATE new data.

FETCH indicators: "show me", "get my", "list", "view", "see", "check", "find"
CREATE indicators: "add", "create", "new", "submit", "record", "make"

Return JSON: {"action": "fetch|create|guidance", "confidence": 0.0-1.0}`
          },
          {
            role: "user",
            content: `User: "${userInput}" | Endpoint: ${endpoint.name}`
          }
        ],
        max_tokens: 100,
        temperature: 0.1,
      });

      const response = completion.choices[0]?.message?.content;
      return JSON.parse(response || '{"action": "guidance", "confidence": 0.5}');
    } catch (error) {
      console.error("❌ Action determination failed:", error);
      return { action: 'guidance', confidence: 0.5 };
    }
  }

  // 💬 AI GENERATES GUIDANCE
  private async generateGuidanceResponse(userInput: string, endpoint: any): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: "openai/gpt-oss-20b:free",
        messages: [
          {
            role: "system",
            content: `You're a helpful field service assistant. Guide the user on how to use the ${endpoint.name} system.

Be conversational, helpful, and specific about what they can do. Mention buttons they can click or forms they can fill.

Keep responses under 100 words.`
          },
          {
            role: "user",
            content: `User asked: "${userInput}" | Best match: ${endpoint.name} - ${endpoint.description}`
          }
        ],
        max_tokens: 150,
        temperature: 0.7,
      });

      return completion.choices[0]?.message?.content || "I'm here to help! What would you like to do?";
    } catch (error) {
      console.error("❌ Guidance generation failed:", error);
      return `I can help you with ${endpoint.name.toLowerCase()}. What would you like to do?`;
    }
  }

  // 📄 AI FORMATS DATA RESPONSES
  private async formatDataResponse(data: any[], endpointName: string, userInput: string): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: "openai/gpt-oss-20b:free",
        messages: [
          {
            role: "system",
            content: `Format the data response in a user-friendly way. Be conversational and helpful.

If data is empty, suggest what the user can do next.
If data exists, summarize it clearly and mention key details.

Keep it under 150 words and be encouraging.`
          },
          {
            role: "user",
            content: `User asked: "${userInput}"
Endpoint: ${endpointName}
Data found: ${data.length} items
Sample: ${JSON.stringify(data.slice(0, 2))}`
          }
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      return completion.choices[0]?.message?.content || `Found ${data.length} ${endpointName.toLowerCase()} items.`;
    } catch (error) {
      console.error("❌ Data formatting failed:", error);
      return `Found ${data.length} ${endpointName.toLowerCase()} items.`;
    }
  }

  // 📋 Enhanced Structured Data Extraction
  async extractStructuredData(messages: ChatMessage[], userId?: number): Promise<any> {
    await this.ready;
    console.log("📋 AI-powered data extraction...");

    try {
      const conversation = messages.map(m => `${m.role}: ${m.content}`).join('\n');
      
      // Get relevant endpoints for context
      const userMessage = messages[messages.length - 1]?.content || '';
      const relevantEndpoints = await this.findRelevantEndpoints(userMessage);
      
      const endpointDetails = relevantEndpoints.slice(0, 3).map(ep => 
        `${ep.endpoint}: ${ep.description}\nRequired: ${JSON.stringify(ep.requiredFields)}\nOptional: ${JSON.stringify(ep.fields)}`
      ).join('\n\n');

      const completion = await this.openai.chat.completions.create({
        model: "openai/gpt-oss-20b:free",
        messages: [
          {
            role: "system",
            content: `Extract structured data from conversation for API submission.

RELEVANT ENDPOINTS (AI Discovery Results):
${endpointDetails}

RESPONSE FORMAT:
Success: {"endpoint": "/api/dvr", "data": {"dealerName": "ABC Corp", "location": "Mumbai", ...}}
Error: {"error": "Missing required fields"}

Only return structured data if you can identify the endpoint and have required fields.`
          },
          { role: "user", content: conversation }
        ],
        max_tokens: 600,
        temperature: 0.1,
      });

      const response = completion.choices[0]?.message?.content;
      const extracted = JSON.parse(response || '{"error": "Failed to extract data"}');
      
      console.log("✅ AI data extraction completed:", extracted.endpoint || extracted.error);
      return extracted;
    } catch (error) {
      console.error("❌ AI data extraction failed:", error);
      return { error: "Failed to extract structured data from conversation" };
    }
  }

  // 📊 Fetch data with your auto-CRUD endpoints
  async fetchData(endpoint: string, userId?: number, params: any = {}): Promise<any[]> {
    try {
      const baseUrl = process.env.BASE_URL || 'https://telesalesside.onrender.com';
      const queryParams = new URLSearchParams({ limit: '10', ...params }).toString();
      const url = `${baseUrl}${endpoint}/user/${userId}?${queryParams}`;
      
      const response = await fetch(url);
      const result = await response.json();
      return response.ok ? (result.data || []) : [];
    } catch (error) {
      console.error(`❌ Fetch failed for ${endpoint}:`, error);
      return [];
    }
  }
}

export default new EnhancedRAGService();
export { EnhancedRAGService, ChatMessage };