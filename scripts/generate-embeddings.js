import { pipeline } from '@xenova/transformers';
import fs from "fs";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const endpoints = [
  {
    id: 1,
    name: "Daily Visit Report",
    endpoint: "/api/dvr-manual",
    method: "POST", 
    description: "Create daily visit reports for dealer visits, track orders and collections",
    fields: [
      "userId", "reportDate", "dealerType", "dealerName", "subDealerName", 
      "location", "latitude", "longitude", "visitType", "dealerTotalPotential",
      "dealerBestPotential", "brandSelling", "contactPerson", "contactPersonPhoneNo",
      "todayOrderMt", "todayCollectionRupees", "feedbacks", "solutionBySalesperson",
      "anyRemarks", "checkInTime", "checkOutTime", "inTimeImageUrl", "outTimeImageUrl"
    ],
    requiredFields: ["userId", "dealerName", "location", "visitType"],
    searchTerms: "daily visit report dealer visit dvr dealer meeting order collection sales visit"
  },
  {
    id: 2,
    name: "Technical Visit Report",
    endpoint: "/api/tvr", 
    method: "POST",
    description: "Create technical visit reports for customer sites and maintenance",
    fields: [
      "userId", "reportDate", "visitType", "siteNameConcernedPerson", "phoneNo",
      "emailId", "clientsRemarks", "salespersonRemarks", "checkInTime", "checkOutTime",
      "inTimeImageUrl", "outTimeImageUrl", "useAI", "userInput"
    ],
    requiredFields: ["userId", "siteNameConcernedPerson", "phoneNo"],
    searchTerms: "technical visit report tvr customer site maintenance technical support service"
  }
];

async function generateAndStore() {
  console.log("🚀 Generating embeddings with FREE Transformers.js...");
  console.log("📦 Loading model: Xenova/all-MiniLM-L6-v2 (this may take a moment on first run)");
  
  // Load the embedding model (downloads once, then cached)
  const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  
  const embeddedEndpoints = [];
  
  for (const endpoint of endpoints) {
    const searchableText = `${endpoint.name} ${endpoint.description} ${endpoint.searchTerms}`;
    
    console.log(`⏳ Generating embedding for: ${endpoint.name}`);
    console.log(`📝 Text: "${searchableText.substring(0, 60)}..."`);
    
    try {
      // Generate embedding using Transformers.js
      const output = await embedder(searchableText, { pooling: 'mean', normalize: true });
      
      // Convert to regular array
      const embedding = Array.from(output.data);
      
      embeddedEndpoints.push({
        ...endpoint,
        embedding: embedding
      });
      
      console.log(`✅ Generated ${embedding.length}-dimensional embedding for ${endpoint.name}`);
    } catch (error) {
      console.error(`❌ Failed to generate embedding for ${endpoint.name}:`, error.message);
      return;
    }
  }
  
  const dataPath = join(__dirname, '..', 'data', 'endpoint-embeddings.json');
  fs.writeFileSync(dataPath, JSON.stringify(embeddedEndpoints, null, 2));
  console.log("✅ Saved embeddings to ./data/endpoint-embeddings.json");
  console.log(`💰 Total cost: $0.00 (100% FREE!)`);
}

generateAndStore().catch(console.error);