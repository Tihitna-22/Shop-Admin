import React, { useState, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import { Send, Save, User } from 'lucide-react';

export function Settings() {
  const { settings, updateSettings } = useInventory();
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [personalChatId, setPersonalChatId] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [autoPost, setAutoPost] = useState(false);
  const [autoPostTemplate, setAutoPostTemplate] = useState('');
  const [shopName, setShopName] = useState('');
  const [shopDescription, setShopDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    if (settings) {
      setBotToken(settings.telegramBotToken || '');
      setChatId(settings.telegramChatId || '');
      setPersonalChatId(settings.personalTelegramChatId || '');
      setTelegramUsername(settings.telegramUsername || '');
      setAutoPost(settings.autoPostToTelegram || false);
      setAutoPostTemplate(settings.autoPostTemplate || '✨ *New Arrival!* ✨\n\n🛍️ *{itemName}*\n💰 Price: *{price} ETB*\n📏 Size: *{size}*\n🏷️ Category: *{category}*\n\nDM @{telegramUsername} to order!');
      setShopName(settings.shopName || '');
      setShopDescription(settings.shopDescription || '');
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage('');
    
    try {
      await updateSettings({
        telegramBotToken: botToken,
        telegramChatId: chatId,
        personalTelegramChatId: personalChatId,
        telegramUsername: telegramUsername,
        autoPostToTelegram: autoPost,
        autoPostTemplate: autoPostTemplate,
        shopName,
        shopDescription,
      });
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      setSaveMessage('Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl md:col-span-2">
        <div className="px-4 py-6 sm:p-8">
          <div className="flex items-center gap-x-3 mb-6">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Send className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold leading-7 text-gray-900">Telegram Integration</h2>
          </div>
          
          <p className="text-sm leading-6 text-gray-600 mb-6">
            Automatically post new inventory items to your Telegram channel. You need to create a bot using BotFather and add it as an administrator to your channel.
          </p>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="border-b border-gray-900/10 pb-6 mb-6">
              <h3 className="text-lg font-semibold leading-7 text-gray-900 mb-4">Shop Details</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="shopName" className="block text-sm font-medium leading-6 text-gray-900">
                    Shop Name
                  </label>
                  <div className="mt-2">
                    <input
                      type="text"
                      id="shopName"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder="e.g. My Fashion Store"
                      className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-black sm:text-sm sm:leading-6 px-3"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="shopDescription" className="block text-sm font-medium leading-6 text-gray-900">
                    Shop Description
                  </label>
                  <div className="mt-2">
                    <textarea
                      id="shopDescription"
                      rows={3}
                      value={shopDescription}
                      onChange={(e) => setShopDescription(e.target.value)}
                      placeholder="e.g. Curated fashion pieces direct from My Fashion Store. Premium quality, available locally."
                      className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-black sm:text-sm sm:leading-6 px-3"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="botToken" className="block text-sm font-medium leading-6 text-gray-900">
                Bot Token
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  id="botToken"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="e.g. 1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-black sm:text-sm sm:leading-6 px-3"
                />
              </div>
            </div>

            <div>
              <label htmlFor="chatId" className="block text-sm font-medium leading-6 text-gray-900">
                Channel ID or Username (Public)
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  id="chatId"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="e.g. @Mirafashion22 or -1001234567890"
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-black sm:text-sm sm:leading-6 px-3"
                />
              </div>
            </div>

            <div>
              <label htmlFor="personalChatId" className="block text-sm font-medium leading-6 text-gray-900">
                Personal Chat ID (For Private Reports)
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  id="personalChatId"
                  value={personalChatId}
                  onChange={(e) => setPersonalChatId(e.target.value)}
                  placeholder="e.g. 123456789"
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-black sm:text-sm sm:leading-6 px-3"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Daily sales reports will be sent here instead of the public channel.
              </p>
            </div>

            <div>
              <label htmlFor="telegramUsername" className="block text-sm font-medium leading-6 text-gray-900">
                Bot Username (Optional)
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  id="telegramUsername"
                  value={telegramUsername}
                  onChange={(e) => setTelegramUsername(e.target.value)}
                  placeholder="e.g. MyStoreBot"
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-black sm:text-sm sm:leading-6 px-3"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Used to generate links for your customers.
              </p>
            </div>

            <div className="flex items-center gap-x-3">
              <input
                id="autoPost"
                type="checkbox"
                checked={autoPost}
                onChange={(e) => setAutoPost(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
              />
              <label htmlFor="autoPost" className="text-sm font-medium leading-6 text-gray-900">
                Automatically post to Telegram when a new item is added
              </label>
            </div>

            {autoPost && (
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <label htmlFor="autoPostTemplate" className="block text-sm font-medium leading-6 text-gray-900 mb-2">
                  Auto-Post Message Template
                </label>
                <textarea
                  id="autoPostTemplate"
                  rows={6}
                  value={autoPostTemplate}
                  onChange={(e) => setAutoPostTemplate(e.target.value)}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-black sm:text-sm sm:leading-6 px-3 font-mono"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-[10px] bg-white px-2 py-1 rounded border border-gray-200 text-gray-500">{'{itemName}'}</span>
                  <span className="text-[10px] bg-white px-2 py-1 rounded border border-gray-200 text-gray-500">{'{price}'}</span>
                  <span className="text-[10px] bg-white px-2 py-1 rounded border border-gray-200 text-gray-500">{'{size}'}</span>
                  <span className="text-[10px] bg-white px-2 py-1 rounded border border-gray-200 text-gray-500">{'{category}'}</span>
                  <span className="text-[10px] bg-white px-2 py-1 rounded border border-gray-200 text-gray-500">{'{sku}'}</span>
                  <span className="text-[10px] bg-white px-2 py-1 rounded border border-gray-200 text-gray-500">{'{telegramUsername}'}</span>
                </div>
                <p className="mt-2 text-[10px] text-gray-400 uppercase tracking-widest">
                  Placeholders will be replaced with actual item values.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-gray-900/10 pt-6">
              <p className={`text-sm ${saveMessage.includes('Failed') ? 'text-red-600' : 'text-emerald-600'}`}>
                {saveMessage}
              </p>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center rounded-md bg-black px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:opacity-50"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
