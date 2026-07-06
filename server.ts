import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import TelegramBot from 'node-telegram-bot-api';
import cron from 'node-cron';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, onSnapshot, doc, setDoc, getDoc, setLogLevel } from 'firebase/firestore';
import fs from 'fs';

// Set Firestore log level to error to reduce noise from internal SDK warnings on the server
setLogLevel('error');

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
async function setupBot(shopId: string, token: string, chatId: string, force = false) {
  // If there's already a setup in progress for this shop, wait for it
  if (pendingSetups[shopId]) {
    await pendingSetups[shopId];
  }

  // Create a new setup promise
  const setupPromise = (async () => {
    // If we already have a bot for this shop with the SAME token, do nothing
    if (!force && activeTokens[shopId] === token) {
      return;
    }

    // If we have a bot for this shop with a DIFFERENT token or forcing, stop it
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
    const otherShopId = Object.keys(activeTokens).find(id => id !== shopId && activeTokens[id] === token);
    if (otherShopId) {
      if (force) {
        console.log(`Token for shop ${shopId} is already in use by shop ${otherShopId}, but forcing setup. Stopping other bot...`);
        if (activeBots[otherShopId]) {
          try {
            await activeBots[otherShopId].stopPolling();
          } catch (e) {
            console.error(`Error stopping other bot for shop ${otherShopId}:`, e);
          }
          delete activeBots[otherShopId];
          delete activeTokens[otherShopId];
        }
      } else {
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
    }

    try {
      const bot = new TelegramBot(token, { polling: true });
      
      // Register error handlers to prevent unhandled exceptions from crashing the server
      bot.on('polling_error', (error) => {
        console.error(`[Telegram Bot Polling Error - Shop ${shopId}]:`, error.message);
      });
      bot.on('error', (error) => {
        console.error(`[Telegram Bot Error - Shop ${shopId}]:`, error.message);
      });

      const conversationState: Record<string, { step: string; data: any }> = {};
      
      bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id.toString();
        // Friendly welcome message showing user their Chat ID
        const welcomeMessage = `👋 *Welcome to our store!*\n\n• Use /inventory to browse available items.\n\n👤 *Your Telegram Chat ID:* \`${chatId}\`\n_(If you are the shop owner, copy this ID and save it in the Web App under Settings -> 'Personal Chat ID' to unlock full administrative features, daily sales reports, and create orders directly from here!)_`;
        
        bot.sendMessage(msg.chat.id, welcomeMessage, { parse_mode: 'Markdown' });
        
        // Track customer chat ID
        if (db && msg.from) {
          try {
            const customerId = `tg_${msg.from.id}`;
            const customerRef = doc(db, 'customers', customerId);
            const customerDoc = await getDoc(customerRef);
            
            let activeShopId = shopId;
            try {
              const settingsSnap = await getDocs(query(collection(db, 'settings'), where('telegramBotToken', '==', token)));
              if (!settingsSnap.empty) {
                const matchedByChatId = settingsSnap.docs.find(docSnap => {
                  const d = docSnap.data();
                  const pId = d.personalTelegramChatId ? d.personalTelegramChatId.toString().trim() : '';
                  const pubId = d.telegramChatId ? d.telegramChatId.toString().trim() : '';
                  return chatId === pId || chatId === pubId;
                });
                if (matchedByChatId) {
                  activeShopId = matchedByChatId.data().userId || matchedByChatId.id;
                }
              }
            } catch (err) {
              console.error('Error fetching settings for start command:', err);
            }

            const customerData: any = {
              id: customerId,
              userId: activeShopId,
              name: `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim() || 'Telegram User',
              telegram: msg.from.username ? `@${msg.from.username}` : undefined,
              telegramChatId: msg.chat.id.toString(),
              updatedAt: new Date().toISOString(),
            };
            
            if (!customerDoc.exists()) {
              customerData.totalSpend = 0;
              customerData.points = 0;
              customerData.vipStatus = 'none';
              customerData.createdAt = new Date().toISOString();
            }
            
            await setDoc(customerRef, customerData, { merge: true });
          } catch (error) {
            console.error('Error tracking customer:', error);
          }
        }
      });

      bot.onText(/\/inventory/, async (msg) => {
        if (!db) return;
        try {
          const chatId = msg.chat.id.toString();
          let activeShopId = shopId;
          
          try {
            const settingsSnap = await getDocs(query(collection(db, 'settings'), where('telegramBotToken', '==', token)));
            if (!settingsSnap.empty) {
              const matchedByChatId = settingsSnap.docs.find(docSnap => {
                const d = docSnap.data();
                const pId = d.personalTelegramChatId ? d.personalTelegramChatId.toString().trim() : '';
                const pubId = d.telegramChatId ? d.telegramChatId.toString().trim() : '';
                return chatId === pId || chatId === pubId;
              });
              if (matchedByChatId) {
                activeShopId = matchedByChatId.data().userId || matchedByChatId.id;
              }
            }
          } catch (err) {
            console.error('Error fetching settings for inventory command:', err);
          }

          const q = query(collection(db, 'inventory'), where('userId', '==', activeShopId));
          const snapshot = await getDocs(q);
          
          if (snapshot.empty) {
            bot.sendMessage(msg.chat.id, 'Our inventory is currently empty.');
            return;
          }

          await bot.sendMessage(msg.chat.id, '📦 *Fetching current inventory...*', { parse_mode: 'Markdown' });

          for (const doc of snapshot.docs) {
            const item = doc.data();
            if (item.quantityStocked > 0 && item.status !== 'ordered') {
              let caption = `📦 *${item.itemName}*\n`;
              caption += `💰 *Price:* ${item.sellingPriceETB} ETB\n`;
              caption += `📏 *Size:* ${item.size}\n`;
              caption += `🔢 *Stock:* ${item.quantityStocked}`;
              if (item.sheinSku && item.sheinSku !== 'N/A') {
                caption += `\n🏷️ *SKU:* \`${item.sheinSku}\``;
              }

              if (item.image && item.image.startsWith('data:')) {
                try {
                  const base64Data = item.image.split(';base64,').pop();
                  if (base64Data) {
                    const buffer = Buffer.from(base64Data, 'base64');
                    await bot.sendPhoto(msg.chat.id, buffer, {
                      caption: caption,
                      parse_mode: 'Markdown'
                    });
                    continue;
                  }
                } catch (imgErr) {
                  console.error('Error sending inventory item photo:', imgErr);
                }
              }

              // Fallback to text message if no image
              await bot.sendMessage(msg.chat.id, caption, { parse_mode: 'Markdown' });
            }
          }
        } catch (error) {
          console.error('Error fetching inventory for bot:', error);
          bot.sendMessage(msg.chat.id, 'Sorry, there was an error fetching the inventory.');
        }
      });

      // Handle message events for guided order flow (Admin Wizard)
      bot.on('message', async (msg) => {
        try {
          const chatId = msg.chat.id.toString();
          const text = msg.text ? msg.text.trim() : '';

          if (!db) return;

          // Fetch current settings to verify if this is the admin
          let settings: any = null;
          let activeShopId = shopId;
          try {
            console.log(`[Telegram Auth] Processing message from chatId "${chatId}". Starting authentication checks...`);
            
            // 1. First attempt: Direct get of the current shop's settings
            const directSnap = await getDoc(doc(db, 'settings', shopId));
            if (directSnap.exists()) {
              const d = directSnap.data();
              const pId = d.personalTelegramChatId ? d.personalTelegramChatId.toString().trim() : '';
              const pubId = d.telegramChatId ? d.telegramChatId.toString().trim() : '';
              console.log(`[Telegram Auth] Direct settings document for shopId "${shopId}" exists. personalId: "${pId}", publicId: "${pubId}"`);
              if (chatId === pId || chatId === pubId) {
                console.log(`[Telegram Auth] Direct match succeeded for chatId "${chatId}"`);
                settings = d;
                activeShopId = d.userId || shopId;
              }
            }

            // 2. Second attempt: Query settings matching the bot token
            if (!settings) {
              console.log(`[Telegram Auth] Direct match did not succeed or document missing. Querying by bot token...`);
              const settingsSnap = await getDocs(query(collection(db, 'settings'), where('telegramBotToken', '==', token)));
              if (!settingsSnap.empty) {
                console.log(`[Telegram Auth] Found ${settingsSnap.size} settings documents matching this bot token`);
                
                // Look for one matching sender's chatId
                const matchedByChatId = settingsSnap.docs.find(docSnap => {
                  const d = docSnap.data();
                  const pId = d.personalTelegramChatId ? d.personalTelegramChatId.toString().trim() : '';
                  const pubId = d.telegramChatId ? d.telegramChatId.toString().trim() : '';
                  return chatId === pId || chatId === pubId;
                });

                if (matchedByChatId) {
                  console.log(`[Telegram Auth] Token-matched document found with matching chatId "${chatId}" (Doc ID: "${matchedByChatId.id}")`);
                  settings = matchedByChatId.data();
                  activeShopId = settings.userId || matchedByChatId.id;
                } else {
                  console.log(`[Telegram Auth] No token-matched document matches chatId "${chatId}". Falling back to shopId/first document...`);
                  // Fallback: match closure's shopId
                  const matchedByShopId = settingsSnap.docs.find(docSnap => docSnap.id === shopId || docSnap.data().userId === shopId);
                  if (matchedByShopId) {
                    settings = matchedByShopId.data();
                    activeShopId = settings.userId || matchedByShopId.id;
                  } else {
                    settings = settingsSnap.docs[0].data();
                    activeShopId = settings.userId || settingsSnap.docs[0].id;
                  }
                }
              }
            }

            // 3. Third attempt: Global scan of all settings to find ANY document matching this chatId
            // This is a failsafe in case of token mismatches or multiple registered configurations
            const currentPersonalId = settings?.personalTelegramChatId ? settings.personalTelegramChatId.toString().trim() : '';
            const currentPublicId = settings?.telegramChatId ? settings.telegramChatId.toString().trim() : '';
            
            if (!settings || (chatId !== currentPersonalId && chatId !== currentPublicId)) {
              console.log(`[Telegram Auth] Active settings does not match chatId "${chatId}". Performing global scan...`);
              const allSettingsSnap = await getDocs(collection(db, 'settings'));
              const globalMatch = allSettingsSnap.docs.find(docSnap => {
                const d = docSnap.data();
                const pId = d.personalTelegramChatId ? d.personalTelegramChatId.toString().trim() : '';
                const pubId = d.telegramChatId ? d.telegramChatId.toString().trim() : '';
                return chatId === pId || chatId === pubId;
              });

              if (globalMatch) {
                console.log(`[Telegram Auth] Found global settings match for chatId "${chatId}" in doc "${globalMatch.id}"`);
                settings = globalMatch.data();
                activeShopId = settings.userId || globalMatch.id;
              }
            }
          } catch (err) {
            console.error('[Telegram Auth] Error during multi-layered settings retrieval:', err);
            // Emergency fallback to direct settings document
            try {
              const directSnap = await getDoc(doc(db, 'settings', shopId));
              if (directSnap.exists()) {
                settings = directSnap.data();
                activeShopId = settings.userId || shopId;
              }
            } catch (fallbackErr) {
              console.error('[Telegram Auth] Error in emergency direct settings fallback:', fallbackErr);
            }
          }

          if (!settings) {
            console.warn(`[Telegram Auth] No settings resolved for shop "${shopId}". Ignoring message.`);
            return;
          }

          const personalId = settings.personalTelegramChatId ? settings.personalTelegramChatId.toString().trim() : '';
          const publicId = settings.telegramChatId ? settings.telegramChatId.toString().trim() : '';
          const isAdmin = chatId === personalId || chatId === publicId;
          
          console.log(`[Telegram Auth] Evaluation results: chatId="${chatId}", personalId="${personalId}", publicId="${publicId}", isAdmin=${isAdmin}, activeShopId="${activeShopId}"`);

          // Normalize and check commands
          const cleanText = text.toLowerCase();
          const isAddOrder = cleanText === '/addorder' || cleanText === '/createorder' || 
                            cleanText.startsWith('/addorder ') || cleanText.startsWith('/createorder ') ||
                            cleanText.startsWith('/addorder@') || cleanText.startsWith('/createorder@');
          
          const isCancel = cleanText === '/cancel' || cleanText.startsWith('/cancel ') || cleanText.startsWith('/cancel@');
          const isStart = cleanText === '/start' || cleanText.startsWith('/start ') || cleanText.startsWith('/start@');
          const isInventory = cleanText === '/inventory' || cleanText.startsWith('/inventory ') || cleanText.startsWith('/inventory@');

          if (!isAdmin) {
            if (isAddOrder) {
              await bot.sendMessage(chatId, `⚠️ *Admin Access Required*\n\nThis command is reserved for the shop owner.\n\nTo authorize your account, please copy your Telegram Chat ID: \`${chatId}\` and save it in the Web App under *Settings -> Personal Chat ID (For Private Reports)*, click *Save Settings*, and then try again!`, { parse_mode: 'Markdown' });
            }
            return; // Ignore other general customer messages
          }

          // Global commands for admin
          if (isCancel) {
            delete conversationState[chatId];
            await bot.sendMessage(chatId, '❌ Order creation cancelled.', {
              reply_markup: { remove_keyboard: true }
            });
            return;
          }

          if (isAddOrder) {
            conversationState[chatId] = {
              step: 'await_item_name',
              data: {
                status: 'ordered',
                quantityStocked: 1,
                buyingPriceUSD: 0,
                exchangeRate: 0,
                shippingCostETB: 0,
                customsTaxETB: 0,
                localDeliveryFeeETB: 0,
                totalCostPriceETB: 0,
                sellingPriceETB: 0,
                customerName: '',
                customerPhone: '',
                customerTelegram: '',
                prePaymentETB: 0,
                image: '',
              }
            };
            await bot.sendMessage(chatId, '📝 *Let\'s create a new order.*\n\n✏️ Please enter the *Item Name*: (or type /cancel to quit)', {
              parse_mode: 'Markdown',
              reply_markup: { remove_keyboard: true }
            });
            return;
          }

          // Check if admin is currently in a wizard flow
          const state = conversationState[chatId];
          if (!state) {
            if (text.startsWith('/') && !isStart && !isInventory) {
              await bot.sendMessage(chatId, '💡 *Available Admin Commands:*\n\n• /addorder - Create a new order step-by-step\n• /inventory - View current inventory\n• /cancel - Cancel current operation', { parse_mode: 'Markdown' });
            }
            return;
          }

          // Avoid duplicate execution if start/inventory command was sent
          if (isStart || isInventory) {
            delete conversationState[chatId];
            return;
          }

        // Process wizard steps
        switch (state.step) {
          case 'await_item_name':
            if (!text) {
              await bot.sendMessage(chatId, '⚠️ Name cannot be empty. Please enter the *Item Name*:');
              return;
            }
            state.data.itemName = text;
            state.step = 'await_image';
            await bot.sendMessage(chatId, `Item Name: *${text}*\n\n🖼️ Please send a *Photo/Image* of the item, or send /skip if you don't have one:`, { parse_mode: 'Markdown' });
            break;

          case 'await_image':
            const isPhoto = msg.photo && msg.photo.length > 0;
            const isDocPhoto = msg.document && msg.document.mime_type && msg.document.mime_type.startsWith('image/');

            if (isPhoto || isDocPhoto) {
              try {
                await bot.sendMessage(chatId, '📥 Processing photo... Please wait a moment.');
                const fileId = isPhoto ? msg.photo![msg.photo!.length - 1].file_id : msg.document!.file_id;
                const fileInfo = await bot.getFile(fileId);
                const filePath = fileInfo.file_path;
                
                if (filePath) {
                  const fileUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
                  const fileResponse = await fetch(fileUrl);
                  const arrayBuffer = await fileResponse.arrayBuffer();
                  const base64Str = Buffer.from(arrayBuffer).toString('base64');
                  const mimeType = fileResponse.headers.get('content-type') || 'image/jpeg';
                  
                  state.data.image = `data:${mimeType};base64,${base64Str}`;
                  await bot.sendMessage(chatId, '✅ Photo received and successfully saved!');
                } else {
                  await bot.sendMessage(chatId, '⚠️ Could not resolve photo file path. Skipping photo.');
                }
              } catch (photoErr) {
                console.error('[Telegram Bot] Error downloading photo:', photoErr);
                await bot.sendMessage(chatId, '⚠️ Error downloading photo. Skipping photo.');
              }
              
              state.step = 'await_sku';
              await bot.sendMessage(chatId, `🏷️ Please enter the *Shein SKU* (e.g. sku123, or send /skip):`, { parse_mode: 'Markdown' });
            } else if (cleanText === '/skip') {
              state.step = 'await_sku';
              await bot.sendMessage(chatId, `🏷️ Please enter the *Shein SKU* (e.g. sku123, or send /skip):`, { parse_mode: 'Markdown' });
            } else {
              await bot.sendMessage(chatId, '⚠️ Please send a valid *Photo/Image*, or type /skip to skip this step:');
            }
            break;

          case 'await_sku':
            state.data.sheinSku = text === '/skip' ? 'N/A' : text || 'N/A';
            state.step = 'await_category';
            await bot.sendMessage(chatId, `SKU: *${state.data.sheinSku}*\n\n📦 Please select or enter the *Category* (Top, Dress, Trouser, Bra, Other):`, {
              reply_markup: {
                keyboard: [
                  [{ text: 'Top' }, { text: 'Dress' }],
                  [{ text: 'Trouser' }, { text: 'Bra' }],
                  [{ text: 'Other' }]
                ],
                one_time_keyboard: true,
                resize_keyboard: true
              }
            });
            break;

          case 'await_category':
            const validCategories = ['Top', 'Dress', 'Trouser', 'Bra', 'Other'];
            let category = text;
            if (!validCategories.includes(category)) {
              category = 'Other';
            }
            state.data.category = category;
            state.step = 'await_size';
            
            if (category === 'Other') {
              await bot.sendMessage(chatId, `Category: *${category}*\n\n📏 Please enter the *Size* (e.g. 38, 100ml, M):`, {
                reply_markup: { remove_keyboard: true }
              });
            } else {
              await bot.sendMessage(chatId, `Category: *${category}*\n\n📏 Please select or enter the *Size*:`, {
                reply_markup: {
                  keyboard: [
                    [{ text: 'XS' }, { text: 'S' }, { text: 'M' }],
                    [{ text: 'L' }, { text: 'XL' }, { text: 'XXL' }],
                    [{ text: 'One Size' }]
                  ],
                  one_time_keyboard: true,
                  resize_keyboard: true
                }
              });
            }
            break;

          case 'await_size':
            state.data.size = text || 'Free Size';
            state.step = 'await_quantity';
            await bot.sendMessage(chatId, `Size: *${state.data.size}*\n\n🔢 Please enter the *Quantity* (or select below):`, {
              reply_markup: {
                keyboard: [
                  [{ text: '1' }, { text: '2' }, { text: '3' }]
                ],
                one_time_keyboard: true,
                resize_keyboard: true
              }
            });
            break;

          case 'await_quantity':
            const qty = parseInt(text, 10);
            if (isNaN(qty) || qty <= 0) {
              await bot.sendMessage(chatId, '⚠️ Quantity must be a valid positive number. Please enter the *Quantity*:');
              return;
            }
            state.data.quantityStocked = qty;
            state.step = 'await_buying_price';
            await bot.sendMessage(chatId, `Quantity: *${qty}*\n\n💵 Please enter the *Buying Price in USD* (or select 0):`, {
              reply_markup: {
                keyboard: [
                  [{ text: '0' }]
                ],
                one_time_keyboard: true,
                resize_keyboard: true
              }
            });
            break;

          case 'await_buying_price':
            const buyingPrice = parseFloat(text === '/skip' ? '0' : text);
            if (isNaN(buyingPrice) || buyingPrice < 0) {
              await bot.sendMessage(chatId, '⚠️ Price must be a positive number. Please enter the *Buying Price in USD*:');
              return;
            }
            state.data.buyingPriceUSD = buyingPrice;
            
            if (buyingPrice > 0) {
              state.step = 'await_exchange_rate';
              await bot.sendMessage(chatId, `Buying Price: *$${buyingPrice}*\n\n💱 Please enter the *Exchange Rate* (USD to ETB, e.g. 115):`, {
                reply_markup: { remove_keyboard: true }
              });
            } else {
              state.data.exchangeRate = 0;
              state.step = 'await_shipping';
              await bot.sendMessage(chatId, `Buying Price: *$0*\n\n🚢 Please enter the *Shipping Cost in ETB* per item (or select 0):`, {
                reply_markup: {
                  keyboard: [
                    [{ text: '0' }]
                  ],
                  one_time_keyboard: true,
                  resize_keyboard: true
                }
              });
            }
            break;

          case 'await_exchange_rate':
            const exRate = parseFloat(text);
            if (isNaN(exRate) || exRate < 0) {
              await bot.sendMessage(chatId, '⚠️ Exchange rate must be a positive number. Please enter the *Exchange Rate*:');
              return;
            }
            state.data.exchangeRate = exRate;
            state.step = 'await_shipping';
            await bot.sendMessage(chatId, `Exchange Rate: *${exRate} ETB/USD*\n\n🚢 Please enter the *Shipping Cost in ETB* per item (or select 0):`, {
              reply_markup: {
                keyboard: [
                  [{ text: '0' }]
                ],
                one_time_keyboard: true,
                resize_keyboard: true
              }
            });
            break;

          case 'await_shipping':
            const shipping = parseFloat(text === '/skip' || text === '0' ? '0' : text);
            if (isNaN(shipping) || shipping < 0) {
              await bot.sendMessage(chatId, '⚠️ Shipping cost must be a positive number. Please enter the *Shipping Cost*:');
              return;
            }
            state.data.shippingCostETB = shipping;
            state.step = 'await_customs';
            await bot.sendMessage(chatId, `Shipping: *${shipping} ETB*\n\n🏛️ Please enter the *Customs/Tax in ETB* (or select 0):`, {
              reply_markup: {
                keyboard: [
                  [{ text: '0' }]
                ],
                one_time_keyboard: true,
                resize_keyboard: true
              }
            });
            break;

          case 'await_customs':
            const customs = parseFloat(text === '/skip' || text === '0' ? '0' : text);
            if (isNaN(customs) || customs < 0) {
              await bot.sendMessage(chatId, '⚠️ Customs must be a positive number. Please enter the *Customs/Tax*:');
              return;
            }
            state.data.customsTaxETB = customs;
            state.step = 'await_local_delivery';
            await bot.sendMessage(chatId, `Customs/Tax: *${customs} ETB*\n\n🛵 Please enter the *Local Delivery Fee in ETB* (or select 0):`, {
              reply_markup: {
                keyboard: [
                  [{ text: '0' }]
                ],
                one_time_keyboard: true,
                resize_keyboard: true
              }
            });
            break;

          case 'await_local_delivery':
            const localDeliv = parseFloat(text === '/skip' || text === '0' ? '0' : text);
            if (isNaN(localDeliv) || localDeliv < 0) {
              await bot.sendMessage(chatId, '⚠️ Delivery fee must be a positive number. Please enter the *Local Delivery Fee*:');
              return;
            }
            state.data.localDeliveryFeeETB = localDeliv;
            
            // Calculate total cost price
            const calculatedCost = (state.data.buyingPriceUSD * state.data.exchangeRate) + 
                                    state.data.shippingCostETB + 
                                    state.data.customsTaxETB + 
                                    state.data.localDeliveryFeeETB;
            state.data.totalCostPriceETB = parseFloat(calculatedCost.toFixed(2));
            
            state.step = 'await_selling_price';
            await bot.sendMessage(chatId, `Local Delivery: *${localDeliv} ETB*\nEstimated Cost: *${state.data.totalCostPriceETB} ETB*\n\n💰 Please enter the *Selling Price in ETB*:`, {
              reply_markup: { remove_keyboard: true }
            });
            break;

          case 'await_selling_price':
            const sellingPrice = parseFloat(text);
            if (isNaN(sellingPrice) || sellingPrice <= 0) {
              await bot.sendMessage(chatId, '⚠️ Selling price must be a valid positive number. Please enter the *Selling Price*:');
              return;
            }
            state.data.sellingPriceETB = sellingPrice;
            state.step = 'await_customer_name';
            await bot.sendMessage(chatId, `Selling Price: *${sellingPrice} ETB*\n\n👤 Please enter the *Customer Name* (or send /skip):`, {
              reply_markup: { remove_keyboard: true }
            });
            break;

          case 'await_customer_name':
            state.data.customerName = text === '/skip' ? '' : text;
            state.step = 'await_customer_phone';
            await bot.sendMessage(chatId, `Customer Name: *${state.data.customerName || 'None'}*\n\n📞 Please enter the *Customer Phone Number* (or send /skip):`, {
              reply_markup: { remove_keyboard: true }
            });
            break;

          case 'await_customer_phone':
            state.data.customerPhone = text === '/skip' ? '' : text;
            state.step = 'await_customer_telegram';
            await bot.sendMessage(chatId, `Customer Phone: *${state.data.customerPhone || 'None'}*\n\n💬 Please enter the *Customer Telegram Username* (with or without @, or send /skip):`, {
              reply_markup: { remove_keyboard: true }
            });
            break;

          case 'await_customer_telegram':
            let tg = text === '/skip' ? '' : text;
            if (tg && !tg.startsWith('@')) {
              tg = '@' + tg;
            }
            state.data.customerTelegram = tg;
            state.step = 'await_prepayment';
            await bot.sendMessage(chatId, `Customer Telegram: *${tg || 'None'}*\n\n💳 Please enter the *Pre-payment in ETB* (or select 0):`, {
              reply_markup: {
                keyboard: [
                  [{ text: '0' }]
                ],
                one_time_keyboard: true,
                resize_keyboard: true
              }
            });
            break;

          case 'await_prepayment':
            const prePay = parseFloat(text === '/skip' || text === '0' ? '0' : text);
            if (isNaN(prePay) || prePay < 0) {
              await bot.sendMessage(chatId, '⚠️ Pre-payment must be a positive number. Please enter the *Pre-payment*:');
              return;
            }
            state.data.prePaymentETB = prePay;
            state.step = 'await_confirm';

            // Show order summary
            let summary = `📋 *Order Confirmation*\n\n`;
            summary += `• *Item:* ${state.data.itemName}\n`;
            summary += `• *SKU:* ${state.data.sheinSku}\n`;
            summary += `• *Category:* ${state.data.category}\n`;
            summary += `• *Size:* ${state.data.size}\n`;
            summary += `• *Quantity:* ${state.data.quantityStocked}\n`;
            summary += `• *Cost Price:* ${state.data.totalCostPriceETB} ETB\n`;
            summary += `• *Selling Price:* ${state.data.sellingPriceETB} ETB\n`;
            summary += `• *Profit:* ${(state.data.sellingPriceETB - state.data.totalCostPriceETB).toFixed(2)} ETB\n\n`;
            summary += `👤 *Customer Info:*\n`;
            summary += `• *Name:* ${state.data.customerName || 'N/A'}\n`;
            summary += `• *Phone:* ${state.data.customerPhone || 'N/A'}\n`;
            summary += `• *Telegram:* ${state.data.customerTelegram || 'N/A'}\n`;
            summary += `• *Pre-payment:* ${state.data.prePaymentETB} ETB\n`;
            summary += `• *Balance Due:* ${state.data.sellingPriceETB - state.data.prePaymentETB} ETB\n\n`;
            summary += `Ready to create? Select *Yes, Create Order* or *Cancel*.`;

            await bot.sendMessage(chatId, summary, {
              parse_mode: 'Markdown',
              reply_markup: {
                keyboard: [
                  [{ text: 'Yes, Create Order' }],
                  [{ text: 'Cancel' }]
                ],
                one_time_keyboard: true,
                resize_keyboard: true
              }
            });
            break;

          case 'await_confirm':
            if (text === 'Yes, Create Order') {
              try {
                const id = Math.random().toString(36).substring(2, 9);
                
                const newItem = {
                  id,
                  userId: activeShopId,
                  itemName: state.data.itemName,
                  sheinSku: state.data.sheinSku,
                  category: state.data.category,
                  size: state.data.size,
                  quantityStocked: state.data.quantityStocked,
                  buyingPriceUSD: state.data.buyingPriceUSD,
                  exchangeRate: state.data.exchangeRate,
                  shippingCostETB: state.data.shippingCostETB,
                  customsTaxETB: state.data.customsTaxETB,
                  localDeliveryFeeETB: state.data.localDeliveryFeeETB,
                  totalCostPriceETB: state.data.totalCostPriceETB,
                  sellingPriceETB: state.data.sellingPriceETB,
                  status: 'ordered',
                  customerName: state.data.customerName || '',
                  customerPhone: state.data.customerPhone || '',
                  customerTelegram: state.data.customerTelegram || '',
                  prePaymentETB: state.data.prePaymentETB,
                  image: state.data.image || '',
                  dateAdded: new Date().toISOString()
                };

                await setDoc(doc(db, 'inventory', id), newItem);

                // Also auto-track/update customer
                if (state.data.customerName) {
                  try {
                    const customerId = state.data.customerPhone ? `phone_${state.data.customerPhone}` : `name_${state.data.customerName.replace(/[^a-zA-Z0-9]/g, '_')}`;
                    const customerRef = doc(db, 'customers', customerId);
                    const customerDoc = await getDoc(customerRef);
                    
                    let newSpend = state.data.prePaymentETB || 0;
                    let newPoints = Math.floor(newSpend / 100);
                    let createdAt = new Date().toISOString();
                    
                    if (customerDoc.exists()) {
                      const existing = customerDoc.data();
                      newSpend = (existing.totalSpend || 0) + newSpend;
                      newPoints = (existing.points || 0) + newPoints;
                      createdAt = existing.createdAt || createdAt;
                    }
                    
                    let newVipStatus = 'none';
                    if (newSpend >= 10000) newVipStatus = 'gold';
                    else if (newSpend >= 5000) newVipStatus = 'silver';
                    else if (newSpend >= 2000) newVipStatus = 'bronze';

                    await setDoc(customerRef, {
                      id: customerId,
                      userId: activeShopId,
                      name: state.data.customerName,
                      phone: state.data.customerPhone || '',
                      telegram: state.data.customerTelegram || '',
                      totalSpend: newSpend,
                      points: newPoints,
                      vipStatus: newVipStatus,
                      createdAt,
                      updatedAt: new Date().toISOString()
                    }, { merge: true });
                  } catch (customerErr) {
                    console.error('Error auto-creating customer from bot:', customerErr);
                  }
                }

                await bot.sendMessage(chatId, `🎉 *Order Created Successfully!*\nID: *${id}*`, {
                  parse_mode: 'Markdown',
                  reply_markup: { remove_keyboard: true }
                });
              } catch (err) {
                console.error('Error saving order from bot:', err);
                await bot.sendMessage(chatId, '❌ Error saving order to database. Please try again.', {
                  reply_markup: { remove_keyboard: true }
                });
              } finally {
                delete conversationState[chatId];
              }
            } else {
              delete conversationState[chatId];
              await bot.sendMessage(chatId, '❌ Order creation cancelled.', {
                reply_markup: { remove_keyboard: true }
              });
            }
            break;
        }
        } catch (err) {
          console.error(`Error processing message in Telegram bot for shop ${shopId}:`, err);
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

// Initial startup bot setup and settings changes listener
if (db) {
  // 1. Initial startup load of settings to start all saved bots immediately
  getDocs(collection(db, 'settings')).then((snapshot) => {
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const shopId = data.userId;
      if (shopId && data.telegramBotToken) {
        console.log(`Initial startup: setting up bot for shop ${shopId}...`);
        setupBot(shopId, data.telegramBotToken, data.telegramChatId).catch(err => {
          console.error(`Error in initial bot startup for shop ${shopId}:`, err);
        });
      }
    });
  }).catch((error) => {
    console.error('Error fetching initial settings for bots:', error);
  });

  // 2. Real-time changes listener with error handler to prevent crashing
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
  }, (error) => {
    console.error('Settings collection listener disconnected or timed out (expected in serverless idle environments):', error);
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

  // Manual telegram bot setup and sync endpoint
  server.post('/api/telegram/sync-settings', async (req, res) => {
    const { shopId, telegramBotToken, telegramChatId } = req.body;
    if (!shopId) {
      return res.status(400).json({ error: 'shopId is required' });
    }
    try {
      console.log(`Manual bot sync request received for shop ${shopId}...`);
      if (telegramBotToken) {
        // Use force=true to ensure existing instances are replaced and new polling starts
        await setupBot(shopId, telegramBotToken, telegramChatId, true);
        console.log(`Bot initialized successfully for shop ${shopId}`);
        res.json({ success: true, message: 'Bot started successfully!' });
      } else {
        if (activeBots[shopId]) {
          await activeBots[shopId].stopPolling();
          delete activeBots[shopId];
          delete activeTokens[shopId];
          console.log(`Bot stopped successfully for shop ${shopId}`);
        }
        res.json({ success: true, message: 'Bot stopped because token was removed.' });
      }
    } catch (err: any) {
      console.error(`Error in /api/telegram/sync-settings for shop ${shopId}:`, err);
      res.status(500).json({ error: err.message || 'Failed to initialize bot' });
    }
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
