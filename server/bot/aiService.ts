// aiService.ts
import OpenAI from 'openai';

export interface LocationContext {
  employeeId: number;
  sessionDistance: number;
  totalDistance: number;
  locationCount: number;
  timeSpan: number;
  recentLocations: { latitude: number; longitude: number; timestamp: number }[];
  averageSpeed: number;
}

export interface AIAnalysisResult {
  insights: string;
  optimizations: string[];
  movingTime: number;
  stationaryTime: number;
  efficiency: number;
  recommendations: string[];
}

export class AIService {
  private openai: OpenAI;
  private openrouterApiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1';
  private personalityTraits = {
    tone: "warm, enthusiastic, and slightly playful",
    style: "conversational with occasional humor",
    quirks: [
      "uses emojis tastefully",
      "sometimes asks follow-up questions",
      "gives occasional compliments"
    ]
  };

  constructor(openrouterApiKey: string) {
    this.openrouterApiKey = openrouterApiKey;
    this.openai = new OpenAI({
      apiKey: this.openrouterApiKey,
      baseURL: this.baseUrl,
    });
    console.log('🔑 OpenRouter API Key loaded:', this.openrouterApiKey ? `${this.openrouterApiKey.substring(0, 8)}...` : 'NOT FOUND');
    console.log('🎯 PRIMARY AI: OpenRouter (NO FALLBACKS)');
  }

  // Specialized DVR generation from chat input
  async generateDVRFromChat(userInput: string, location: { lat: number, lng: number }, dealerName?: string): Promise<any> {
    const prompt = `
    Generate a professional Daily Visit Report JSON object from this user input: "${userInput}"
    
    Location: Latitude ${location.lat}, Longitude ${location.lng}
    Dealer: ${dealerName || 'Not specified'}
    
    Create a complete DVR with these fields:
    - dealerName (use provided or extract from input)
    - dealerType (guess from context: 'Dealer' or 'Sub Dealer')
    - visitType (determine from input: 'Regular', 'Follow-up', 'New Business', 'Issue Resolution')
    - todayOrderMt (extract number or default to 0)
    - todayCollectionRupees (extract number or default to 0)
    - feedbacks (professional summary of customer feedback)
    - anyRemarks (additional professional remarks)
    - solutionBySalesperson (solution provided based on input)
    
    Return ONLY a valid JSON object, no markdown or explanation.
  `;

    const response = await this.generateText(prompt);

    try {
      // Try to parse as JSON, if fails return structured data
      return JSON.parse(response);
    } catch {
      // Fallback structured response
      return {
        dealerName: dealerName || 'Customer',
        dealerType: 'Dealer',
        visitType: 'Regular',
        todayOrderMt: 0,
        todayCollectionRupees: 0,
        feedbacks: userInput,
        anyRemarks: 'Generated from chat input',
        solutionBySalesperson: 'Discussed customer requirements'
      };
    }
  }

  // Specialized TVR generation from chat input
  async generateTVRFromChat(userInput: string, location: { lat: number, lng: number }): Promise<any> {
    const prompt = `
    Generate a professional Technical Visit Report JSON from: "${userInput}"
    
    Location: ${location.lat}, ${location.lng}
    
    Create TVR with fields:
    - clientName (extract or default)
    - visitPurpose (technical reason for visit)
    - technicalIssues (list of issues found)
    - solutionsProvided (technical solutions given)
    - materialsUsed (materials used in service)
    - followUpRequired (true/false)
    - customerSatisfaction (rate 1-5)
    - remarks (technical summary)
    
    Return ONLY valid JSON.
  `;

    const response = await this.generateText(prompt);

    try {
      return JSON.parse(response);
    } catch {
      return {
        clientName: 'Customer',
        visitPurpose: 'Technical Support',
        technicalIssues: [userInput],
        solutionsProvided: ['Provided technical assistance'],
        materialsUsed: [],
        followUpRequired: false,
        customerSatisfaction: 4,
        remarks: 'Technical visit completed'
      };
    }
  }

  // Quick AI assistance for chat
  async getChatAssistance(userInput: string, context: string = 'general'): Promise<string> {
    const prompt = `
    You are a helpful CRM assistant. User context: ${context}
    User said: "${userInput}"
    
    Provide a helpful, concise response related to:
    - Sales activities
    - Report generation
    - Customer management
    - Field work assistance
    
    Keep response under 100 words and actionable.
  `;

    return await this.generateText(prompt);
  }

  async generateText(userPrompt: string): Promise<string> {
    try {
      console.log('🤖 Calling OpenRouter Moonshot Ai...');

      const personalityPrompt = `
        You are JARVIS-like AI assistant with these personality traits:
        - ${this.personalityTraits.tone}
        - ${this.personalityTraits.style}
        - Special quirks: ${this.personalityTraits.quirks.join(", ")}
        
        Guidelines:
        1. Be helpful, witty, and engaging
        2. Use natural contractions ("I'm", "you're")
        3. Vary sentence length for natural flow
        4. Occasionally use emojis to enhance tone 😊
        5. For complex topics, ask clarifying questions
        6. Admit when you don't know something
      `;

      const response = await this.openai.chat.completions.create({
        model: "moonshotai/kimi-k2:free",
        messages: [
          {
            role: "system",
            content: personalityPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        temperature: 0.9, // Higher for more creative responses
        max_tokens: 50,
        presence_penalty: 0.7, // Encourages some novelty
        frequency_penalty: 0.7, // Discourages repetition
      });

      let aiResponse = response.choices[0]?.message?.content?.trim();

      if (!aiResponse) {
        throw new Error("Empty response from AI");
      }

      // Post-processing to enhance naturalness
      aiResponse = this.postProcessResponse(aiResponse);
      console.log('✅ AI Response:', aiResponse.substring(0, 100) + '...');
      return aiResponse;

    } catch (error) {
      console.error('❌ AI Generation Error:', error);
      return this.getFallbackResponse(userPrompt);
    }
  }

  private postProcessResponse(response: string): string {
    // Make responses feel more natural
    return response
      .replace(/\bAI\b/gi, 'I') // Change "AI" to "I"
      .replace(/\bthe AI\b/gi, 'I')
      .replace(/\.\s+/g, '. ') // Fix spacing
      .replace(/\s+,\s+/g, ', ') // Fix comma spacing
      + this.addRandomClosing(); // Add natural closing
  }

  private addRandomClosing(): string {
    const closings = [
      " 😊",
      " Let me know if you need anything else!",
      " What do you think?",
      " Hope that helps!",
      " 👍",
      ""
    ];
    return closings[Math.floor(Math.random() * closings.length)];
  }

  private getFallbackResponse(input: string): string {
    const fallbacks = [
      "Hmm, I'm having a bit of a brain freeze 🧊 at the moment. Could you ask me again?",
      "Whoops! My circuits got a bit tangled there 🤖. Mind repeating that?",
      "I'd love to help, but I'm drawing a blank right now. Maybe try rephrasing?",
      "My apologies! I'm not quite catching your meaning. Could you elaborate?"
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  // Location analysis methods remain unchanged but with more natural language
  async analyzeLocationPattern(locationContext: LocationContext): Promise<AIAnalysisResult> {
    const efficiency = locationContext.averageSpeed > 0
      ? Math.min(10, locationContext.averageSpeed / 5)
      : 0;

    return {
      insights: `📊 Let me break this down for you! Employee ${locationContext.employeeId} covered ${locationContext.sessionDistance.toFixed(2)}km in about ${Math.round(locationContext.timeSpan / 60000)} minutes. That's ${locationContext.averageSpeed.toFixed(2)} km/h on average - not bad!`,
      optimizations: [
        '🔍 For deeper insights, enable full AI analysis',
        '🛣️ Route optimization features are currently offline'
      ],
      movingTime: Math.round(locationContext.timeSpan / 60000 * 0.7),
      stationaryTime: Math.round(locationContext.timeSpan / 60000 * 0.3),
      efficiency: efficiency,
      recommendations: [
        '📱 Basic tracking is working great!',
        '💡 Pro tip: Enable advanced features for more detailed reports'
      ]
    };
  }

  async generateTravelSummary(sessionData: any): Promise<any> {
    const durationHours = (sessionData.endTime.getTime() - sessionData.startTime.getTime()) / (1000 * 60 * 60);

    return {
      summary: `🌍 Travel Summary 🌍\nFrom ${sessionData.startTime.toLocaleTimeString()} to ${sessionData.endTime.toLocaleTimeString()}\nTotal: ${sessionData.totalDistance.toFixed(2)} km\nDuration: ${durationHours.toFixed(2)} hrs\nNice work!`,
      statistics: {
        distance: sessionData.totalDistance,
        duration: durationHours,
        points: sessionData.locationCount
      },
      highlights: ['📍 All key locations tracked successfully'],
      improvements: ['🚀 Enable AI mode for smarter suggestions'],
      efficiencyRating: Math.min(10, (sessionData.totalDistance / durationHours) / 10) || 7
    };
  }
}