// aiService.ts - ENHANCED RAG with Instant Vector DB Cognition
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

  // 🚀 LOAD ALL ENDPOINTS AT ONCE (Instant cognition from Vector DB!)
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

  // 🎯 AI FILTERS LOADED COGNITION BASED ON USER WORDS
  private async findRelevantEndpoints(userMessage: string): Promise<EndpointResult[]> {
    await this.cognitionReady;
    
    console.log(`🎯 AI filtering ${this.endpointCognition.length} endpoints...`);
    
    const completion = await this.openai.chat.completions.create({
      model: "openai/gpt-oss-20b:free",
      messages: [
        {
          role: "system",
          content: `You have INSTANT COGNITION of all endpoints. Filter and rank them based on user's words.

COMPLETE ENDPOINT COGNITION:
${JSON.stringify(this.endpointCognition, null, 2)}

Analyze user's words and assign confidence scores. Return top 3 matches.

RESPONSE FORMAT:
{
  "matches": [
    {
      "endpoint": "/api/xxx",
      "name": "Endpoint Name",
      "confidence": 0.0-1.0,
      "reasoning": "why user's words match this endpoint",
      "userAction": "fetch|create|update"
    }
  ]
}`
        },
        {
          role: "user",
          content: `User words: "${userMessage}"`
        }
      ],
      max_tokens: 500,
      temperature: 0.1,
    });

    const analysis = JSON.parse(completion.choices[0]?.message?.content || '{"matches": []}');
    
    const results = analysis.matches.map(match => {
      const endpointInfo = this.endpointCognition.find(ep => ep.endpoint === match.endpoint);
      return {
        name: match.name,
        endpoint: match.endpoint,
        description: endpointInfo?.description || match.reasoning,
        similarity: match.confidence,
        fields: endpointInfo?.fields || {},
        requiredFields: endpointInfo?.requiredFields || {},
        userAction: match.userAction,
        reasoning: match.reasoning
      };
    });

    console.log(`✅ AI filtered to ${results.length} relevant endpoints`);
    return results;
  }

  // 💬 ENHANCED RAG CHAT with Instant Cognition
  async chat(messages: ChatMessage[], userId?: number): Promise<string> {
    await this.cognitionReady;
    console.log("💬 Enhanced RAG processing with instant cognition...");

    const userMessage = messages[messages.length - 1]?.content || '';
    
    const relevantEndpoints = await this.findRelevantEndpoints(userMessage);
    
    const endpointContext = relevantEndpoints.length > 0 
      ? relevantEndpoints.map(ep => 
          `- ${ep.name}: ${ep.description} (${ep.endpoint}) [Confidence: ${ep.similarity.toFixed(2)}]`
        ).join('\n')
      : 'No relevant endpoints found';
    
    const conversationHistory = messages.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n');
    
    const completion = await this.openai.chat.completions.create({
      model: "openai/gpt-oss-20b:free",
      messages: [
        {
          role: "system",
          content: `You are an intelligent field service assistant with complete API cognition.

AVAILABLE ENDPOINTS (Instant Cognition Results):
${endpointContext}

CONVERSATION HISTORY:
${conversationHistory}

GUIDELINES:
- You have instant cognition of all API endpoints loaded from Vector DB
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
      console.error(`❌ API execution failed for ${endpoint}:`, result);
      return { success: false, error: result.error || 'API execution failed', details: result.details };
    }

    console.log(`✅ Successfully executed ${endpoint}`);
    return { success: true, data: result.data, endpoint };
  }

  // 🤖 INTELLIGENT RAG CHAT
  async ragChat(userInput: string, userId?: number): Promise<any> {
    console.log("🤖 Starting AI-powered RAG flow with instant cognition...");
    
    const relevantEndpoints = await this.findRelevantEndpoints(userInput);
    
    if (!relevantEndpoints || relevantEndpoints.length === 0) {
      return {
        success: false,
        message: "I couldn't understand your request. Could you be more specific?",
        suggestion: "Try asking about your work tasks or field activities."
      };
    }

    const bestEndpoint = relevantEndpoints[0];
    console.log(`🎯 AI selected: ${bestEndpoint.name} (${bestEndpoint.similarity}) - ${bestEndpoint.reasoning || 'Best match'}`);

    const actionIntent = await this.determineUserAction(userInput, bestEndpoint);
    
    if (actionIntent.action === 'fetch') {
      const data = await this.fetchData(bestEndpoint.endpoint, userId);
      return {
        success: true,
        message: await this.formatDataResponse(data, bestEndpoint.name, userInput),
        data: data,
        endpoint: bestEndpoint.endpoint,
        action: 'fetch'
      };
    }
    
    if (actionIntent.action === 'create') {
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
    
    return {
      success: true,
      message: await this.generateGuidanceResponse(userInput, bestEndpoint),
      endpoint: bestEndpoint.endpoint,
      action: 'guidance'
    };
  }

  // 🤔 AI DETERMINES USER ACTION
  private async determineUserAction(userInput: string, endpoint: any): Promise<{ action: string; confidence: number }> {
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
  }

  // 💬 AI GENERATES GUIDANCE
  private async generateGuidanceResponse(userInput: string, endpoint: any): Promise<string> {
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
  }

  // 📄 AI FORMATS DATA RESPONSES
  private async formatDataResponse(data: any[], endpointName: string, userInput: string): Promise<string> {
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
  }

  // 📋 Enhanced Structured Data Extraction
  async extractStructuredData(messages: ChatMessage[], userId?: number): Promise<any> {
    await this.cognitionReady;
    console.log("📋 AI-powered data extraction with instant cognition...");

    const conversation = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    
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

RELEVANT ENDPOINTS (Instant Cognition Results):
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
  }

  // 📊 Fetch data with your auto-CRUD endpoints
  async fetchData(endpoint: string, userId?: number, params: any = {}): Promise<any[]> {
    const baseUrl = process.env.BASE_URL || 'https://telesalesside.onrender.com';
    const queryParams = new URLSearchParams({ limit: '10', ...params }).toString();
    const url = `${baseUrl}${endpoint}/user/${userId}?${queryParams}`;
    
    const response = await fetch(url);
    const result = await response.json();
    return response.ok ? (result.data || []) : [];
  }
}

export default new EnhancedRAGService();
export { EnhancedRAGService, ChatMessage };