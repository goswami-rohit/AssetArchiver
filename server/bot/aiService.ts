import axios from 'axios';

interface OpenRouterResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

interface DealerData {
  userId: number;
  type: string;
  parentDealerId?: string;
  name: string;
  region: string;
  area: string;
  phoneNo: string;
  address: string;
  totalPotential: string;
  bestPotential: string;
  brandSelling: string[];
  feedbacks: string;
  remarks?: string;
  latitude: string;
  longitude: string;
}

interface DVRData {
  reportDate: string;
  dealerType: string;
  dealerName?: string;
  subDealerName?: string;
  location: string;
  visitType: string;
  dealerTotalPotential: number;
  dealerBestPotential: number;
  brandSelling: string[];
  contactPerson?: string;
  contactPersonPhoneNo?: string;
  todayOrderMt: number;
  todayCollectionRupees: number;
  feedbacks: string;
  solutionBySalesperson?: string;
  anyRemarks?: string;
  checkInTime?: string;
  checkOutTime?: string;
  inTimeImageUrl?: string;
  outTimeImageUrl?: string;
}

class AIService {
  private openRouterApiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1/chat/completions';

  constructor() {
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY!;
    if (!this.openRouterApiKey) {
      throw new Error('OPENROUTER_API_KEY is required');
    }
  }

  private async makeOpenRouterRequest(prompt: string, systemMessage: string = ''): Promise<string> {
    try {
      const response = await axios.post<OpenRouterResponse>(
        this.baseUrl,
        {
          model: 'z-ai/glm-4.5-air:free', // ✅ Updated to free model
          messages: [
            {
              role: 'system',
              content: systemMessage || 'You are a helpful AI assistant specialized in field service management and data parsing.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.3
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openRouterApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.NGROK_URL || 'http://localhost:8000',
            'X-Title': 'Field Service Management System'
          }
        }
      );

      return this.sanitizeResponse(response.data.choices[0]?.message?.content || '');
    } catch (error) {
      console.error('OpenRouter API Error:', error);
      throw new Error('Failed to process AI request');
    }
  }

  /**
   * Parse new dealer information from guided prompts
   * Used when no dealer exists at exact GPS coordinates
   */
  async parseNewDealerFromGuidedPrompts(
    guidedPromptResponses: Record<string, string>,
    latitude: string,
    longitude: string,
    userId: number
  ): Promise<DealerData> {
    const systemMessage = `You are a data parsing expert for field service management. 
    Parse the provided natural language guided prompt responses into structured dealer data matching the exact schema requirements.
    ONLY PARSE the information provided - do not generate or invent any data.
    Return ONLY a valid JSON object with the exact structure requested.`;

    const prompt = `
    Parse the following natural language guided prompt responses into a structured dealer object:

    Guided Responses:
    ${Object.entries(guidedPromptResponses).map(([key, value]) => `${key}: ${value}`).join('\n')}

    GPS Coordinates:
    Latitude: ${latitude}
    Longitude: ${longitude}
    User ID: ${userId}

    Extract and return a JSON object with this EXACT structure matching the database schema:
    {
      "userId": ${userId},
      "type": "string", // MUST be exactly "Dealer" or "Sub Dealer"
      "parentDealerId": "string or null",
      "name": "string", // max 255 chars
      "region": "string", // max 100 chars  
      "area": "string", // max 255 chars
      "phoneNo": "string", // max 20 chars
      "address": "string", // max 500 chars
      "totalPotential": "decimal string", // format: "0.00"
      "bestPotential": "decimal string", // format: "0.00"
      "brandSelling": ["array", "of", "strings"], // brands they sell
      "feedbacks": "string", // max 500 chars
      "remarks": "string or null", // optional, max 500 chars
      "latitude": "${latitude}",
      "longitude": "${longitude}"
    }

    PARSING RULES:
    - Extract dealer name from responses
    - Determine if "Dealer" or "Sub Dealer" from context
    - Parse region/area from location descriptions
    - Extract phone number in any format mentioned
    - Parse address from location descriptions
    - Extract potential values (convert to decimal format)
    - Identify brands mentioned as array
    - Extract any feedback/comments for feedbacks field
    - Use null for optional fields if not mentioned
    - ONLY parse what's actually provided in the responses
    `;

    try {
      const response = await this.makeOpenRouterRequest(prompt, systemMessage);

      const cleanedResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      const parsedData = JSON.parse(cleanedResponse);

      // Validate required fields are parsed
      const requiredFields = ['name', 'type', 'region', 'area', 'phoneNo', 'address', 'totalPotential', 'bestPotential', 'brandSelling', 'feedbacks'];

      for (const field of requiredFields) {
        if (!parsedData[field]) {
          throw new Error(`Failed to parse required field: ${field}`);
        }
      }

      // Validate type is exactly correct
      if (!['Dealer', 'Sub Dealer'].includes(parsedData.type)) {
        throw new Error('Type must be exactly "Dealer" or "Sub Dealer"');
      }

      // Validate brandSelling is array
      if (!Array.isArray(parsedData.brandSelling)) {
        throw new Error('brandSelling must be an array');
      }

      return {
        userId: userId,
        type: parsedData.type,
        parentDealerId: parsedData.parentDealerId || undefined,
        name: parsedData.name,
        region: parsedData.region,
        area: parsedData.area,
        phoneNo: parsedData.phoneNo,
        address: parsedData.address,
        totalPotential: parsedData.totalPotential,
        bestPotential: parsedData.bestPotential,
        brandSelling: parsedData.brandSelling,
        feedbacks: parsedData.feedbacks,
        remarks: parsedData.remarks || undefined,
        latitude: latitude,
        longitude: longitude
      };
    } catch (error) {
      console.error('Error parsing dealer data from guided prompts:', error);
      throw new Error('Failed to parse dealer information from natural language responses');
    }
  }

  /**
   * Generate DVR content from prompt with dealer and location context
   * ✅ FIXED: Now uses OpenRouter consistently
   */
  async generateDVRFromPromptWithContext(prompt: string, dealerInfo: any, context: any): Promise<DVRData> {
    const systemMessage = `Parse field visit information and return structured JSON data matching the exact database schema.`;

    const fullPrompt = `Parse this field visit information and return JSON with EXACT schema fields:

${prompt}

Dealer: ${dealerInfo.name}
Context: Location ${context.latitude}, ${context.longitude}, Time ${context.timestamp}

Return JSON with EXACTLY these field names (match schema exactly):
{
  "reportDate": "YYYY-MM-DD format",
  "dealerType": "Dealer or Sub Dealer",
  "dealerName": "string or null",
  "subDealerName": "string or null",
  "location": "string description",
  "visitType": "Best or Non Best",
  "dealerTotalPotential": number,
  "dealerBestPotential": number,
  "brandSelling": ["array", "of", "brands"],
  "contactPerson": "string or null",
  "contactPersonPhoneNo": "string or null",
  "todayOrderMt": number,
  "todayCollectionRupees": number,
  "feedbacks": "string feedback from visit",
  "solutionBySalesperson": "string or null",
  "anyRemarks": "string or null",
  "checkInTime": "ISO timestamp",
  "checkOutTime": "ISO timestamp or null",
  "inTimeImageUrl": "string or null",
  "outTimeImageUrl": "string or null"
}

CRITICAL: Use exact field names shown above. No other field names allowed.`;

    try {
      // ✅ Use consistent OpenRouter API
      const response = await this.makeOpenRouterRequest(fullPrompt, systemMessage);

      const cleanedResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      const result = JSON.parse(cleanedResponse);

      // Set defaults for required fields if missing
      if (!result.reportDate) result.reportDate = new Date().toISOString().split('T')[0];
      if (!result.dealerType) result.dealerType = "Dealer";
      if (!result.location) result.location = `${context.latitude}, ${context.longitude}`;
      if (!result.visitType) result.visitType = "Best";
      if (!result.dealerTotalPotential) result.dealerTotalPotential = 0;
      if (!result.dealerBestPotential) result.dealerBestPotential = 0;
      if (!result.brandSelling) result.brandSelling = [];
      if (!result.todayOrderMt) result.todayOrderMt = 0;
      if (!result.todayCollectionRupees) result.todayCollectionRupees = 0;
      if (!result.feedbacks) result.feedbacks = "No specific feedback provided";
      if (!result.checkInTime) result.checkInTime = new Date().toISOString(); // ✅ Fixed timestamp format

      return result;
    } catch (error) {
      console.error('AI DVR generation error:', error);
      throw new Error('Failed to parse DVR information from prompt');
    }
  }

  /**
   * Generate TVR (Territory Visit Report) analysis
   */
  async generateTVRFromPrompt(prompt: string, territoryData: any): Promise<string> {
    const systemMessage = `You are a territory analysis expert. Generate professional TVR content based on the provided prompt and territory data.`;

    const fullPrompt = `
    Generate a Territory Visit Report based on:
    
    User Input: "${prompt}"
    Territory Data: ${JSON.stringify(territoryData, null, 2)}
    
    Provide a comprehensive analysis including:
    - Territory overview
    - Key findings
    - Market opportunities
    - Challenges identified
    - Recommendations
    - Next steps
    
    Format the response professionally for a business report.
    `;

    try {
      return await this.makeOpenRouterRequest(fullPrompt, systemMessage);
    } catch (error) {
      console.error('Error generating TVR:', error);
      throw new Error('Failed to generate TVR');
    }
  }

  /**
   * Analyze competition report data
   */
  async analyzeCompetitionReport(reportData: any, analysisType: string): Promise<string> {
    const systemMessage = `You are a competitive intelligence analyst. Provide insightful analysis of competition data for field service teams.`;

    const prompt = `
    Analyze the following competition report data:
    
    Report Data: ${JSON.stringify(reportData, null, 2)}
    Analysis Type: ${analysisType}
    
    Provide detailed analysis including:
    - Competitive landscape overview
    - Key competitor strengths and weaknesses
    - Market positioning insights
    - Threat assessment
    - Strategic recommendations
    - Action items for field team
    
    Make the analysis actionable for field service representatives.
    `;

    try {
      return await this.makeOpenRouterRequest(prompt, systemMessage);
    } catch (error) {
      console.error('Error analyzing competition report:', error);
      throw new Error('Failed to analyze competition report');
    }
  }

  /**
   * Generate intelligent suggestions for field operations
   */
  async generateFieldSuggestions(
    fieldData: any,
    context: string
  ): Promise<string[]> {
    const systemMessage = `You are a field operations optimization expert. Generate practical, actionable suggestions for field service teams.`;

    const prompt = `
    Based on the following field data and context, generate 5-7 practical suggestions:
    
    Field Data: ${JSON.stringify(fieldData, null, 2)}
    Context: ${context}
    
    Provide suggestions that are:
    - Specific and actionable
    - Relevant to field service operations
    - Focused on improving efficiency and results
    - Realistic to implement
    
    Return only an array of suggestion strings.
    `;

    try {
      const response = await this.makeOpenRouterRequest(prompt, systemMessage);

      // Try to parse as JSON array, fallback to splitting by lines
      try {
        const parsed = JSON.parse(response);
        return Array.isArray(parsed) ? parsed : [response];
      } catch {
        return response.split('\n').filter(line => line.trim().length > 0);
      }
    } catch (error) {
      console.error('Error generating field suggestions:', error);
      throw new Error('Failed to generate field suggestions');
    }
  }

  /**
   * Validate and sanitize AI responses
   */
  private sanitizeResponse(response: string): string {
    return response
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .replace(/[<>]/g, '') // Remove potential HTML/XML characters
      .trim();
  }

  /**
   * Health check for AI service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.makeOpenRouterRequest(
        'Respond with "OK" if you can process this request.',
        'You are a health check assistant.'
      );
      return response.toLowerCase().includes('ok');
    } catch (error) {
      console.error('AI Service health check failed:', error);
      return false;
    }
  }
}

export default new AIService();
export { AIService, DealerData, DVRData };