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

export // ===== PROPERLY CONFIGURED AI SERVICES FOR OPENROUTER =====

class AIService {
  private openrouterApiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1';
  private siteUrl: string;
  private siteTitle: string;

  constructor(openrouterApiKey: string, siteUrl?: string, siteTitle?: string) {
    this.openrouterApiKey = openrouterApiKey;
    this.siteUrl = siteUrl || 'https://telesalesside.onrender.com/pwa';
    this.siteTitle = siteTitle || 'CRM Assistant';
    
    console.log('🔑 OpenRouter API Key configured:', this.openrouterApiKey ? `${this.openrouterApiKey.substring(0, 8)}...` : 'NOT FOUND');
    console.log('🎯 Using OpenRouter Direct API');
  }

  // 🤖 CORE OPENROUTER API CALL (Direct Fetch)
  private async callOpenRouter(messages: any[], temperature: number = 0.7, maxTokens: number = 1000): Promise<string> {
    try {
      console.log('🤖 Calling OpenRouter API...');

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.openrouterApiKey}`,
          "HTTP-Referer": this.siteUrl, // For rankings on openrouter.ai
          "X-Title": this.siteTitle, // For rankings on openrouter.ai
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          "model": "moonshotai/kimi-k2:free", // Free model
          "messages": messages,
          "temperature": temperature,
          "max_tokens": maxTokens,
          "presence_penalty": 0.1,
          "frequency_penalty": 0.1
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content?.trim();

      if (!aiResponse) {
        throw new Error("Empty response from OpenRouter");
      }

      console.log('✅ OpenRouter Response received');
      return aiResponse;

    } catch (error) {
      console.error('❌ OpenRouter API Error:', error);
      throw error;
    }
  }

  // 🏢 COMPETITION REPORT GENERATION (Schema-Compliant)
  async generateCompetitionAnalysis(input: {
    brandName: string,
    competitorInfo: string,
    marketObservation: string,
    reportDate: string
  }): Promise<any> {
    const messages = [
      {
        "role": "system",
        "content": `You are a market intelligence analyst for a CRM system. Generate accurate, professional competition reports based on field observations.`
      },
      {
        "role": "user",
        "content": `
Generate a comprehensive competition report based on:

Brand: ${input.brandName}
Competitor Information: ${input.competitorInfo}
Market Observation: ${input.marketObservation}
Date: ${input.reportDate}

Create EXACT schema-compliant data for competition_reports table:

Required Fields (exact format):
- billing: varchar(100) - Estimate billing/revenue (e.g., "5-10 lakhs monthly", "2-3 cr annually")
- nod: varchar(100) - Number of dealers estimate (e.g., "50-75 dealers", "100+ dealers")  
- retail: varchar(100) - Retail presence assessment (e.g., "Strong retail network", "Limited presence")
- schemesYesNo: "Yes" or "No" ONLY
- avgSchemeCost: decimal(10,2) - Average scheme cost in rupees (e.g., 5000.00, 0.00)
- remarks: varchar(500) - Professional analysis summary

Return ONLY this JSON structure:
{
  "billing": "estimated billing range",
  "nod": "dealer count estimate", 
  "retail": "retail presence assessment",
  "hasSchemes": "Yes" or "No",
  "avgSchemeCost": "numeric value",
  "remarks": "comprehensive market analysis based on observations"
}

Make it professional, data-driven, and actionable for sales strategy.
        `
      }
    ];

    try {
      const response = await this.callOpenRouter(messages, 0.3, 800);
      
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        return JSON.parse(response);
      }
    } catch (error) {
      console.log('🔄 Using fallback for competition analysis');
      return this.generateCompetitionFallback(input);
    }
  }

  // 📊 DVR GENERATION (Daily Visit Reports - Schema-Compliant)
  async generateDVRFromInput(input: {
    dealerName: string,
    visitContext: string,
    customerInteraction: string,
    location: { lat: number, lng: number },
    dealerType?: string
  }): Promise<any> {
    const messages = [
      {
        "role": "system",
        "content": "You are a CRM assistant specializing in Daily Visit Reports. Generate accurate, professional DVR data from field visit information."
      },
      {
        "role": "user",
        "content": `
Generate a professional Daily Visit Report from this field visit:

Dealer: ${input.dealerName}
Visit Context: ${input.visitContext}
Customer Interaction: ${input.customerInteraction}
Location: ${input.location.lat}, ${input.location.lng}

Create schema-compliant DVR data for daily_visit_reports table:

Required Analysis:
- dealerType: "Dealer" or "Sub Dealer" (determine from context)
- visitType: "Best" or "Non Best" (assess visit quality)
- dealerTotalPotential: decimal(10,2) - Estimate total potential
- dealerBestPotential: decimal(10,2) - Estimate best potential  
- brandSelling: text array - Extract/estimate brands sold
- todayOrderMt: decimal(10,2) - Extract order quantity in MT
- todayCollectionRupees: decimal(10,2) - Extract collection amount
- feedbacks: varchar(500) - Customer feedback summary
- solutionBySalesperson: varchar(500) - Solutions provided
- anyRemarks: varchar(500) - Additional professional remarks

Return ONLY this JSON:
{
  "dealerType": "Dealer" or "Sub Dealer",
  "visitType": "Best" or "Non Best", 
  "dealerTotalPotential": numeric_value,
  "dealerBestPotential": numeric_value,
  "brandSelling": ["brand1", "brand2"],
  "todayOrderMt": numeric_value,
  "todayCollectionRupees": numeric_value,
  "feedbacks": "customer feedback summary",
  "solutionBySalesperson": "solutions provided to customer",
  "anyRemarks": "additional professional observations"
}

Extract actual numbers from context, use professional language.
        `
      }
    ];

    try {
      const response = await this.callOpenRouter(messages, 0.4, 800);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        return JSON.parse(response);
      }
    } catch (error) {
      console.log('🔄 Using fallback for DVR generation');
      return this.generateDVRFallback(input);
    }
  }

  // 🔧 TVR GENERATION (Technical Visit Reports - Schema-Compliant)
  async generateTVRFromInput(input: {
    siteName: string,
    technicalIssue: string,
    serviceProvided: string,
    customerFeedback: string,
    visitType?: string
  }): Promise<any> {
    const messages = [
      {
        "role": "system",
        "content": "You are a technical service analyst for CRM. Generate professional Technical Visit Reports from service call information."
      },
      {
        "role": "user",
        "content": `
Generate a Technical Visit Report from this service call:

Site: ${input.siteName}
Technical Issue: ${input.technicalIssue}
Service Provided: ${input.serviceProvided}
Customer Feedback: ${input.customerFeedback}

Create schema-compliant TVR for technical_visit_reports table:

Required Fields:
- visitType: "Installation", "Repair", or "Maintenance" (determine from context)
- siteNameConcernedPerson: varchar(255) - Site name and contact person
- phoneNo: varchar(20) - Extract/estimate phone number format
- emailId: varchar(255) - Generate professional email if not provided
- clientsRemarks: varchar(500) - Customer's feedback and remarks
- salespersonRemarks: varchar(500) - Technical person's professional remarks

Return ONLY this JSON:
{
  "visitType": "Installation|Repair|Maintenance",
  "siteNameConcernedPerson": "site name and contact person details",
  "phoneNo": "phone number format",
  "emailId": "professional email or null",
  "clientsRemarks": "customer feedback and satisfaction remarks",
  "salespersonRemarks": "technical analysis and service summary"
}

Make it technical yet customer-focused.
        `
      }
    ];

    try {
      const response = await this.callOpenRouter(messages, 0.3, 600);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        return JSON.parse(response);
      }
    } catch (error) {
      console.log('🔄 Using fallback for TVR generation');
      return this.generateTVRFallback(input);
    }
  }

  // 🎯 SMART REPORT SUGGESTIONS
  async suggestReportType(userInput: string): Promise<{
    reportType: 'DVR' | 'TVR' | 'Competition' | 'Journey',
    confidence: number,
    reasoning: string,
    suggestedFields: string[]
  }> {
    const messages = [
      {
        "role": "system",
        "content": "You are a CRM assistant that analyzes user input to suggest the most appropriate report type."
      },
      {
        "role": "user",
        "content": `
Analyze this user input and suggest the most appropriate report type:

User Input: "${userInput}"

Available Report Types:
1. DVR (Daily Visit Report) - Customer visits, sales interactions, orders
2. TVR (Technical Visit Report) - Technical support, installations, repairs  
3. Competition (Competition Report) - Competitor analysis, market intelligence
4. Journey (Journey Planning) - Route planning, dealer visits

Return ONLY this JSON:
{
  "reportType": "DVR|TVR|Competition|Journey",
  "confidence": 0-100,
  "reasoning": "why this report type fits",
  "suggestedFields": ["field1", "field2", "field3"]
}
        `
      }
    ];

    try {
      const response = await this.callOpenRouter(messages, 0.2, 400);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        return JSON.parse(response);
      }
    } catch (error) {
      return this.analyzeReportTypeFallback(userInput);
    }
  }

  // 💡 CONTEXTUAL CRM ASSISTANCE
  async getCRMGuidance(context: {
    currentActivity: string,
    userQuestion: string,
    location?: { lat: number, lng: number },
    timeOfDay?: string
  }): Promise<string> {
    const messages = [
      {
        "role": "system", 
        "content": "You are a helpful CRM field assistant. Provide concise, actionable advice for sales team members."
      },
      {
        "role": "user",
        "content": `
Provide helpful guidance for this situation:

Current Activity: ${context.currentActivity}
User Question: ${context.userQuestion}
Location: ${context.location ? `${context.location.lat}, ${context.location.lng}` : 'Unknown'}
Time: ${context.timeOfDay || 'Not specified'}

Provide concise, actionable advice for:
- Field sales activities
- Report generation
- Customer relationship management
- Dealer/client interactions
- Journey planning

Keep response under 150 words, professional yet friendly.
        `
      }
    ];

    try {
      return await this.callOpenRouter(messages, 0.7, 200);
    } catch (error) {
      return this.getCRMFallbackAdvice(context.userQuestion);
    }
  }

  // 🚀 GENERAL AI CHAT (For backward compatibility)
  async generateText(userPrompt: string): Promise<string> {
    const messages = [
      {
        "role": "system",
        "content": "You are a helpful, professional CRM assistant with a warm, engaging personality."
      },
      {
        "role": "user",
        "content": userPrompt
      }
    ];

    try {
      return await this.callOpenRouter(messages, 0.8, 500);
    } catch (error) {
      return this.getFallbackResponse(userPrompt);
    }
  }

  // FALLBACK METHODS (Same as before)
  private generateCompetitionFallback(input: any) {
    const info = input.competitorInfo.toLowerCase();
    const hasLargePresence = info.includes('large') || info.includes('major') || info.includes('big');
    const hasSchemes = info.includes('scheme') || info.includes('discount') || info.includes('offer');
    
    return {
      billing: hasLargePresence ? "10-15 lakhs monthly" : "3-8 lakhs monthly",
      nod: hasLargePresence ? "75-100 dealers" : "25-50 dealers",
      retail: hasLargePresence ? "Strong retail network" : "Moderate retail presence",
      hasSchemes: hasSchemes ? "Yes" : "No",
      avgSchemeCost: hasSchemes ? "7500.00" : "0.00",
      remarks: `Market analysis based on field observations: ${input.competitorInfo.substring(0, 200)}...`
    };
  }

  private generateDVRFallback(input: any) {
    return {
      dealerType: input.dealerType || "Dealer",
      visitType: "Best",
      dealerTotalPotential: 50000.00,
      dealerBestPotential: 30000.00,
      brandSelling: ["Brand A", "Brand B"],
      todayOrderMt: 0.00,
      todayCollectionRupees: 0.00,
      feedbacks: input.customerInteraction || "Customer interaction completed",
      solutionBySalesperson: "Addressed customer requirements",
      anyRemarks: input.visitContext || "Regular dealer visit completed"
    };
  }

  private generateTVRFallback(input: any) {
    return {
      visitType: "Repair",
      siteNameConcernedPerson: input.siteName || "Customer Site",
      phoneNo: "Not provided",
      emailId: null,
      clientsRemarks: input.customerFeedback || "Service completed satisfactorily",
      salespersonRemarks: input.serviceProvided || "Technical issue resolved"
    };
  }

  private analyzeReportTypeFallback(userInput: string): any {
    const input = userInput.toLowerCase();
    
    if (input.includes('visit') || input.includes('customer') || input.includes('dealer')) {
      return {
        reportType: 'DVR',
        confidence: 80,
        reasoning: 'Contains customer/dealer visit keywords',
        suggestedFields: ['dealerName', 'visitType', 'feedbacks', 'todayOrderMt']
      };
    } else if (input.includes('technical') || input.includes('repair') || input.includes('install')) {
      return {
        reportType: 'TVR',
        confidence: 85,
        reasoning: 'Contains technical service keywords',
        suggestedFields: ['visitType', 'technicalIssue', 'serviceProvided']
      };
    } else if (input.includes('competitor') || input.includes('market') || input.includes('brand')) {
      return {
        reportType: 'Competition',
        confidence: 90,
        reasoning: 'Contains market/competitor analysis keywords',
        suggestedFields: ['brandName', 'billing', 'schemes']
      };
    } else {
      return {
        reportType: 'DVR',
        confidence: 60,
        reasoning: 'Default to customer visit report',
        suggestedFields: ['dealerName', 'location', 'visitType']
      };
    }
  }

  private getCRMFallbackAdvice(question: string): string {
    const responses = [
      "For effective field visits, ensure you document all customer interactions and follow up promptly.",
      "Remember to update your location and check-in/out times for accurate journey tracking.",
      "Focus on building strong dealer relationships and gathering competitive intelligence during visits.",
      "Make sure to complete your daily reports while the visit details are fresh in your memory."
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private getFallbackResponse(input: string): string {
    const fallbacks = [
      "I'm here to help with your CRM tasks! Could you try rephrasing your question?",
      "Let me assist you with field sales, reports, or customer management. What do you need?",
      "I'm your CRM assistant - ready to help with visits, reports, or dealer management!",
      "Having trouble processing that. Could you ask about DVR, TVR, competition reports, or journeys?"
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

export default AIService;