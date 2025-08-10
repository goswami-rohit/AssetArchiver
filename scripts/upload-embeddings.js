import { QdrantClient } from "@qdrant/js-client-rest";
import fs from "fs";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const qdrantClient = new QdrantClient({
  url: "https://159aa838-50db-435a-b6d7-46b432c554ba.eu-west-1-0.aws.cloud.qdrant.io:6333",
  apiKey: process.env.QDRANT_API_KEY,
});

async function uploadEmbeddings() {
  try {
    console.log("🚀 Starting manual Qdrant upload...");
    
    const collections = await qdrantClient.getCollections();
    console.log("✅ Connected to Qdrant! Existing collections:", collections.collections.length);
    
    const dataPath = join(__dirname, '..', 'data', 'endpoint-embeddings.json');
    const embeddingsData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log(`📂 Loaded ${embeddingsData.length} embeddings`);
    
    const collectionName = "api_endpoints";
    
    try {
      await qdrantClient.createCollection(collectionName, {
        vectors: { size: 384, distance: "Cosine" }
      });
      console.log(`✅ Created collection: ${collectionName}`);
    } catch (error) {
      if (error.message.includes("already exists")) {
        console.log(`📋 Collection ${collectionName} already exists`);
      }
    }
    
    const points = embeddingsData.map(endpoint => ({
      id: endpoint.id,
      vector: endpoint.embedding,
      payload: {
        name: endpoint.name,
        endpoint: endpoint.endpoint,
        method: endpoint.method,
        description: endpoint.description,
        fields: endpoint.fields,
        requiredFields: endpoint.requiredFields,
        searchTerms: endpoint.searchTerms
      }
    }));
    
    await qdrantClient.upsert(collectionName, {
      wait: true,
      points: points
    });
    
    console.log(`✅ Successfully uploaded ${points.length} embeddings!`);
    
  } catch (error) {
    console.error("❌ Upload failed:", error);
  }
}

uploadEmbeddings();