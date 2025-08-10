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

  async chat(messages: ChatMessage[]): Promise<string> {
    await this.ready; // ✅ Ensure RAG context is loaded

    console.log("💬 Chat request received");
    console.log("RAG Context length:", this.endpointContext.length);

    const ragMessages = [
      {
        role: "system" as const,
        content: `You are a helpful field service assistant with access to API endpoint information. 

${this.endpointContext}

INSTRUCTIONS:
- Help users with field service tasks naturally like ChatGPT
- When users describe work activities, understand which endpoint they need
- Guide them to provide the required information conversationally
- Extract data from their natural language and structure it properly
- Be conversational, helpful, and smart about business context
- When you have enough information, offer to submit the data to the appropriate endpoint

NO ARTIFICIAL CONVERSATION FLOWS. Just be natural and helpful like ChatGPT.`,
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

      console.log("✅ OpenRouter response received");
      return (
        completion.choices[0]?.message?.content ||
        "I'm having trouble processing that. Could you try again?"
      );
    } catch (error) {
      console.error("❌ OpenRouter request failed:", error);
      throw new Error("Failed to process chat message");
    }
  }
}

export default new PureRAGService();
export { PureRAGService, ChatMessage, ChatResponse };
