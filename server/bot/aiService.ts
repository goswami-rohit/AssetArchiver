import OpenAI from 'openai';
import { QdrantClient } from '@qdrant/js-client-rest';
import { pipeline } from '@xenova/transformers';
import path from 'path';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OrchestrationStep {
  type: string;
  data?: any;
  userId?: number;
  id?: string;
  dealerId?: string;
  messages?: ChatMessage[];
  output?: any;
}

interface OrchestrationPlan {
  intent: string;
  steps: OrchestrationStep[];
  isMultiStep: boolean;
}

interface OrchestrationResult {
  success: boolean;
  finalResponse: string;
  executedSteps: OrchestrationStep[];
  error?: string;
}

class PureRAGService {
  private openai: OpenAI;
  private qdrant: QdrantClient;
  private embedder: any;
  private endpointContext: string = '';
  private ready: Promise<void>;

  constructor() {
    const requiredEnvVars = ["OPENROUTER_API_KEY", "QDRANT_API_KEY"];
    requiredEnvVars.forEach((envVar) => {
      if (!process.env[envVar]) {
        throw new Error(`❌ Missing environment variable: ${envVar}`);
      }
    });

    // OpenRouter with FREE models ONLY for orchestration
    this.openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY!,
      defaultHeaders: {
        "HTTP-Referer": process.env.NGROK_URL || "https://telesalesside.onrender.com",
        "X-Title": "Field Service RAG Assistant",
      },
    });

    // YOUR Qdrant instance
    this.qdrant = new QdrantClient({
      url: "https://159aa838-50db-435a-b6d7-46b432c554ba.eu-west-1-0.aws.cloud.qdrant.io:6333",
      apiKey: process.env.QDRANT_API_KEY!,
    });

    this.ready = this.initialize();
  }

  private async initialize() {
    console.log("🚀 Initializing AI Service...");
    
    // Load embedding model EXACTLY like YOUR scripts/generate-embeddings.js
    console.log("📦 Loading model: Xenova/all-MiniLM-L6-v2");
    this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log("✅ Local embedding model loaded (FREE!)");

    await this.loadRAGContext();
  }

  private async loadRAGContext() {
    console.log("📥 Loading RAG context from YOUR Qdrant...");

    try {
      // Use YOUR collection name from scripts/upload-embeddings.js
      const response = await this.qdrant.scroll("api_endpoints", {
        limit: 100,
        with_payload: true,
        with_vector: false,
      });

      const endpoints = response.points.map((point) => point.payload);
      this.endpointContext = `AVAILABLE ENDPOINTS: ${endpoints.length} tools loaded`;
      console.log(`✅ RAG context loaded (${endpoints.length} endpoints)`);
    } catch (error) {
      console.error("❌ Failed to load RAG context:", error);
      throw error;
    }
  }

  // 🤖 MAIN ORCHESTRATION FUNCTION - ONLY entry point
  async orchestrateAI(userMessage: string, userId: number, context: any = {}): Promise<OrchestrationResult> {
    await this.ready;
    console.log("🎭 Starting AI orchestration...");

    try {
      // Step 1: Find relevant tools using YOUR local embeddings
      const relevantTools = await this.findRelevantTools(userMessage);
      
      // Step 2: Create plan using FREE model
      const plan = await this.createOrchestrationPlan(userMessage, relevantTools, userId, context);
      
      // Step 3: Execute using YOUR Orchestrator
      const result = await this.executePlan(plan, userId, context);
      
      return result;
    } catch (error) {
      console.error("❌ Orchestration failed:", error);
      throw error;
    }
  }

  // 🔍 STEP 1: Find tools using YOUR embedding setup
  private async findRelevantTools(userMessage: string): Promise<any[]> {
    console.log("🔍 Finding relevant tools via LOCAL embeddings...");
    
    try {
      // Generate embedding EXACTLY like YOUR scripts/generate-embeddings.js
      const output = await this.embedder(userMessage, { pooling: 'mean', normalize: true });
      const embedding = Array.from(output.data);
      console.log(`✅ Generated ${embedding.length}-dimensional embedding (FREE!)`);
      
      // Search YOUR Qdrant collection
      const searchResult = await this.qdrant.search("api_endpoints", {
        vector: embedding,
        limit: 5,
        score_threshold: 0.7,
        with_payload: true
      });
      
      const relevantTools = searchResult.map(point => point.payload);
      console.log(`✅ Found ${relevantTools.length} relevant tools`);
      
      return relevantTools;
    } catch (error) {
      console.error("❌ Tool search failed:", error);
      throw error;
    }
  }

  // 📋 STEP 2: Create plan using FREE model ONLY
  private async createOrchestrationPlan(
    userMessage: string, 
    relevantTools: any[], 
    userId: number, 
    context: any
  ): Promise<OrchestrationPlan> {
    console.log("📋 Creating orchestration plan...");
    
    try {
      const planningPrompt = `
Analyze this user request and create an execution plan:

USER MESSAGE: "${userMessage}"
USER ID: ${userId}

AVAILABLE ACTION TYPES:
DVR: create_dvr, get_dvrs, get_dvr, update_dvr, delete_dvr
TVR: create_tvr, get_tvrs, get_tvr, update_tvr, delete_tvr  
PJP: create_pjp, get_pjps, get_pjp, update_pjp, delete_pjp
DEALERS: create_dealer, get_dealers, get_dealer, update_dealer, delete_dealer
CLIENT REPORTS: create_client_report, get_client_reports, get_client_report, update_client_report, delete_client_report
COMPETITION REPORTS: create_competition_report, get_competition_reports, get_competition_report, update_competition_report, delete_competition_report
DEALER SCORES: create_dealer_score, get_dealer_scores, update_dealer_score
ATTENDANCE: punch_in
CHECKIN: check_in, check_out, create_tracking, get_tracking
RAG: rag_chat, rag_extract, rag_submit

RELEVANT TOOLS:
${relevantTools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

Respond with JSON:
{
  "intent": "what user wants",
  "steps": [{"type": "action_type", "data": {...}, "userId": ${userId}}],
  "isMultiStep": false
}
`;

      const completion = await this.openai.chat.completions.create({
        model: "openai/gpt-oss-20b:free",
        messages: [
          { role: "system", content: "You are a planning assistant. Always respond with valid JSON." },
          { role: "user", content: planningPrompt }
        ],
        max_tokens: 800,
        temperature: 0.1,
      });

      const planResponse = completion.choices[0]?.message?.content;
      const plan = JSON.parse(planResponse || '{"intent": "unknown", "steps": [], "isMultiStep": false}');
      
      console.log(`✅ Plan created: ${plan.intent} (${plan.steps.length} steps)`);
      return plan;
    } catch (error) {
      console.error("❌ Planning failed:", error);
      throw error;
    }
  }

  // ⚡ STEP 3: Execute using YOUR Orchestrator directory
  private async executePlan(plan: OrchestrationPlan, userId: number, context: any): Promise<OrchestrationResult> {
    console.log("⚡ Executing orchestration plan...");
    
    const executedSteps: OrchestrationStep[] = [];
    
    try {
      // Load YOUR Orchestrator/index.js
      const { orchestrate } = require(path.join(process.cwd(), 'Orchestrator', 'index.js'));
      
      if (plan.isMultiStep) {
        let previousOutput = null;
        
        for (const step of plan.steps) {
          console.log(`🔄 Executing step: ${step.type}`);
          
          const orchestratorInput = {
            type: step.type,
            userId: step.userId || userId,
            data: step.data || {},
            id: step.id,
            dealerId: step.dealerId,
            messages: step.messages,
            previousOutput
          };
          
          // Use YOUR orchestrator (calls YOUR decisionLogic.js + executor.js + tools)
          const stepResult = await orchestrate(orchestratorInput);
          
          step.output = stepResult;
          executedSteps.push(step);
          previousOutput = stepResult;
        }
      } else {
        if (plan.steps.length > 0) {
          const step = plan.steps[0];
          console.log(`🔄 Executing single step: ${step.type}`);
          
          const orchestratorInput = {
            type: step.type,
            userId: step.userId || userId,
            data: step.data || {},
            id: step.id,
            dealerId: step.dealerId,
            messages: step.messages
          };
          
          // Use YOUR orchestrator
          const stepResult = await orchestrate(orchestratorInput);
          
          step.output = stepResult;
          executedSteps.push(step);
        }
      }
      
      // Generate final response
      const finalResponse = await this.generateFinalResponse(plan, executedSteps);
      
      return {
        success: true,
        finalResponse,
        executedSteps
      };
    } catch (error) {
      console.error("❌ Execution failed:", error);
      throw error;
    }
  }

  // 📝 Generate final response using FREE model
  private async generateFinalResponse(
    plan: OrchestrationPlan, 
    executedSteps: OrchestrationStep[]
  ): Promise<string> {
    console.log("📝 Generating final AI response...");
    
    try {
      const executionSummary = executedSteps.map(step => 
        `${step.type}: ${JSON.stringify(step.output)}`
      ).join('\n');
      
      const completion = await this.openai.chat.completions.create({
        model: "openai/gpt-oss-20b:free",
        messages: [
          {
            role: "system",
            content: `You are a helpful field service assistant. Create a natural response.
            
INTENT: ${plan.intent}
RESULTS: ${executionSummary}

Provide a conversational, helpful response.`
          },
          { role: "user", content: "Summarize what was accomplished." }
        ],
        max_tokens: 400,
        temperature: 0.7,
      });

      return completion.choices[0]?.message?.content || "Task completed successfully.";
    } catch (error) {
      console.error("❌ Final response generation failed:", error);
      throw error;
    }
  }

  // 💬 ONLY orchestration - NO fallbacks
  async chat(messages: ChatMessage[], userId?: number): Promise<string> {
    await this.ready;
    console.log("💬 Chat request received - routing to orchestration");

    if (!userId) {
      throw new Error("User ID required for orchestration");
    }

    const lastMessage = messages[messages.length - 1]?.content;
    const result = await this.orchestrateAI(lastMessage, userId, { messages });
    return result.finalResponse;
  }

  // Keep existing methods for backward compatibility
  async extractStructuredData(messages: ChatMessage[], userId?: number): Promise<any> {
    await this.ready;
    const conversation = messages.map(m => `${m.role}: ${m.content}`).join('\n');

    try {
      const completion = await this.openai.chat.completions.create({
        model: "openai/gpt-oss-20b:free",
        messages: [
          {
            role: "system",
            content: `Extract structured data from this conversation.
Return JSON: {"endpoint": "/api/dvr-manual" or "/api/tvr", "data": {...}} or {"error": "reason"}`
          },
          { role: "user", content: conversation }
        ],
        max_tokens: 400,
        temperature: 0.1,
      });

      const response = completion.choices[0]?.message?.content;
      return JSON.parse(response || '{"error": "Failed to extract data"}');
    } catch (error) {
      console.error("❌ Data extraction failed:", error);
      return { error: "Failed to extract structured data" };
    }
  }

  private async fetchRecentDealers(userId: number): Promise<any[]> {
    try {
      const response = await fetch(`${process.env.BASE_URL || 'https://telesalesside.onrender.com'}/api/dealers/recent?limit=5`);
      const result = await response.json();
      return response.ok ? (result.data || []) : [];
    } catch (error) {
      return [];
    }
  }

  private async fetchRecentDVRs(userId: number): Promise<any[]> {
    try {
      const response = await fetch(`${process.env.BASE_URL || 'https://telesalesside.onrender.com'}/api/dvr/recent?userId=${userId}&limit=5`);
      const result = await response.json();
      return response.ok ? (result.data || []) : [];
    } catch (error) {
      return [];
    }
  }

  private async fetchRecentTVRs(userId: number): Promise<any[]> {
    try {
      const response = await fetch(`${process.env.BASE_URL || 'https://telesalesside.onrender.com'}/api/tvr/recent?userId=${userId}&limit=5`);
      const result = await response.json();
      return response.ok ? (result.data || []) : [];
    } catch (error) {
      return [];
    }
  }
}

export default new PureRAGService();
export { PureRAGService, ChatMessage, OrchestrationResult, OrchestrationPlan };