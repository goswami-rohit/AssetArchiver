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

  constructor() {
    // Your OpenRouter setup
    this.openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY!,
      defaultHeaders: {
        "HTTP-Referer": process.env.NGROK_URL || "http://localhost:8000",
        "X-Title": "Field Service RAG Assistant",
      },
    });

    // Your Qdrant setup from the images
    this.qdrant = new QdrantClient({
      url: "https://159aa838-50db-435a-b6d7-46b432c554ba.eu-west-1-0.aws.cloud.qdrant.io:6333",
      apiKey: process.env.QDRANT_API_KEY!, // From your .env
    });

    // Load RAG context on startup
    this.loadRAGContext();
  }

  /**
   * Load ALL endpoint data from Qdrant for RAG context
   */
  private async loadRAGContext() {
    try {
      // Get ALL points from your "api_endpoints" collection
      const response = await this.qdrant.scroll("api_endpoints", {
        limit: 100,
        with_payload: true,
        with_vector: false // We don't need vectors, just the metadata
      });

      const endpoints = response.points.map(point => point.payload);
      
      // Create rich RAG context string
      this.endpointContext = `
AVAILABLE API ENDPOINTS:

${endpoints.map(endpoint => `
ENDPOINT: ${endpoint.name}
URL: ${endpoint.endpoint} (${endpoint.method})
DESCRIPTION: ${endpoint.description}
FIELDS: ${JSON.stringify(endpoint.fields)}
REQUIRED FIELDS: ${JSON.stringify(endpoint.requiredFields)}
SEARCH TERMS: ${endpoint.searchTerms}
---`).join('\n')}
`;

      console.log('✅ RAG Context Loaded from Qdrant');
      
    } catch (error) {
      console.error('❌ Failed to load RAG context from Qdrant:', error);
      throw new Error('Could not connect to Qdrant vector database');
    }
  }

  /**
   * PURE ChatGPT-like conversation with RAG
   */
  async chat(messages: ChatMessage[]): Promise<string> {
    try {
      // Create the RAG-enhanced messages
      const ragMessages = [
        {
          role: 'system' as const,
          content: `You are a helpful field service assistant with access to API endpoint information. 

${this.endpointContext}

INSTRUCTIONS:
- Help users with field service tasks naturally like ChatGPT
- When users describe work activities, understand which endpoint they need
- Guide them to provide the required information conversationally
- Extract data from their natural language and structure it properly
- Be conversational, helpful, and smart about business context
- When you have enough information, offer to submit the data to the appropriate endpoint

NO ARTIFICIAL CONVERSATION FLOWS. Just be natural and helpful like ChatGPT.`
        },
        ...messages
      ];

      const completion = await this.openai.chat.completions.create({
        model: "openai/gpt-oss-20b:free",
        messages: ragMessages,
        max_tokens: 1000,
        temperature: 0.7 // Slightly higher for more natural responses
      });

      return completion.choices[0]?.message?.content || "I'm having trouble processing that. Could you try again?";

    } catch (error) {
      console.error('Chat error:', error);
      throw new Error('Failed to process chat message');
    }
  }

  /**
   * Extract structured data when user is ready to submit
   */
  async extractStructuredData(conversationMessages: ChatMessage[]): Promise<{endpoint: string, data: any} | null> {
    try {
      const extractionPrompt = {
        role: 'user' as const,
        content: `Based on our conversation, extract the structured data for API submission. 

Analyze the conversation and determine:
1. Which endpoint should be used
2. What data has been collected
3. Structure it properly for the API

Return ONLY a JSON object in this format:
{
  "endpoint": "/api/endpoint-name",
  "data": {
    // structured data object
  }
}

If there's not enough information, return: {"error": "insufficient_data"}`
      };

      const ragMessages = [
        {
          role: 'system' as const,
          content: `Extract structured data from field service conversations.

${this.endpointContext}

You are a data extraction expert. Analyze the conversation and create properly structured API data.`
        },
        ...conversationMessages,
        extractionPrompt
      ];

      const completion = await this.openai.chat.completions.create({
        model: "openai/gpt-oss-20b:free",
        messages: ragMessages,
        max_tokens: 800,
        temperature: 0.1 // Low temperature for precise data extraction
      });

      const response = completion.choices[0]?.message?.content || '';
      
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0]);
        if (extracted.error) {
          return null;
        }
        return extracted;
      }

      return null;

    } catch (error) {
      console.error('Data extraction error:', error);
      return null;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test OpenRouter
      const completion = await this.openai.chat.completions.create({
        model: "openai/gpt-oss-20b:free",
        messages: [{ role: "user", content: "Say OK" }],
        max_tokens: 5
      });

      // Test Qdrant
      await this.qdrant.getCollectionInfo("api_endpoints");

      return completion.choices[0]?.message?.content?.toLowerCase().includes('ok') || false;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  /**
   * Get available endpoints info
   */
  getEndpointsInfo(): string {
    return this.endpointContext;
  }
}

export default new PureRAGService();
export { PureRAGService, ChatMessage, ChatResponse };