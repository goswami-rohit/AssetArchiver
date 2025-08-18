// server/bot/telegram.ts
import TelegramBot from 'node-telegram-bot-api';
import { db } from '../db.js';
import { users, companies } from '../../shared/schema.js';
import { EnhancedRAGService } from 'server/bot/aiService';
import { eq } from 'drizzle-orm';
import { Server as SocketIOServer } from 'socket.io';

interface BotConfig {
  token: string;
  useWebhook?: boolean;
  pollingInterval?: number;
  webAppUrl?: string;
}

interface UserSession {
  context: string[];
  lastActive: Date;
  userId?: number;
  companyId?: number;
  messages: Array<{ role: 'user' | 'assistant', content: string }>;
}

export class TelegramBotService {
  private static instance: TelegramBotService;
  private bot: TelegramBot | null = null;
  private ragService: PureRAGService; // 🔥 RAG INSTEAD OF AI SERVICE
  private readonly config: BotConfig;
  private sessions = new Map<number, UserSession>();
  private readonly MAX_CONTEXT_LENGTH = 10;
  private telegramUserMap = new Map<number, { userId: number; companyId: number }>();
  private isStarting = false;
  private socketIO: SocketIOServer | null = null;

  private constructor(config: BotConfig) {
    this.config = {
      pollingInterval: 300,
      webAppUrl: process.env.WEB_APP_URL || `http://localhost:${process.env.PORT || 3000}`,
      ...config
    };

    // 🚀 INITIALIZE RAG SERVICE
    this.ragService = new PureRAGService();
    console.log('🧠 RAG Service initialized for Telegram bot');

    this.setupCleanupInterval();
  }

  public static getInstance(config: BotConfig): TelegramBotService {
    if (!TelegramBotService.instance) {
      TelegramBotService.instance = new TelegramBotService(config);
    }
    return TelegramBotService.instance;
  }

  public setSocketIO(io: SocketIOServer): void {
    this.socketIO = io;
    console.log('✅ Socket.IO instance attached to Telegram bot');
    this.setupSocketIOHandlers();
  }

  private setupSocketIOHandlers(): void {
    if (!this.socketIO) return;

    this.socketIO.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);

      socket.on('link_telegram_user', async (data) => {
        try {
          const { telegramChatId, email } = data;
          const user = await this.linkTelegramUser(telegramChatId, email);

          if (user) {
            socket.emit('link_success', { user });
            await this.sendMessage(telegramChatId,
              `✅ Account linked successfully from web app!\nWelcome ${user.firstName || 'User'}!`
            );
          } else {
            socket.emit('link_error', { message: 'User not found' });
          }
        } catch (error) {
          console.error('Socket.IO link error:', error);
          socket.emit('link_error', { message: 'Linking failed' });
        }
      });

      socket.on('report_submitted', (data) => {
        console.log('📊 Report submitted via web app:', data);
      });

      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
      });
    });
  }

  private notifyWebApp(event: string, data: any): void {
    if (this.socketIO) {
      this.socketIO.emit(event, data);
    }
  }

  private async linkTelegramUser(telegramChatId: number, email: string) {
    try {
      console.log(`Attempting to link Telegram user ${telegramChatId} to email ${email}`);

      const user = await db.query.users.findFirst({
        where: eq(users.email, email),
        with: {
          company: true
        }
      });

      if (user) {
        this.telegramUserMap.set(telegramChatId, {
          userId: user.id,
          companyId: user.companyId
        });

        console.log(`✅ Successfully linked Telegram user ${telegramChatId} to user ${user.id}`);
        this.notifyWebApp('user_linked', {
          telegramChatId,
          userId: user.id,
          email: user.email
        });

        return user;
      }

      console.log(`❌ No user found with email ${email}`);
      return null;
    } catch (error) {
      console.error(`Error linking user ${email}:`, error);
      throw error;
    }
  }

  private getCRMUser(telegramChatId: number) {
    return this.telegramUserMap.get(telegramChatId);
  }

  public async start(): Promise<void> {
    if (this.isStarting) {
      console.log('TelegramBotService: Already starting, skipping...');
      return;
    }

    this.isStarting = true;

    try {
      console.log('🚀 TelegramBotService: Initializing RAG-powered bot...');

      if (!this.config.token) {
        throw new Error('TELEGRAM_BOT_TOKEN is not set in environment variables');
      }

      await this.initializeBot();

      if (!this.bot) {
        throw new Error('Failed to initialize Telegram bot instance');
      }

      console.log('🔍 Testing bot connection...');
      const me = await this.bot.getMe();
      console.log(`✅ RAG Bot connected successfully: @${me.username} (ID: ${me.id})`);

      this.setupMessageHandlers();
      this.setupProcessHooks();

      if (!this.config.useWebhook) {
        console.log('📡 Starting polling...');
        await this.bot.startPolling();
        console.log('✅ Polling started successfully');
      }

      console.log('🎉 RAG-Powered TelegramBotService: Ready! 🧠');
      this.isStarting = false;
    } catch (error) {
      this.isStarting = false;
      console.error("💥 TelegramBotService: Startup failed:", error);
      throw error;
    }
  }

  private async initializeBot(): Promise<void> {
    if (this.bot) {
      console.log('TelegramBotService: Bot already initialized, cleaning up first...');
      await this.stop();
    }

    console.log('TelegramBotService: Creating new RAG bot instance...');

    try {
      this.bot = new TelegramBot(this.config.token, {
        polling: !this.config.useWebhook ? {
          interval: this.config.pollingInterval,
          autoStart: false,
          params: {
            timeout: 10,
            allowed_updates: ['message', 'callback_query']
          }
        } : false
      });

      this.bot.on('polling_error', (error) => {
        console.error('📡 Telegram Polling error:', error.message);
      });

      this.bot.on('error', (error) => {
        console.error('🤖 Telegram Bot error:', error.message);
      });

      console.log('✅ TelegramBotService: RAG bot instance created successfully');
    } catch (error) {
      console.error('💥 TelegramBotService: Failed to create bot instance:', error);
      throw error;
    }
  }

  private setupMessageHandlers(): void {
    if (!this.bot) {
      throw new Error('Cannot setup handlers - bot not initialized');
    }

    console.log('🔧 TelegramBotService: Setting up RAG message handlers...');

    this.bot.on('message', async (msg) => {
      if (!msg.text || !msg.chat?.id) {
        console.log('📨 Received message without text or chat ID, ignoring...');
        return;
      }

      const chatId = msg.chat.id;
      const text = msg.text.trim();
      const session = this.getSession(chatId);

      console.log(`📨 RAG Message from ${chatId}: ${text}`);

      try {
        if (text === '/start') {
          await this.handleStart(chatId);
          return;
        }

        if (text.startsWith('/link')) {
          await this.handleLink(chatId, text);
          return;
        }

        if (text === '/pwa') {
          await this.handlePWA(chatId);
          return;
        }

        if (text === '/help') {
          await this.handleHelp(chatId);
          return;
        }

        if (text.startsWith('/')) {
          await this.handleUnknownCommand(chatId);
          return;
        }

        if (!this.getCRMUser(chatId)) {
          await this.sendMessage(chatId,
            "👋 Welcome! Please link your account first using:\n" +
            "/link your-email@company.com\n\n" +
            "Or use /help for more information."
          );
          return;
        }

        // 🧠 HANDLE WITH RAG SERVICE
        await this.handleUserMessageWithRAG(chatId, text, session);
      } catch (error) {
        console.error(`💥 Error handling message from ${chatId}:`, error);
        await this.sendMessage(chatId, "⚠️ Sorry, something went wrong. Please try again later.");
      }
    });

    this.bot.on('callback_query', async (query) => {
      if (!query.message || !query.data) return;

      const chatId = query.message.chat.id;

      try {
        if (query.data === 'link_account') {
          await this.sendMessage(chatId,
            "🔗 To link your account, use:\n" +
            "/link your-email@company.com\n\n" +
            "Replace 'your-email@company.com' with your actual email address."
          );
        }

        await this.bot!.answerCallbackQuery(query.id);
      } catch (error) {
        console.error(`💥 Error handling callback query:`, error);
      }
    });

    console.log('✅ TelegramBotService: RAG message handlers configured');
  }

  // 🧠 NEW RAG-POWERED MESSAGE HANDLER
  private async handleUserMessageWithRAG(chatId: number, text: string, session: UserSession): Promise<void> {
    try {
      // Add user message to session
      session.messages.push({ role: 'user', content: text });
      session.lastActive = new Date();

      // 🔥 USE RAG SERVICE FOR INTELLIGENT RESPONSE
      console.log('🧠 Processing message with RAG...');
      const ragResponse = await this.ragService.processConversation(session.messages);

      // Add AI response to session
      session.messages.push({ role: 'assistant', content: ragResponse.message });
      this.trimContext(session);

      // Send response to user
      await this.sendMessage(chatId, `🧠 **RAG Assistant**\n\n${ragResponse.message}`);

      // 🎯 CHECK IF DATA EXTRACTION IS POSSIBLE
      if (ragResponse.message.includes('ready to submit') || ragResponse.message.includes('should I submit')) {
        await this.checkForDataExtraction(chatId, session);
      }

      // Notify web app about the conversation
      this.notifyWebApp('bot_conversation', {
        chatId,
        userMessage: text,
        botResponse: ragResponse.message,
        timestamp: new Date(),
        ragPowered: true
      });

    } catch (error) {
      console.error('💥 Error in RAG response:', error);
      await this.sendMessage(chatId,
        "🧠 I'm your RAG-powered assistant! I can help with:\n\n" +
        "• Daily Visit Reports\n" +
        "• Technical Visit Reports\n" +
        "• Sales queries\n" +
        "• Data extraction\n\n" +
        "Just describe your work naturally!"
      );
    }
  }

  // 🎯 CHECK FOR DATA EXTRACTION WITH RAG
  private async checkForDataExtraction(chatId: number, session: UserSession): Promise<void> {
    try {
      // Use your RAG extraction endpoint logic here
      const extractResponse = await fetch('/api/rag/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: session.messages
        })
      });

      const data = await extractResponse.json();

      if (data.success && data.extractedData) {
        const endpointType = data.extractedData.endpoint === '/api/dvr-manual' ? 'Daily Visit Report' : 'Technical Visit Report';

        await this.sendMessage(chatId,
          `✅ **Data Ready for Submission!**\n\n` +
          `📊 **Type:** ${endpointType}\n` +
          `🎯 **Endpoint:** ${data.extractedData.endpoint}\n\n` +
          `Reply "YES" to submit to database or "NO" to cancel.`
        );

        // Store extraction data in session for later submission
        session.extractedData = data.extractedData;
      }
    } catch (error) {
      console.error('💥 Data extraction error:', error);
    }
  }

  private trimContext(session: UserSession): void {
    if (session.messages.length > this.MAX_CONTEXT_LENGTH) {
      session.messages = session.messages.slice(-this.MAX_CONTEXT_LENGTH);
    }
  }

  private getSession(chatId: number): UserSession {
    if (!this.sessions.has(chatId)) {
      this.sessions.set(chatId, {
        context: ['System: RAG-powered conversation started'],
        lastActive: new Date(),
        messages: []
      });
    }
    return this.sessions.get(chatId)!;
  }

  private async handleStart(chatId: number): Promise<void> {
    const session = this.getSession(chatId);
    session.messages = [];
    session.lastActive = new Date();

    const welcomeMessage =
      "🧠 **RAG-Powered Sales CRM Assistant!**\n\n" +
      "🚀 **New Features:**\n" +
      "• Natural conversation AI\n" +
      "• Smart data extraction\n" +
      "• Vector-powered responses\n" +
      "• Automatic endpoint detection\n\n" +
      "Access the full web application to:\n" +
      "• Submit Daily Visit Reports\n" +
      "• Submit Technical Visit Reports\n" +
      "• Manage Journey Plans\n" +
      "• Track Attendance\n" +
      "• Apply for Leave\n" +
      "• Manage Dealers\n" +
      "• View Performance Dashboards\n\n" +
      "Click the button below to open the web app:";

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "🌐 Open RAG-Powered Web App",
            web_app: {
              url: `${this.config.webAppUrl}/pwa`
            }
          }
        ],
        [
          {
            text: "🔗 Link Account",
            callback_data: "link_account"
          }
        ]
      ]
    };

    await this.sendMessage(chatId, welcomeMessage, { reply_markup: keyboard });
  }

  private async handleLink(chatId: number, text: string): Promise<void> {
    const parts = text.split(' ');
    const email = parts[1];

    if (!email || !email.includes('@')) {
      await this.sendMessage(chatId,
        "❌ Please provide a valid email address:\n" +
        "/link your-email@company.com"
      );
      return;
    }

    try {
      const user = await this.linkTelegramUser(chatId, email);

      if (user) {
        await this.sendMessage(chatId,
          `✅ Successfully linked to ${email}!\n\n` +
          `Welcome ${user.firstName || 'User'}! You now have access to RAG-powered features!`
        );
      } else {
        await this.sendMessage(chatId,
          `❌ No user found with email ${email}.\n\n` +
          "Please check your email address and try again, or contact your administrator."
        );
      }
    } catch (error) {
      console.error("Error linking user:", error);
      await this.sendMessage(chatId,
        "❌ Error linking account. Please try again later or contact support."
      );
    }
  }

  private async handlePWA(chatId: number): Promise<void> {
    const message =
      "🧠 **RAG-Powered CRM Web Application**\n\n" +
      `Click here: ${this.config.webAppUrl}/pwa\n\n` +
      "🚀 **New RAG Features:**\n" +
      "• ChatGPT-like conversation\n" +
      "• Smart data extraction\n" +
      "• Vector database search\n" +
      "• Automatic endpoint detection\n\n" +
      "📊 **Standard Features:**\n" +
      "• Daily Visit Report submission\n" +
      "• Technical Visit Reports\n" +
      "• Journey Plans management\n" +
      "• Attendance tracking\n" +
      "• Leave applications\n" +
      "• Dealer management\n" +
      "• Performance dashboards";

    await this.sendMessage(chatId, message);
  }

  private async handleHelp(chatId: number): Promise<void> {
    const helpMessage =
      "🧠 **RAG-Powered Sales CRM Bot Help**\n\n" +
      "**Commands:**\n" +
      "/start - Show welcome message\n" +
      "/link email@company.com - Link your account\n" +
      "/pwa - Get web app link\n" +
      "/help - Show this help\n\n" +
      "🚀 **RAG Features:**\n" +
      "• Natural conversation processing\n" +
      "• Smart data extraction from text\n" +
      "• Vector-powered responses\n" +
      "• Automatic report generation\n\n" +
      "💬 **Just talk naturally:**\n" +
      "\"I visited ABC dealer today, got 5MT order\"\n" +
      "\"Fixed technical issue at XYZ factory\"\n\n" +
      "Need help? Contact your system administrator.";

    await this.sendMessage(chatId, helpMessage);
  }

  private async handleUnknownCommand(chatId: number): Promise<void> {
    await this.sendMessage(chatId,
      "❓ Unknown command. Available commands:\n" +
      "/start - Welcome message\n" +
      "/link email - Link account\n" +
      "/pwa - Web app link\n" +
      "/help - Show help\n\n" +
      "🧠 Or just talk naturally - I'm RAG-powered!"
    );
  }

  private setupCleanupInterval(): void {
    setInterval(() => {
      const now = new Date();
      let cleanedCount = 0;

      for (const [chatId, session] of this.sessions) {
        if ((now.getTime() - session.lastActive.getTime()) > 60 * 60 * 1000) {
          this.sessions.delete(chatId);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} inactive RAG sessions`);
      }
    }, 60 * 60 * 1000);
  }

  private async sendMessage(chatId: number, text: string, options?: any): Promise<void> {
    if (!this.bot) {
      throw new Error('Bot not initialized');
    }

    try {
      await this.bot.sendMessage(chatId, text, options);
    } catch (error) {
      console.error(`Error sending message to ${chatId}:`, error);
      throw error;
    }
  }

  private setupProcessHooks(): void {
    const handleExit = async (signal: string) => {
      console.log(`🛑 Received ${signal}, shutting down RAG Telegram bot gracefully...`);
      try {
        await this.stop();
        console.log('✅ RAG Telegram bot stopped successfully');
        process.exit(0);
      } catch (error) {
        console.error('💥 Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => handleExit('SIGINT'));
    process.on('SIGTERM', () => handleExit('SIGTERM'));

    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    });
  }

  public async stop(): Promise<void> {
    try {
      if (this.bot && this.bot.isPolling()) {
        console.log('🛑 Stopping RAG bot polling...');
        await this.bot.stopPolling();
        console.log('✅ RAG Bot polling stopped');
      }
      this.bot = null;
    } catch (error) {
      console.error('💥 Error stopping bot:', error);
      throw error;
    }
  }

  public isRunning(): boolean {
    return this.bot !== null && this.bot.isPolling();
  }

  public async notifyTelegramUser(userId: number, message: string): Promise<void> {
    for (const [chatId, userData] of this.telegramUserMap) {
      if (userData.userId === userId) {
        await this.sendMessage(chatId, `🧠 **RAG Notification**\n\n${message}`);
        break;
      }
    }
  }
}

// Create and export the RAG-powered singleton instance
export const telegramBot = TelegramBotService.getInstance({
  token: process.env.TELEGRAM_BOT_TOKEN || '',
  webAppUrl: process.env.WEB_APP_URL || `https://telesalesside.onrender.com`
});