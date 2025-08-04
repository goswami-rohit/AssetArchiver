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
  async generateDVRFromMinimalInput(input: {
    dealerName: string,
    visitPurpose: string, // "routine visit" | "collection" | "order taking" | "complaint resolution" | "new dealer onboarding"
    visitOutcome?: string, // Optional: "good" | "average" | "poor" | brief description
    location: { lat: number, lng: number }
  }): Promise<any> {
    const messages = [
      {
        "role": "system",
        "content": "You are an expert CRM assistant who creates comprehensive Daily Visit Reports from minimal field data. You understand the cement/construction industry and generate realistic, professional DVR entries that match actual field scenarios."
      },
      {
        "role": "user",
        "content": `
Create a complete Daily Visit Report from this minimal field input:

🏪 DEALER: ${input.dealerName}
🎯 VISIT PURPOSE: ${input.visitPurpose}
${input.visitOutcome ? `📊 VISIT OUTCOME: ${input.visitOutcome}` : ''}
📍 LOCATION: ${input.location.lat}, ${input.location.lng}

GENERATE REALISTIC DVR DATA:

Based on the visit purpose "${input.visitPurpose}", intelligently determine:

1. **Visit Classification:**
   - dealerType: "Dealer" (for established businesses) or "Sub Dealer" (for smaller operations)
   - visitType: "Best" (productive visits with orders/collections) or "Non Best" (routine/maintenance visits)

2. **Business Metrics (be realistic for cement industry):**
   - dealerTotalPotential: 10-500 MT per month (based on dealer type)
   - dealerBestPotential: 60-80% of total potential
   - brandSelling: Realistic cement brands ["UltraTech", "ACC", "Ambuja", "Shree", "Birla"] (pick 2-4)

3. **Today's Business (match visit purpose):**
   - todayOrderMt: 0-50 MT (higher if purpose is "order taking")
   - todayCollectionRupees: 0-500000 (higher if purpose is "collection")

4. **Professional Content:**
   - feedbacks: Realistic dealer feedback about market, competition, demands
   - solutionBySalesperson: Professional solutions offered based on visit purpose
   - anyRemarks: Industry-relevant observations about location, competition, opportunities

5. **Contact Details (optional but professional):**
   - contactPerson: Generate realistic Indian business name if dealer seems established
   - contactPersonPhoneNo: Generate realistic Indian mobile number format

RULES:
- Match numbers to visit purpose (collection visits = higher collections, order visits = higher orders)
- Use professional cement industry language
- Make metrics realistic for the dealer size implied by name
- Generate 2-4 relevant cement brands
- Keep feedback and solutions contextually appropriate

Return ONLY this JSON (no other text):
{
  "dealerType": "Dealer" or "Sub Dealer",
  "visitType": "Best" or "Non Best",
  "dealerTotalPotential": numeric_value,
  "dealerBestPotential": numeric_value, 
  "brandSelling": ["brand1", "brand2", "brand3"],
  "contactPerson": "Name or null",
  "contactPersonPhoneNo": "+91XXXXXXXXXX or null",
  "todayOrderMt": numeric_value,
  "todayCollectionRupees": numeric_value,
  "feedbacks": "Realistic dealer feedback about market conditions, demands, or concerns",
  "solutionBySalesperson": "Professional solutions provided based on visit purpose and dealer needs", 
  "anyRemarks": "Industry-relevant observations about business potential, competition, or opportunities"
}
        `
      }
    ];

    try {
      const response = await this.callOpenRouter(messages, 0.3, 1000); // Lower temperature for consistency

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // ✅ SAFETY: Validate and clean the response
        return this.validateAndCleanDVR(parsed);
      } else {
        return JSON.parse(response);
      }
    } catch (error) {
      console.log('🔄 Using fallback for minimal DVR generation');
      return this.generateMinimalDVRFallback(input);
    }
  }

  // ✅ SAFETY: Validation and cleanup function
  private validateAndCleanDVR(data: any): any {
    return {
      dealerType: data.dealerType || "Dealer",
      visitType: data.visitType || "Non Best",
      dealerTotalPotential: Math.max(0, parseFloat(data.dealerTotalPotential) || 50),
      dealerBestPotential: Math.max(0, parseFloat(data.dealerBestPotential) || 30),
      brandSelling: Array.isArray(data.brandSelling) ? data.brandSelling.slice(0, 5) : ["UltraTech", "ACC"],
      contactPerson: data.contactPerson || null,
      contactPersonPhoneNo: data.contactPersonPhoneNo || null,
      todayOrderMt: Math.max(0, parseFloat(data.todayOrderMt) || 0),
      todayCollectionRupees: Math.max(0, parseFloat(data.todayCollectionRupees) || 0),
      feedbacks: (data.feedbacks || "Routine dealer visit completed").substring(0, 500),
      solutionBySalesperson: (data.solutionBySalesperson || "Addressed dealer queries and provided market updates").substring(0, 500),
      anyRemarks: (data.anyRemarks || "Business operating normally").substring(0, 500)
    };
  }

  // ✅ SAFETY: Fallback function
  private generateMinimalDVRFallback(input: any): any {
    const isOrderVisit = input.visitPurpose.toLowerCase().includes('order');
    const isCollectionVisit = input.visitPurpose.toLowerCase().includes('collection');

    return {
      dealerType: "Dealer",
      visitType: isOrderVisit || isCollectionVisit ? "Best" : "Non Best",
      dealerTotalPotential: 100,
      dealerBestPotential: 70,
      brandSelling: ["UltraTech", "ACC"],
      contactPerson: null,
      contactPersonPhoneNo: null,
      todayOrderMt: isOrderVisit ? 25 : 0,
      todayCollectionRupees: isCollectionVisit ? 150000 : 0,
      feedbacks: `Visit completed for ${input.visitPurpose}`,
      solutionBySalesperson: "Provided assistance as per dealer requirements",
      anyRemarks: "Standard business visit completed successfully"
    };
  }

  async generateTVRFromMinimalInput(input: {
    siteName: string,
    visitPurpose: string, // "installation" | "repair" | "maintenance" | "troubleshooting" | "inspection"
    issueOutcome?: string, // Optional: "resolved" | "pending" | "escalated" | brief description
    location?: { lat: number, lng: number }
  }): Promise<any> {
    const messages = [
      {
        "role": "system",
        "content": "You are an expert technical service specialist who creates comprehensive Technical Visit Reports from minimal field data. You understand construction equipment, cement industry technical services, and generate realistic, professional TVR entries."
      },
      {
        "role": "user",
        "content": `
Create a complete Technical Visit Report from this minimal field input:

🏗️ SITE: ${input.siteName}
🔧 VISIT PURPOSE: ${input.visitPurpose}
${input.issueOutcome ? `✅ ISSUE STATUS: ${input.issueOutcome}` : ''}

GENERATE REALISTIC TVR DATA:

Based on the visit purpose "${input.visitPurpose}", intelligently determine:

1. **Visit Classification:**
   - visitType: "Installation" (new equipment setup), "Repair" (fixing issues), or "Maintenance" (routine service)

2. **Site Contact Details (generate realistic):**
   - siteNameConcernedPerson: Site name + realistic Indian contact person name (site manager/engineer)
   - phoneNo: Generate realistic Indian mobile number format (+91XXXXXXXXXX)
   - emailId: Professional email based on site name or null for smaller sites

3. **Professional Technical Content:**
   - clientsRemarks: Realistic client feedback about service quality, technician behavior, issue resolution
   - salespersonRemarks: Technical analysis, work performed, recommendations, follow-up needs

INDUSTRY CONTEXT:
- For "installation": New equipment setup, testing, training provided
- For "repair": Problem diagnosis, parts replaced, system restored
- For "maintenance": Routine checks, preventive measures, optimization

RULES:
- Use technical yet customer-friendly language
- Match content to visit purpose (installation = training, repair = problem-solving, maintenance = prevention)
- Generate realistic Indian business contact details
- Keep remarks professional and solution-oriented
- Include follow-up recommendations when appropriate

Return ONLY this JSON (no other text):
{
  "visitType": "Installation" or "Repair" or "Maintenance",
  "siteNameConcernedPerson": "Site Name - Contact Person Name (designation)",
  "phoneNo": "+91XXXXXXXXXX",
  "emailId": "professional@email.com or null",
  "clientsRemarks": "Customer feedback about service quality, technician performance, and satisfaction level",
  "salespersonRemarks": "Technical work summary, solutions provided, recommendations, and follow-up requirements"
}
        `
      }
    ];

    try {
      const response = await this.callOpenRouter(messages, 0.3, 800); // Lower temperature for consistency

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // ✅ SAFETY: Validate and clean the response
        return this.validateAndCleanTVR(parsed);
      } else {
        return JSON.parse(response);
      }
    } catch (error) {
      console.log('🔄 Using fallback for minimal TVR generation');
      return this.generateMinimalTVRFallback(input);
    }
  }

  // ✅ SAFETY: Validation and cleanup function
  private validateAndCleanTVR(data: any): any {
    // Determine visit type from purpose if not set correctly
    let visitType = data.visitType || "Maintenance";

    return {
      visitType: visitType,
      siteNameConcernedPerson: (data.siteNameConcernedPerson || "Site Contact").substring(0, 255),
      phoneNo: this.validatePhoneNumber(data.phoneNo) || "+919876543210",
      emailId: this.validateEmail(data.emailId) || null,
      clientsRemarks: (data.clientsRemarks || "Service completed satisfactorily").substring(0, 500),
      salespersonRemarks: (data.salespersonRemarks || "Technical service completed as per requirements").substring(0, 500)
    };
  }

  // ✅ SAFETY: Phone number validation
  private validatePhoneNumber(phone: string): string | null {
    if (!phone) return null;

    // Clean and format Indian mobile number
    const cleaned = phone.replace(/[^\d]/g, '');
    if (cleaned.length === 10) {
      return `+91${cleaned}`;
    } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
      return `+${cleaned}`;
    }
    return phone.substring(0, 20); // Fallback to original if valid format
  }

  // ✅ SAFETY: Email validation
  private validateEmail(email: string): string | null {
    if (!email) return null;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(email) && email.length <= 255) {
      return email;
    }
    return null;
  }

  // ✅ SAFETY: Fallback function
  private generateMinimalTVRFallback(input: any): any {
    const purpose = input.visitPurpose.toLowerCase();

    let visitType = "Maintenance";
    let clientRemarks = "Service completed satisfactorily";
    let salesRemarks = "Routine technical service completed";

    if (purpose.includes('install')) {
      visitType = "Installation";
      clientRemarks = "New installation completed successfully";
      salesRemarks = "Equipment installed, tested, and user training provided";
    } else if (purpose.includes('repair') || purpose.includes('fix') || purpose.includes('troubleshoot')) {
      visitType = "Repair";
      clientRemarks = "Issue resolved, system working properly";
      salesRemarks = "Problem diagnosed and resolved, system restored to normal operation";
    }

    return {
      visitType: visitType,
      siteNameConcernedPerson: `${input.siteName} - Site Manager`,
      phoneNo: "+919876543210",
      emailId: null,
      clientsRemarks: clientRemarks,
      salespersonRemarks: salesRemarks
    };
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