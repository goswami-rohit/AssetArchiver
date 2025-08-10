import { QdrantClient } from "@qdrant/js-client-rest";

export const qdrantClient = new QdrantClient({
  url: "https://159aa838-50db-435a-b6d7-46b432c554ba.eu-west-1-0.aws.cloud.qdrant.io:6333",
  apiKey: process.env.QDRANT_API_KEY,
});

// Test function to see if connection works
export async function testQdrant() {
  try {
    console.log("🔌 Testing Qdrant connection...");
    const collections = await qdrantClient.getCollections();
    console.log("✅ Connected to Qdrant! Collections:", collections.collections.length);
    
    // List collection names if any exist
    if (collections.collections.length > 0) {
      console.log("📋 Existing collections:", 
        collections.collections.map(c => c.name).join(", ")
      );
    }
    
    return true;
  } catch (err) {
    console.error("❌ Qdrant connection failed:", err.message);
    return false;
  }
}

// Function to search for similar endpoints
export async function searchSimilarEndpoints(queryEmbedding, limit = 3) {
  try {
    const searchResult = await qdrantClient.search("api_endpoints", {
      vector: queryEmbedding,
      limit: limit,
      with_payload: true
    });
    
    return searchResult.map(result => ({
      name: result.payload.name,
      endpoint: result.payload.endpoint,
      description: result.payload.description,
      similarity: result.score,
      fields: result.payload.fields,
      requiredFields: result.payload.requiredFields
    }));
  } catch (error) {
    console.error("❌ Search failed:", error);
    return [];
  }
}