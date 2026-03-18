import React, { useState, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import { Send, Save } from 'lucide-react';

export function Settings() {
  const { settings, updateSettings } = useInventory();
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [autoPost, setAutoPost] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    if (settings) {
      setBotToken(settings.telegramBotToken || '');
      setChatId(settings.telegramChatId || '');
      setAutoPost(settings.autoPostToTelegram || false);
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
        autoPostToTelegram: autoPost,
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
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-black sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            <div>
              <label htmlFor="chatId" className="block text-sm font-medium leading-6 text-gray-900">
                Channel ID or Username
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  id="chatId"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="e.g. @Mirafashion22 or -1001234567890"
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-black sm:text-sm sm:leading-6"
                />
              </div>
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
