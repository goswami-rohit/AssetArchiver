import 'dotenv/config';

// Add debug logging immediately after dotenv import
console.log("🔍 Environment check:");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("DATABASE_URL:", process.env.DATABASE_URL ? "Found" : "Not found");
console.log("TELEGRAM_BOT_TOKEN:", process.env.TELEGRAM_BOT_TOKEN ? "Found" : "Not found");
console.log("Token preview:", process.env.TELEGRAM_BOT_TOKEN?.substring(0, 10) + "..." || "undefined");

import express, { type Request, Response, NextFunction } from "express";
import {setupWebRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { telegramBot } from './bot/telegram';
import cors from 'cors';
import { QdrantClient } from "@qdrant/js-client-rest"
import { testQdrant } from "./qdrant";

  // Since it's in the same folder
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

testQdrant();

const app = express();
// ADD CORS CONFIGURATION HERE (before other middleware)
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:8000',
    'https://mycoco.site',
    'https://telegram-chat-api.onrender.com',
    'https://tele-bot-test.onrender.com',
    'https://temtembot-api-ai.onrender.com',
    // Add development fallbacks
    process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : '',
    process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:3000' : '',
  ].filter(Boolean), // Remove empty strings
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    // Socket.IO specific headers
    'x-socket-id',
    'x-session-id'
  ],
  // Enable preflight for all routes
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));


app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await setupWebRoutes(app);
  const server = createServer(app);
  const io = new SocketIOServer(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
  });
  global.io = io;
  console.log('✅ Socket.IO server created');

  // Socket.IO connection handler for web chat (simplified)
  io.on('connection', (socket) => {
    console.log('🌐 Client connected:', socket.id);

    // Handle web messages from PWA (optional - can be removed if not needed)
    socket.on('web_message', async (data) => {
      console.log('📨 Web message received:', data.text);
      
      // Simply acknowledge the message - let the PWA handle its own logic
      socket.emit('message_received', {
        status: 'received',
        timestamp: new Date(),
        message: `Echo: ${data.text}`
      });
    });

    // Handle web app events
    socket.on('pwa_opened', (data) => {
      console.log('📱 PWA opened by user:', data);
    });

    socket.on('report_submitted', (data) => {
      console.log('📊 Report submitted via PWA:', data);
    });

    socket.on('disconnect', () => {
      console.log('❌ Client disconnected:', socket.id);
    });
  });

  // Set up Socket.IO for the Telegram bot
  telegramBot.setSocketIO(io);
  
  // Start the Telegram bot
  try {
    console.log('🤖 Starting Telegram bot...');
    await telegramBot.start();
    console.log('✅ Telegram bot started successfully!');
  } catch (error) {
    console.error('💥 Failed to start Telegram bot:', error);
    console.error('🔍 Check your TELEGRAM_BOT_TOKEN and network connection');
    // Don't exit - let the web app still work even if bot fails
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 8000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = process.env.PORT || 8000;
  server.listen(port, () => {
    log(`serving on port ${port}`);
  });
})();