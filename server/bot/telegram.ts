// telegramBotService.ts
import TelegramBot from 'node-telegram-bot-api';
import { AIService } from './aiService';
import { db } from '../db';
import { users, companies } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { Server as SocketIOServer } from 'socket.io';

interface BotConfig {
  token: string;
  aiApiKey?: string;
  useWebhook?: boolean;
  pollingInterval?: number;
  webAppUrl?: string;
}

interface UserSession {
  context: string[];
  lastActive: Date;
  userId?: number;
  companyId?: number;
}

export class TelegramBotService {
  private static instance: TelegramBotService;
  private bot: TelegramBot | null = null;
  private aiService: AIService;
  private readonly config: BotConfig;
  private sessions = new Map<number, UserSession>();
  private readonly MAX_CONTEXT_LENGTH = 10;
  private telegramUserMap = new Map<number, { userId: number; companyId: number }>();
  private isStarting = false;
  private socketIO: SocketIOServer | null = null; // Add Socket.IO support

  private constructor(config: BotConfig) {
    this.config = {
      pollingInterval: 300,
      webAppUrl: process.env.WEB_APP_URL || `http://localhost:${process.env.PORT || 3000}`,
      ...config
    };
    this.aiService = new AIService(config.aiApiKey || '');
    this.setupCleanupInterval();
  }

  public static getInstance(config: BotConfig): TelegramBotService {
    if (!TelegramBotService.instance) {
      TelegramBotService.instance = new TelegramBotService(config);
    }
    return TelegramBotService.instance;
  }

  // Add Socket.IO setter method
  public setSocketIO(io: SocketIOServer): void {
    this.socketIO = io;
    console.log('✅ Socket.IO instance attached to Telegram bot');
    
    // Setup Socket.IO event handlers
    this.setupSocketIOHandlers();
  }

  // Setup Socket.IO event handlers
  private setupSocketIOHandlers(): void {
    if (!this.socketIO) return;

    this.socketIO.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);

      // Handle telegram user linking from web app
      socket.on('link_telegram_user', async (data) => {
        try {
          const { telegramChatId, email } = data;
          const user = await this.linkTelegramUser(telegramChatId, email);
          
          if (user) {
            socket.emit('link_success', { user });
            // Notify telegram chat
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

      // Handle report submissions from web app
      socket.on('report_submitted', (data) => {
        console.log('📊 Report submitted via web app:', data);
        // You can notify relevant telegram users here if needed
      });

      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
      });
    });
  }

  // Method to send notifications to web app clients
  private notifyWebApp(event: string, data: any): void {
    if (this.socketIO) {
      this.socketIO.emit(event, data);
    }
  }

  // Method to link telegram user to CRM user
  private async linkTelegramUser(telegramChatId: number, email: string) {
    try {
      console.log(`Attempting to link Telegram user ${telegramChatId} to email ${email}`);
      
      // Query the database for user with this email
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
        // Notify web app clients about successful linking
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

  // Get CRM user from telegram chat ID
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
      console.log('🚀 TelegramBotService: Initializing bot...');
      
      // Validate required configuration
      if (!this.config.token) {
        throw new Error('TELEGRAM_BOT_TOKEN is not set in environment variables');
      }

      if (!this.config.aiApiKey) {
        console.warn('⚠️  AI API key not set, AI features will be limited');
      }

      // Initialize bot instance
      await this.initializeBot();
      
      if (!this.bot) {
        throw new Error('Failed to initialize Telegram bot instance');
      }

      // Test bot connection
      console.log('🔍 Testing bot connection...');
      const me = await this.bot.getMe();
      console.log(`✅ Bot connected successfully: @${me.username} (ID: ${me.id})`);

      // Setup message handlers before starting polling
      this.setupMessageHandlers();
      this.setupProcessHooks();

      // Start polling if not using webhooks
      if (!this.config.useWebhook) {
        console.log('📡 Starting polling...');
        await this.bot.startPolling();
        console.log('✅ Polling started successfully');
      }

      console.log('🎉 TelegramBotService: Startup complete! Bot is ready to receive messages.');
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

    console.log('TelegramBotService: Creating new bot instance...');
    
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

      // Setup error handlers
      this.bot.on('polling_error', (error) => {
        console.error('📡 Telegram Polling error:', error.message);
        // Don't throw here, just log
      });
      
      this.bot.on('error', (error) => {
        console.error('🤖 Telegram Bot error:', error.message);
        // Don't throw here, just log
      });
      
      console.log('✅ TelegramBotService: Bot instance created successfully');
    } catch (error) {
      console.error('💥 TelegramBotService: Failed to create bot instance:', error);
      throw error;
    }
  }

  private setupMessageHandlers(): void {
    if (!this.bot) {
      throw new Error('Cannot setup handlers - bot not initialized');
    }

    console.log('🔧 TelegramBotService: Setting up message handlers...');
    
    // Handle text messages
    this.bot.on('message', async (msg) => {
      if (!msg.text || !msg.chat?.id) {
        console.log('📨 Received message without text or chat ID, ignoring...');
        return;
      }

      const chatId = msg.chat.id;
      const text = msg.text.trim();
      const session = this.getSession(chatId);

      console.log(`📨 Message from ${chatId}: ${text}`);

      try {
        // Handle commands
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

        // For non-commands, check if user is linked
        if (!this.getCRMUser(chatId)) {
          await this.sendMessage(chatId, 
            "👋 Welcome! Please link your account first using:\n" +
            "/link your-email@company.com\n\n" +
            "Or use /help for more information."
          );
          return;
        }

        // Handle regular chat messages
        await this.handleUserMessage(chatId, text, session);
      } catch (error) {
        console.error(`💥 Error handling message from ${chatId}:`, error);
        await this.sendMessage(chatId, "⚠️ Sorry, something went wrong. Please try again later.");
      }
    });

    // Handle callback queries (button presses)
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

        // Answer the callback query
        await this.bot!.answerCallbackQuery(query.id);
      } catch (error) {
        console.error(`💥 Error handling callback query:`, error);
      }
    });
    
    console.log('✅ TelegramBotService: Message handlers configured');
  }

  private async handleUserMessage(chatId: number, text: string, session: UserSession): Promise<void> {
    try {
      session.context.push(`User: ${text}`);
      session.lastActive = new Date();

      const response = await this.aiService.generateText(
        `You are a helpful sales CRM assistant. The user said: "${text}". ` +
        `Provide a helpful response related to sales, CRM, or daily visit reports. ` +
        `Keep responses concise and actionable.`
      );
      
      session.context.push(`AI: ${response}`);
      this.trimContext(session);
      
      await this.sendMessage(chatId, response);
      
      // Notify web app about the conversation
      this.notifyWebApp('bot_conversation', {
        chatId,
        userMessage: text,
        botResponse: response,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error in AI response:', error);
      await this.sendMessage(chatId, 
        "I'm here to help with your sales CRM needs! " +
        "You can submit reports through the web app by clicking the button above, " +
        "or ask me questions about sales activities."
      );
    }
  }

  private trimContext(session: UserSession): void {
    if (session.context.length > this.MAX_CONTEXT_LENGTH) {
      session.context = session.context.slice(-this.MAX_CONTEXT_LENGTH);
    }
  }

  private getSession(chatId: number): UserSession {
    if (!this.sessions.has(chatId)) {
      this.sessions.set(chatId, {
        context: ['System: New conversation started'],
        lastActive: new Date()
      });
    }
    return this.sessions.get(chatId)!;
  }
private async handleStart(chatId: number): Promise<void> {
  const session = this.getSession(chatId);
  session.context = ['System: New session started'];
  session.lastActive = new Date();
  
  const welcomeMessage = 
    "🤖 Welcome to Sales CRM Assistant!\n\n" +
    "Access the full web application to:\n" +
    "• Submit Daily Visit Reports\n" +
    "• Submit Technical Visit Reports\n" +
    "• Manage Journey Plans\n" +
    "• Track Attendance\n" +
    "• Apply for Leave\n" +
    "• Manage Dealers\n" +
    "• View Performance Dashboards\n" +
    "• Get AI assistance\n\n" +
    "Click the button below to open the web app:";

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "🌐 Open Sales CRM Web App",
          web_app: {
            url: `https://telesalesside.onrender.com/pwa`
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
          `Welcome ${user.firstName || 'User'}! You can now access all CRM features through the web app.`
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
      "🌐 CRM Web Application\n\n" +
      `Click here: ${this.config.webAppUrl}/pwa\n\n` +
      "The web app provides:\n" +
      "• Daily Visit Report submission\n" +
      "• Technical Visit Reports\n" +
      "• Journey Plans management\n" +
      "• Attendance tracking\n" +
      "• Leave applications\n" +
      "• Dealer management\n" +
      "• Performance dashboards\n" +
      "• AI-powered assistance";
    
    await this.sendMessage(chatId, message);
  }

  private async handleHelp(chatId: number): Promise<void> {
    const helpMessage = 
      "🤖 Sales CRM Bot Help\n\n" +
      "Commands:\n" +
      "/start - Show welcome message\n" +
      "/link email@company.com - Link your account\n" +
      "/pwa - Get web app link\n" +
      "/help - Show this help\n\n" +
      "Features:\n" +
      "• Submit comprehensive reports via web app\n" +
      "• Get AI assistance for sales activities\n" +
      "• View performance metrics\n" +
      "• Manage all CRM functions\n\n" +
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
      "Or just ask me a question!"
    );
  }

  private setupCleanupInterval(): void {
    setInterval(() => {
      const now = new Date();
      let cleanedCount = 0;
      
      for (const [chatId, session] of this.sessions) {
        // Clean sessions older than 1 hour
        if ((now.getTime() - session.lastActive.getTime()) > 60 * 60 * 1000) {
          this.sessions.delete(chatId);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} inactive sessions`);
      }
    }, 60 * 60 * 1000); // Run every hour
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
      console.log(`🛑 Received ${signal}, shutting down Telegram bot gracefully...`);
      try {
        await this.stop();
        console.log('✅ Telegram bot stopped successfully');
        process.exit(0);
      } catch (error) {
        console.error('💥 Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => handleExit('SIGINT'));
    process.on('SIGTERM', () => handleExit('SIGTERM'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
      // Don't exit immediately, try to log and continue
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      // Don't exit immediately, try to log and continue
    });
  }

  public async stop(): Promise<void> {
    try {
      if (this.bot && this.bot.isPolling()) {
        console.log('🛑 Stopping bot polling...');
        await this.bot.stopPolling();
        console.log('✅ Bot polling stopped');
      }
      this.bot = null;
    } catch (error) {
      console.error('💥 Error stopping bot:', error);
      throw error;
    }
  }

  // Add method to check if bot is running
  public isRunning(): boolean {
    return this.bot !== null && this.bot.isPolling();
  }

  // Method to send notification to specific telegram user
  public async notifyTelegramUser(userId: number, message: string): Promise<void> {
    // Find telegram chat ID for this user
    for (const [chatId, userData] of this.telegramUserMap) {
      if (userData.userId === userId) {
        await this.sendMessage(chatId, message);
        break;
      }
    }
  }
}

// Create and export the singleton instance
export const telegramBot = TelegramBotService.getInstance({
  token: process.env.TELEGRAM_BOT_TOKEN || '',
  aiApiKey: process.env.OPENROUTER_API_KEY || '',
  webAppUrl: process.env.WEB_APP_URL || `https://telesalesside.onrender.com/pwa`
});