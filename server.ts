import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import TelegramBot from 'node-telegram-bot-api';
import cron from 'node-cron';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import fs from 'fs';

// Load firebase config
let firebaseConfig: any = null;
try {
  firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
} catch (error) {
  console.warn('Warning: firebase-applet-config.json not found. Firebase will not be initialized on the server.');
}

const app = firebaseConfig ? initializeApp(firebaseConfig) : null;
const db = firebaseConfig ? getFirestore(app!, firebaseConfig.firestoreDatabaseId) : null;

// Pool of active bots
const activeBots: Record<string, TelegramBot> = {};
const activeTokens: Record<string, string> = {}; // shopId -> token
const pendingSetups: Record<string, Promise<void>> = {}; // shopId -> promise

// Function to setup a bot for a specific shop
async function setupBot(shopId: string, token: string, chatId: string) {
  // If there's already a setup in progress for this shop, wait for it
  if (pendingSetups[shopId]) {
    await pendingSetups[shopId];
  }

  // Create a new setup promise
  const setupPromise = (async () => {
    // If we already have a bot for this shop with the SAME token, do nothing
    if (activeTokens[shopId] === token) {
      return;
    }

    // If we have a bot for this shop with a DIFFERENT token, stop it
    if (activeBots[shopId]) {
      try {
        await activeBots[shopId].stopPolling();
      } catch (e) {
        console.error(`Error stopping bot for shop ${shopId}:`, e);
      }
      delete activeBots[shopId];
      delete activeTokens[shopId];
    }

    // Check if this token is already being used by ANOTHER shop
    const otherShopId = Object.keys(activeTokens).find(id => activeTokens[id] === token);
    if (otherShopId) {
      console.warn(`Token for shop ${shopId} is already in use by shop ${otherShopId}. Skipping polling for this instance.`);
      // We still store it in activeBots so we can send messages, but we don't start polling
      try {
        const bot = new TelegramBot(token, { polling: false });
        activeBots[shopId] = bot;
        activeTokens[shopId] = token;
        return;
      } catch (e) {
        console.error(`Failed to initialize non-polling bot for shop ${shopId}:`, e);
        return;
      }
    }

    try {
      const bot = new TelegramBot(token, { polling: true });
      
      bot.onText(/\/start/, async (msg) => {
      bot.sendMessage(msg.chat.id, 'Welcome to our store! Use /inventory to browse our items.');
      
      // Track customer chat ID
      if (db && msg.from) {
        try {
          const { setDoc, doc, serverTimestamp } = await import('firebase/firestore');
          const customerId = `tg_${msg.from.id}`;
          await setDoc(doc(db, 'customers', customerId), {
            id: customerId,
            userId: shopId,
            name: `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim() || 'Telegram User',
            telegram: msg.from.username ? `@${msg.from.username}` : undefined,
            telegramChatId: msg.chat.id.toString(),
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        } catch (error) {
          console.error('Error tracking customer:', error);
        }
      }
    });

    bot.onText(/\/inventory/, async (msg) => {
      if (!db) return;
      try {
        const q = query(collection(db, 'inventory'), where('userId', '==', shopId));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          bot.sendMessage(msg.chat.id, 'Our inventory is currently empty.');
          return;
        }

        let response = '📦 *Current Inventory:*\n\n';
        snapshot.forEach(doc => {
          const item = doc.data();
          if (item.quantityStocked > 0 && item.status !== 'ordered') {
            response += `• *${item.itemName}*\n`;
            response += `  Price: ${item.sellingPriceETB} ETB\n`;
            response += `  Size: ${item.size}\n`;
            response += `  Stock: ${item.quantityStocked}\n\n`;
          }
        });

        bot.sendMessage(msg.chat.id, response, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error('Error fetching inventory for bot:', error);
        bot.sendMessage(msg.chat.id, 'Sorry, there was an error fetching the inventory.');
      }
    });

    activeBots[shopId] = bot;
    activeTokens[shopId] = token;
    console.log(`Started bot for shop ${shopId}`);
  } catch (error) {
    console.error(`Failed to start bot for shop ${shopId}:`, error);
  }
})();

pendingSetups[shopId] = setupPromise;
try {
  await setupPromise;
} finally {
  delete pendingSetups[shopId];
}
}

// Listen for settings changes to start/stop bots
if (db) {
  onSnapshot(collection(db, 'settings'), (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      const data = change.doc.data();
      const shopId = data.userId;
      
      if (change.type === 'added' || change.type === 'modified') {
        if (data.telegramBotToken) {
          setupBot(shopId, data.telegramBotToken, data.telegramChatId).catch(err => {
            console.error(`Error setting up bot for shop ${shopId}:`, err);
          });
        } else if (activeBots[shopId]) {
          activeBots[shopId].stopPolling().catch(err => {
            console.error(`Error stopping bot for shop ${shopId}:`, err);
          });
          delete activeBots[shopId];
          delete activeTokens[shopId];
        }
      } else if (change.type === 'removed') {
        if (activeBots[shopId]) {
          activeBots[shopId].stopPolling().catch(err => {
            console.error(`Error stopping bot for shop ${shopId}:`, err);
          });
          delete activeBots[shopId];
          delete activeTokens[shopId];
        }
      }
    });
  });
}

// Daily Sales Report Cron Job (Runs every day at 8:00 PM)
cron.schedule('0 20 * * *', async () => {
  if (!db) return;
  console.log('Running daily sales report cron job...');
  try {
    const settingsSnap = await getDocs(collection(db, 'settings'));
    
    for (const doc of settingsSnap.docs) {
      const settings = doc.data();
      if (settings.telegramBotToken && (settings.personalTelegramChatId || settings.telegramChatId)) {
        const shopId = settings.userId;
        const targetChatId = settings.personalTelegramChatId || settings.telegramChatId;
        
        // Get today's sales
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const salesSnap = await getDocs(query(collection(db, 'sales'), where('userId', '==', shopId)));
        let totalRevenue = 0;
        const itemsSold: Record<string, number> = {};
        
        salesSnap.forEach(saleDoc => {
          const sale = saleDoc.data();
          const saleDate = new Date(sale.dateSold);
          if (saleDate >= today) {
            totalRevenue += (sale.sellingPriceETB * sale.quantitySold) - (sale.discountAmountETB || 0);
            itemsSold[sale.itemName] = (itemsSold[sale.itemName] || 0) + sale.quantitySold;
          }
        });
        
        if (totalRevenue > 0) {
          let report = `📊 *Daily Sales Report*\n\n`;
          report += `Total Revenue: ${totalRevenue} ETB\n\n`;
          report += `*Top Items Sold:*\n`;
          
          const sortedItems = Object.entries(itemsSold).sort((a, b) => b[1] - a[1]).slice(0, 5);
          for (const [name, qty] of sortedItems) {
            report += `• ${name}: ${qty}\n`;
          }
          
          const bot = activeBots[shopId] || new TelegramBot(settings.telegramBotToken, { polling: false });
          bot.sendMessage(targetChatId, report, { parse_mode: 'Markdown' });
        }
      }
    }
  } catch (error) {
    console.error('Error running daily sales report:', error);
  }
});

async function startServer() {
  const server = express();
  const PORT = 3000;

  server.use(express.json());

  // API routes
  server.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Endpoint to trigger order notification
  server.post('/api/notify-order', async (req, res) => {
    if (!db) {
      return res.status(500).json({ error: 'Database not initialized' });
    }
    const { shopId, orderDetails } = req.body;
    
    try {
      const bot = activeBots[shopId];
      if (bot) {
        const settingsSnap = await getDocs(query(collection(db, 'settings'), where('userId', '==', shopId)));
        if (!settingsSnap.empty) {
          const settings = settingsSnap.docs[0].data();
          if (settings.telegramChatId) {
            await bot.sendMessage(settings.telegramChatId, `🛍️ *New Order!*\n\n${orderDetails}`, { parse_mode: 'Markdown' });
          }
        }
      } else {
        // Fallback if bot is not in pool
        const settingsSnap = await getDocs(query(collection(db, 'settings'), where('userId', '==', shopId)));
        if (!settingsSnap.empty) {
          const settings = settingsSnap.docs[0].data();
          if (settings.telegramBotToken && settings.telegramChatId) {
            const tempBot = new TelegramBot(settings.telegramBotToken, { polling: false });
            await tempBot.sendMessage(settings.telegramChatId, `🛍️ *New Order!*\n\n${orderDetails}`, { parse_mode: 'Markdown' });
          }
        }
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error sending telegram notification:', error);
      res.status(500).json({ error: 'Failed to send notification' });
    }
  });

  // Endpoint to send bulk messages
  server.post('/api/bulk-message', async (req, res) => {
    if (!db) {
      return res.status(500).json({ error: 'Database not initialized' });
    }
    const { shopId, message, customerIds, broadcastToChannel } = req.body;
    
    try {
      const bot = activeBots[shopId];
      if (!bot) {
        return res.status(400).json({ error: 'Telegram bot not configured for this shop' });
      }

      const results = { success: 0, failed: 0, channelBroadcast: false };

      // Broadcast to public channel if requested
      if (broadcastToChannel) {
        try {
          const { getDocs, query, collection, where } = await import('firebase/firestore');
          const settingsSnap = await getDocs(query(collection(db!, 'settings'), where('userId', '==', shopId)));
          if (!settingsSnap.empty) {
            const settings = settingsSnap.docs[0].data();
            if (settings.telegramChatId) {
              await bot.sendMessage(settings.telegramChatId, message, { parse_mode: 'Markdown' });
              results.channelBroadcast = true;
            }
          }
        } catch (err) {
          console.error('Failed to broadcast to channel:', err);
        }
      }
      
      if (customerIds && customerIds.length > 0) {
        for (const customerId of customerIds) {
        try {
          const { getDoc, doc } = await import('firebase/firestore');
          const customerSnap = await getDoc(doc(db, 'customers', customerId));
          const customer = customerSnap.data();
          
          if (customer?.telegramChatId) {
            await bot.sendMessage(customer.telegramChatId, message, { parse_mode: 'Markdown' });
            results.success++;
          } else {
            results.failed++;
          }
        } catch (err) {
          console.error(`Failed to send message to customer ${customerId}:`, err);
          results.failed++;
        }
      }
    }
      
      res.json({ status: 'ok', results });
    } catch (error) {
      console.error('Error sending bulk messages:', error);
      res.status(500).json({ error: 'Failed to send bulk messages' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    server.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    server.use(express.static(distPath));
    server.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
