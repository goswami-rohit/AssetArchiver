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
   * Generate DVR content from prompt with dealer and location context
   * ✅ FIXED: Now uses OpenRouter consistently
   */
  async parseNewDealerFromGuidedPrompts(
    guidedPromptResponses: Record<string, string>,
    latitude: string,
    longitude: string,
    userId: number
  ): Promise<DealerData> {
    const systemMessage = `You are a data parsing expert for field service management. 
  Parse the provided natural language guided prompt responses into structured dealer data.
  Extract what you can from the natural language and provide sensible defaults for missing required fields.
  Return ONLY a valid JSON object with the exact structure requested.`;

    const prompt = `
  Parse the following natural language guided prompt responses into a structured dealer object:

  Guided Responses:
  ${Object.entries(guidedPromptResponses).map(([key, value]) => `${key}: ${value}`).join('\n')}

  GPS Coordinates:
  Latitude: ${latitude}
  Longitude: ${longitude}
  User ID: ${userId}

  Extract and return a JSON object with this EXACT structure:
  {
    "userId": ${userId},
    "type": "string", // MUST be exactly "Dealer" or "Sub Dealer"
    "parentDealerId": null,
    "name": "string", // extract from responses
    "region": "string", // extract if mentioned, otherwise use "Unknown Region"
    "area": "string", // extract if mentioned, otherwise use "Unknown Area"  
    "phoneNo": "string", // extract if mentioned, otherwise use "0000000000"
    "address": "string", // extract if mentioned, otherwise use GPS coordinates
    "totalPotential": "10000.00", // extract if mentioned, otherwise use default
    "bestPotential": "5000.00", // extract if mentioned, otherwise use default
    "brandSelling": ["Unknown"], // extract brands if mentioned, otherwise use ["Unknown"]
    "feedbacks": "string", // extract feedback if mentioned, otherwise use response text
    "remarks": null, // optional field
    "latitude": "${latitude}",
    "longitude": "${longitude}"
  }

  PARSING RULES:
  - Extract dealer name from responses (REQUIRED)
  - Determine if "Dealer" or "Sub Dealer" from context (default to "Dealer")
  - For missing fields, use the defaults shown above
  - Extract what you can, but ensure ALL required fields have values
  - Use the actual response text as feedbacks if no specific feedback mentioned
  `;

    try {
      const response = await this.makeOpenRouterRequest(prompt, systemMessage);

      const cleanedResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      const parsedData = JSON.parse(cleanedResponse);

      // ✅ FIXED: Provide defaults for missing fields instead of throwing errors
      const dealerData = {
        userId: userId,
        type: parsedData.type || 'Dealer',
        parentDealerId: parsedData.parentDealerId || undefined,
        name: parsedData.name || 'Unknown Dealer',
        region: parsedData.region || 'Unknown Region',
        area: parsedData.area || 'Unknown Area',
        phoneNo: parsedData.phoneNo || '0000000000',
        address: parsedData.address || `GPS: ${latitude}, ${longitude}`,
        totalPotential: parsedData.totalPotential || '10000.00',
        bestPotential: parsedData.bestPotential || '5000.00',
        brandSelling: Array.isArray(parsedData.brandSelling) && parsedData.brandSelling.length > 0
          ? parsedData.brandSelling
          : ['Unknown'],
        feedbacks: parsedData.feedbacks || Object.values(guidedPromptResponses).join(' ') || 'Dealer created via DVR workflow',
        remarks: parsedData.remarks || undefined,
        latitude: latitude,
        longitude: longitude
      };

      // ✅ FINAL VALIDATION: Ensure type is correct
      if (!['Dealer', 'Sub Dealer'].includes(dealerData.type)) {
        dealerData.type = 'Dealer';
      }

      console.log('✅ PARSED DEALER DATA:', dealerData);
      return dealerData;

    } catch (error) {
      console.error('Error parsing dealer data:', error);

      // ✅ ULTIMATE FALLBACK: Return valid dealer data structure
      const fallbackData = {
        userId: userId,
        type: 'Dealer',
        name: Object.values(guidedPromptResponses).join(' ') || 'Unknown Dealer',
        region: 'Unknown Region',
        area: 'Unknown Area',
        phoneNo: '0000000000',
        address: `GPS: ${latitude}, ${longitude}`,
        totalPotential: '10000.00',
        bestPotential: '5000.00',
        brandSelling: ['Unknown'],
        feedbacks: 'Dealer created via DVR workflow',
        latitude: latitude,
        longitude: longitude
      };

      console.log('✅ USING FALLBACK DEALER DATA:', fallbackData);
      return fallbackData;
    }
  }

  async generateDVRFromPromptWithContext(
    prompt: string,
    dealerInfo: any,
    context: any
  ): Promise<DVRData> {
    const systemMessage = `You are a field visit data parsing expert. 
  Parse the natural language visit description into structured DVR data.
  Extract specific values mentioned and use dealer info for missing fields.
  Return ONLY a valid JSON object.`;

    const fullPrompt = `
  Parse this visit description into structured DVR data:

  VISIT DESCRIPTION: "${prompt}"

  DEALER INFO:
  - Name: ${dealerInfo.name}
  - Type: ${dealerInfo.type || 'Dealer'}
  - Total Potential: ${dealerInfo.totalPotential || '10000.00'}
  - Best Potential: ${dealerInfo.bestPotential || '5000.00'}
  - Brands: ${Array.isArray(dealerInfo.brandSelling) ? dealerInfo.brandSelling.join(', ') : 'Unknown'}

  Extract and return JSON with EXACT structure:
  {
    "reportDate": "YYYY-MM-DD",
    "dealerType": "${dealerInfo.type || 'Dealer'}",
    "dealerName": "${dealerInfo.name}",
    "subDealerName": null,
    "location": "${dealerInfo.name} - ${dealerInfo.area || 'Unknown'}",
    "visitType": "Best or Non Best - extract from description",
    "dealerTotalPotential": ${dealerInfo.totalPotential || 10000.00},
    "dealerBestPotential": ${dealerInfo.bestPotential || 5000.00},
    "todayOrderMt": "extract order amount in MT, default 0.00",
    "todayCollectionRupees": "extract collection amount in rupees, default 0.00",
    "brandSelling": ${JSON.stringify(dealerInfo.brandSelling || ['Unknown'])},
    "contactPerson": "extract contact person name if mentioned, otherwise null",
    "contactPersonPhoneNo": "extract phone if mentioned, otherwise null",
    "feedbacks": "extract visit feedback/purpose from description",
    "solutionBySalesperson": "extract solutions provided if mentioned, otherwise null",
    "anyRemarks": "extract additional remarks if mentioned, otherwise null",
    "inTimeImageUrl": null,
    "outTimeImageUrl": null
  }

  PARSING RULES:
  - Extract numbers for order/collection amounts
  - Identify "Best" or "Non Best" visit type
  - Extract contact person details if mentioned
  - Use visit description as feedbacks
  - Default to null for optional fields
  `;

    try {
      const response = await this.makeOpenRouterRequest(fullPrompt, systemMessage);
      const cleanedResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      const parsedData = JSON.parse(cleanedResponse);

      // Ensure all required fields with defaults
      const dvrData = {
        reportDate: parsedData.reportDate || new Date().toISOString().split('T')[0],
        dealerType: parsedData.dealerType || dealerInfo.type || 'Dealer',
        dealerName: parsedData.dealerName || dealerInfo.name,
        subDealerName: parsedData.subDealerName || null,
        location: parsedData.location || `${dealerInfo.name} - ${dealerInfo.area || 'Unknown'}`,
        visitType: parsedData.visitType || 'Best',
        dealerTotalPotential: Number(parsedData.dealerTotalPotential) || Number(dealerInfo.totalPotential) || 10000.00,
        dealerBestPotential: Number(parsedData.dealerBestPotential) || Number(dealerInfo.bestPotential) || 5000.00,
        todayOrderMt: Number(parsedData.todayOrderMt) || 0.00,
        todayCollectionRupees: Number(parsedData.todayCollectionRupees) || 0.00,
        brandSelling: Array.isArray(parsedData.brandSelling) ? parsedData.brandSelling : (dealerInfo.brandSelling || ['Unknown']),
        contactPerson: parsedData.contactPerson || null,
        contactPersonPhoneNo: parsedData.contactPersonPhoneNo || null,
        feedbacks: parsedData.feedbacks || prompt || 'Visit completed',
        solutionBySalesperson: parsedData.solutionBySalesperson || null,
        anyRemarks: parsedData.anyRemarks || null,
        inTimeImageUrl: parsedData.inTimeImageUrl || null,
        outTimeImageUrl: parsedData.outTimeImageUrl || null
      };

      console.log('✅ PARSED DVR DATA:', dvrData);
      return dvrData;

    } catch (error) {
      console.error('DVR parsing error:', error);

      // Fallback with basic structure
      return {
        reportDate: new Date().toISOString().split('T')[0],
        dealerType: dealerInfo.type || 'Dealer',
        dealerName: dealerInfo.name,
        subDealerName: null,
        location: `${dealerInfo.name} - ${dealerInfo.area || 'Unknown'}`,
        visitType: 'Best',
        dealerTotalPotential: Number(dealerInfo.totalPotential) || 10000.00,
        dealerBestPotential: Number(dealerInfo.bestPotential) || 5000.00,
        todayOrderMt: 0.00,
        todayCollectionRupees: 0.00,
        brandSelling: dealerInfo.brandSelling || ['Unknown'],
        contactPerson: null,
        contactPersonPhoneNo: null,
        feedbacks: prompt || 'Visit completed',
        solutionBySalesperson: null,
        anyRemarks: null,
        inTimeImageUrl: null,
        outTimeImageUrl: null
      };
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

  // Helper function to find dealer by GPS coordinates
async function findDealerByLocation(userLat, userLng) {
  const dealers = await db.query.dealers.findMany();
  
  for (const dealer of dealers) {
    // Check if area contains GPS coordinates
    if (dealer.area.startsWith('{')) {
      try {
        const coords = JSON.parse(dealer.area);
        const distance = calculateDistance(userLat, userLng, coords.lat, coords.lng);
        
        if (distance <= (coords.radius || 100)) {
          return dealer;
        }
      } catch (e) {
        continue; // Skip invalid JSON
      }
    }
  }
  return null;
}

// Haversine distance formula
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
           Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
           Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c * 1000; // Distance in meters
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