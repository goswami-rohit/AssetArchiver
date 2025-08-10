import OpenAI from 'openai';
import { QdrantClient } from '@qdrant/js-client-rest';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatResponse {
  message: string;
  isComplete?: boolean;
  endpointData?: any;
}

class PureRAGService {
  private openai: OpenAI;
  private qdrant: QdrantClient;
  private endpointContext: string = '';
  private ready: Promise<void>;

  constructor() {
    // ✅ Validate env vars
    const requiredEnvVars = ["OPENROUTER_API_KEY", "QDRANT_API_KEY"];
    requiredEnvVars.forEach((envVar) => {
      if (!process.env[envVar]) {
        throw new Error(`❌ Missing environment variable: ${envVar}`);
      }
    });

    this.openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY!,
      defaultHeaders: {
        "HTTP-Referer": process.env.NGROK_URL || "https://telesalesside.onrender.com",
        "X-Title": "Field Service RAG Assistant",
      },
    });

    this.qdrant = new QdrantClient({
      url: "https://159aa838-50db-435a-b6d7-46b432c554ba.eu-west-1-0.aws.cloud.qdrant.io:6333",
      apiKey: process.env.QDRANT_API_KEY!,
    });

    // ✅ Wait for RAG context to be ready
    this.ready = this.loadRAGContext();
  }

  private async loadRAGContext() {
    console.log("📥 Loading RAG context from Qdrant...");

    try {
      const response = await this.qdrant.scroll("api_endpoints", {
        limit: 100,
        with_payload: true,
        with_vector: false,
      });

      const endpoints = response.points.map((point) => point.payload);

      this.endpointContext = `
AVAILABLE API ENDPOINTS:

${endpoints
          .map(
            (endpoint) => `
ENDPOINT: ${endpoint.name}
URL: ${endpoint.endpoint} (${endpoint.method})
DESCRIPTION: ${endpoint.description}
FIELDS: ${JSON.stringify(endpoint.fields)}
REQUIRED FIELDS: ${JSON.stringify(endpoint.requiredFields)}
SEARCH TERMS: ${endpoint.searchTerms}
---`
          )
          .join("\n")}
`;

      console.log(`✅ RAG context loaded (${endpoints.length} endpoints)`);
    } catch (error) {
      console.error("❌ Failed to load RAG context from Qdrant:", error);
      throw new Error("Could not connect to Qdrant vector database");
    }
  }

  // Enhanced chat method with REAL proactiveness:
  async chat(messages: ChatMessage[], userId?: number): Promise<string> {
    await this.ready;
    console.log("💬 Chat request received");

    // 🤖 PROACTIVE: Check if user mentioned a visit
    const lastMessage = messages[messages.length - 1]?.content.toLowerCase();
    const isVisitMention = lastMessage.includes('visit') || lastMessage.includes('dealer') || lastMessage.includes('client') || lastMessage.includes('technical');

    let contextualInfo = '';

    if (isVisitMention && userId) {
      console.log("🔍 Visit detected - fetching user's recent activity...");

      // Fetch user's recent activity in parallel
      const [recentDealers, recentDVRs, recentTVRs] = await Promise.all([
        this.fetchRecentDealers(userId),
        this.fetchRecentDVRs(userId),
        this.fetchRecentTVRs(userId)
      ]);

      if (recentDealers.length > 0) {
        contextualInfo += `\n🏢 RECENT DEALERS: ${recentDealers.map(d => `${d.name} (${d.location})`).slice(0, 3).join(', ')}\n`;
      }

      if (recentDVRs.length > 0) {
        contextualInfo += `\n📊 RECENT DVR VISITS: ${recentDVRs.map(d => `${d.dealerName} - ${d.visitType}`).slice(0, 3).join(', ')}\n`;
      }

      if (recentTVRs.length > 0) {
        contextualInfo += `\n🔧 RECENT TVR VISITS: ${recentTVRs.map(t => `${t.siteNameConcernedPerson} - ${t.visitType}`).slice(0, 3).join(', ')}\n`;
      }
    }
    const ragMessages = [
      {
        role: "system" as const,
        content: `You are a proactive field service assistant with access to user's recent activity.
${this.endpointContext}
${contextualInfo}
BUTLER BEHAVIOR:
- Use the recent activity data above to be specific
- When users mention visits, reference their recent patterns
- Don't ask for information you can infer from recent activity
- Be conversational: "I see you recently visited ABC Corp - is this another visit there?"
- Auto-suggest based on patterns: "Like your usual technical visits to XYZ?"
- Only ask for truly missing critical information
BE A SMART BUTLER, NOT A FORM.`,
      },
      ...messages,
    ];
    try {
      const completion = await this.openai.chat.completions.create({
        model: "openai/gpt-oss-20b:free",
        messages: ragMessages,
        max_tokens: 1000,
        temperature: 0.7,
      });
      return completion.choices[0]?.message?.content || "I'm having trouble processing that. Could you try again?";
    } catch (error) {
      console.error("❌ OpenRouter request failed:", error);
      throw new Error("Failed to process chat message");
    }
  }

  private async fetchRecentDealers(userId: number): Promise<any[]> {
    try {
      const response = await fetch(`${process.env.BASE_URL || 'https://telesalesside.onrender.com'}/api/dealers/recent?limit=5`);
      const result = await response.json();
      return response.ok ? (result.data || []) : [];
    } catch (error) {
      console.error('Failed to fetch recent dealers:', error);
      return [];
    }
  }
  private async fetchRecentDVRs(userId: number): Promise<any[]> {
    try {
      const response = await fetch(`${process.env.BASE_URL || 'https://telesalesside.onrender.com'}/api/dvr/recent?userId=${userId}&limit=5`);
      const result = await response.json();
      return response.ok ? (result.data || []) : [];
    } catch (error) {
      console.error('Failed to fetch recent DVRs:', error);
      return [];
    }
  }
  private async fetchRecentTVRs(userId: number): Promise<any[]> {
    try {
      const response = await fetch(`${process.env.BASE_URL || 'https://telesalesside.onrender.com'}/api/tvr/recent?userId=${userId}&limit=5`);
      const result = await response.json();
      return response.ok ? (result.data || []) : [];
    } catch (error) {
      console.error('Failed to fetch recent TVRs:', error);
      return [];
    }
  }


  async extractStructuredData(messages: ChatMessage[], userId?: number): Promise<any> {
    await this.ready;

    let contextualInfo = '';

    // ✅ FETCH RECENT ACTIVITY FOR BETTER EXTRACTION
    if (userId) {
      const [recentDealers, recentDVRs, recentTVRs] = await Promise.all([
        this.fetchRecentDealers(userId),
        this.fetchRecentDVRs(userId),
        this.fetchRecentTVRs(userId)
      ]);

      if (recentDealers.length > 0) {
        contextualInfo += `\nUSER'S RECENT DEALERS: ${recentDealers.map(d => `${d.name} (${d.location})`).join(', ')}\n`;
      }

      if (recentDVRs.length > 0) {
        contextualInfo += `\nUSER'S RECENT DVR PATTERNS: ${recentDVRs.map(d => `${d.dealerName} - ${d.visitType}`).join(', ')}\n`;
      }
    }

    const conversation = messages.map(m => `${m.role}: ${m.content}`).join('\n');

    try {
      const completion = await this.openai.chat.completions.create({
        model: "openai/gpt-oss-20b:free",
        messages: [
          {
            role: "system",
            content: `Extract structured data from this field service conversation.

${contextualInfo}

Use the recent activity above to match dealer names and validate data.

DVR: /api/dvr-manual (dealerName, subDealerName, location, dealerType, visitType, etc.)
TVR: /api/tvr (visitType, siteNameConcernedPerson, phoneNo, emailId, etc.)

Return JSON: {"endpoint": "/api/dvr-manual" or "/api/tvr", "data": {...}} or {"error": "reason"}`
          },
          {
            role: "user",
            content: conversation
          }
        ],
        max_tokens: 500,
        temperature: 0.1,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        return { error: "Failed to extract data" };
      }

      return JSON.parse(response);
    } catch (error) {
      console.error("❌ Data extraction failed:", error);
      return { error: "Failed to extract structured data" };
    }
  }
}

export default new PureRAGService();
export { PureRAGService, ChatMessage, ChatResponse };