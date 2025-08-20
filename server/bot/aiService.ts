// aiService.ts - ENHANCED RAG with Qdrant Vector Search
import OpenAI from 'openai';
import { qdrantClient, searchSimilarEndpoints } from '../qdrant';

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
    console.log("🚀 Initializing Enhanced RAG Service with Qdrant...");
    // Test Qdrant connection
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

  // 🎯 VECTOR-POWERED ENDPOINT DISCOVERY
  private async findRelevantEndpoints(userMessage: string): Promise<EndpointResult[]> {
    console.log("🔍 Vector search for relevant endpoints...");
    
    try {
      // Generate embedding for user query
      const embedding = await this.generateEmbedding(userMessage);
      
      // Search similar endpoints using Qdrant
      const similarEndpoints = await searchSimilarEndpoints(embedding, 5);
      
      console.log(`✅ Found ${similarEndpoints.length} relevant endpoints via vector search`);
      return similarEndpoints;
    } catch (error) {
      console.error("❌ Vector search failed:", error);
      return [];
    }
  }

  // 🧠 GENERATE EMBEDDINGS
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error("❌ Embedding generation failed:", error);
      // Fallback to simple vector for testing
      return new Array(1536).fill(0).map(() => Math.random());
    }
  }

  // 💬 ENHANCED RAG CHAT with Vector Search
  async chat(messages: ChatMessage[], userId?: number): Promise<string> {
    await this.ready;
    console.log("💬 Enhanced RAG processing with vector search...");

    try {
      const userMessage = messages[messages.length - 1]?.content || '';
      
      // 1. RETRIEVE: Vector search for relevant endpoints
      const relevantEndpoints = await this.findRelevantEndpoints(userMessage);
      
      // 2. AUGMENT: Build enhanced context
      const endpointContext = relevantEndpoints.length > 0 
        ? relevantEndpoints.map(ep => 
            `- ${ep.name}: ${ep.description} (${ep.endpoint}) [Similarity: ${ep.similarity.toFixed(2)}]`
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

AVAILABLE ENDPOINTS (Vector Search Results):
${endpointContext}

CONVERSATION HISTORY:
${conversationHistory}

GUIDELINES:
- You have semantic awareness of all API endpoints through vector search
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

  // 🤖 INTELLIGENT RAG CHAT (Complete Flow)
  async ragChat(userInput: string, userId?: number): Promise<any> {
    console.log("🤖 Starting intelligent RAG flow...");
    
    try {
      // 1. Find best endpoint using vector search
      const bestEndpoint = await this.findBestEndpoint(userInput);
      
      if (!bestEndpoint) {
        return {
          success: false,
          message: "I couldn't find a relevant endpoint for your request. Could you be more specific?",
          suggestion: "Try asking about visits, reports, dealers, or attendance."
        };
      }

      // 2. Extract structured data if this looks like a submission
      const messages: ChatMessage[] = [{ role: 'user', content: userInput }];
      const extractedData = await this.extractStructuredData(messages, userId);

      if (extractedData && !extractedData.error && extractedData.data) {
        // 3. Execute the endpoint directly
        const executionResult = await this.executeEndpoint(bestEndpoint.endpoint, extractedData.data, userId);
        
        if (executionResult.success) {
          return {
            success: true,
            message: `✅ Successfully processed using ${bestEndpoint.name}!`,
            endpoint: bestEndpoint.endpoint,
            data: executionResult.data,
            similarity: bestEndpoint.similarity
          };
        } else {
          return {
            success: false,
            message: `Found relevant endpoint (${bestEndpoint.name}) but execution failed: ${executionResult.error}`,
            endpoint: bestEndpoint.endpoint,
            error: executionResult.error,
            suggestion: "Please check your data format and try again."
          };
        }
      } else {
        // 4. Just provide guidance without execution
        return {
          success: true,
          message: await this.chat(messages, userId),
          endpoint: bestEndpoint.endpoint,
          similarity: bestEndpoint.similarity,
          guidance: true
        };
      }
    } catch (error) {
      console.error("❌ Intelligent RAG flow failed:", error);
      return {
        success: false,
        message: "I encountered an error processing your request. Please try again.",
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // 📋 Enhanced Structured Data Extraction
  async extractStructuredData(messages: ChatMessage[], userId?: number): Promise<any> {
    await this.ready;
    console.log("📋 Enhanced data extraction with vector context...");

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

RELEVANT ENDPOINTS (Vector Search Results):
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
      
      console.log("✅ Enhanced data extraction completed:", extracted.endpoint || extracted.error);
      return extracted;
    } catch (error) {
      console.error("❌ Enhanced data extraction failed:", error);
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