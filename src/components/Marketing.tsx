import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { Send, Users, MessageSquare, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export function Marketing() {
  const { customers, userId, settings } = useInventory();
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [broadcastToChannel, setBroadcastToChannel] = useState(true);
  const [sendToPrivateBots, setSendToPrivateBots] = useState(false);
  const [sendSMS, setSendSMS] = useState(false);
  const [status, setStatus] = useState<{ success: number; failed: number; channelBroadcast?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const telegramCustomers = customers.filter(c => c.telegramChatId);
  const smsCustomers = customers.filter(c => c.phone);

  const handleSendBulk = async () => {
    if (!message.trim()) return;
    
    if (!broadcastToChannel && !sendToPrivateBots && !sendSMS) {
      setError('Please select at least one delivery method.');
      return;
    }

    setIsSending(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch('/api/bulk-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: userId,
          message,
          customerIds: sendToPrivateBots ? telegramCustomers.map(c => c.id) : [],
          broadcastToChannel,
          sendSMS // Backend will handle this as a placeholder for now
        })
      });

      const data = await response.json();
      if (response.ok) {
        setStatus(data.results);
        setMessage('');
      } else {
        setError(data.error || 'Failed to send messages');
      }
    } catch (err) {
      setError('An error occurred while sending messages');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-serif font-semibold text-gray-900">Marketing Tools</h2>
        <p className="text-sm text-gray-500 mt-1">Connect with your customers and grow your brand</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Total Customers</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Send className="h-5 w-5 text-[#2AABEE]" />
            <h3 className="font-semibold text-gray-900">Telegram Reach</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{telegramCustomers.length}</p>
          <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">Private Bot Users</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <MessageSquare className="h-5 w-5 text-emerald-600" />
            <h3 className="font-semibold text-gray-900">SMS Reach</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">{smsCustomers.length}</p>
          <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">With Phone Numbers</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Bulk Message Campaign</h3>
          <p className="text-sm text-gray-500">Send an announcement to your channel, private bot users, or via SMS.</p>
        </div>
        
        <div className="p-6 space-y-6">
          {!settings?.telegramBotToken && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800">
                Telegram bot not configured. Please go to <span className="font-bold">Settings</span> to set up your bot token first.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => setBroadcastToChannel(!broadcastToChannel)}
              className={`p-4 rounded-xl border-2 transition-all text-left ${
                broadcastToChannel ? 'border-[#a94442] bg-red-50' : 'border-gray-100 bg-white'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <Send className={`h-5 w-5 ${broadcastToChannel ? 'text-[#a94442]' : 'text-gray-400'}`} />
                <div className={`h-4 w-4 rounded-full border-2 ${broadcastToChannel ? 'bg-[#a94442] border-[#a94442]' : 'border-gray-200'}`} />
              </div>
              <p className="font-semibold text-sm text-gray-900">Public Channel</p>
              <p className="text-xs text-gray-500 mt-1">Broadcast to all members</p>
            </button>

            <button
              onClick={() => setSendToPrivateBots(!sendToPrivateBots)}
              className={`p-4 rounded-xl border-2 transition-all text-left ${
                sendToPrivateBots ? 'border-[#a94442] bg-red-50' : 'border-gray-100 bg-white'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <Users className={`h-5 w-5 ${sendToPrivateBots ? 'text-[#a94442]' : 'text-gray-400'}`} />
                <div className={`h-4 w-4 rounded-full border-2 ${sendToPrivateBots ? 'bg-[#a94442] border-[#a94442]' : 'border-gray-200'}`} />
              </div>
              <p className="font-semibold text-sm text-gray-900">Private Bots</p>
              <p className="text-xs text-gray-500 mt-1">{telegramCustomers.length} tracked users</p>
            </button>

            <button
              onClick={() => setSendSMS(!sendSMS)}
              className={`p-4 rounded-xl border-2 transition-all text-left ${
                sendSMS ? 'border-[#a94442] bg-red-50' : 'border-gray-100 bg-white'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <MessageSquare className={`h-5 w-5 ${sendSMS ? 'text-[#a94442]' : 'text-gray-400'}`} />
                <div className={`h-4 w-4 rounded-full border-2 ${sendSMS ? 'bg-[#a94442] border-[#a94442]' : 'border-gray-200'}`} />
              </div>
              <p className="font-semibold text-sm text-gray-900">Bulk SMS</p>
              <p className="text-xs text-gray-500 mt-1">{smsCustomers.length} customers</p>
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Message Content</label>
            <textarea
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="✨ New Collection Alert! ✨\n\nCheck out our latest arrivals at our store. Use code NEW10 for 10% off!"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#a94442] focus:border-transparent outline-none resize-none"
            />
            <p className="text-[10px] text-gray-400 mt-2 uppercase tracking-widest">Supports Markdown formatting</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {status && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm text-emerald-800 font-medium">Campaign Sent!</p>
                <div className="text-xs text-emerald-700 mt-1 space-y-1">
                  {status.channelBroadcast && <p>• Broadcasted to public channel</p>}
                  {status.success > 0 && <p>• Sent to {status.success} private bot users</p>}
                  {status.failed > 0 && <p>• Failed for {status.failed} private users</p>}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleSendBulk}
              disabled={isSending || !message.trim() || !settings?.telegramBotToken}
              className="flex items-center gap-2 px-6 py-3 bg-[#a94442] text-white rounded-lg hover:bg-[#8a3634] transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Launch Campaign
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Marketing Tips</h3>
          <ul className="space-y-3 text-sm text-gray-600">
            <li className="flex gap-2">
              <span className="text-[#a94442] font-bold">•</span>
              Personalize your messages with emojis to increase engagement.
            </li>
            <li className="flex gap-2">
              <span className="text-[#a94442] font-bold">•</span>
              Include a clear call to action (CTA) like a link to your storefront.
            </li>
            <li className="flex gap-2">
              <span className="text-[#a94442] font-bold">•</span>
              Offer exclusive discount codes for your Telegram subscribers.
            </li>
          </ul>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Customer Growth</h3>
          <p className="text-sm text-gray-600 mb-4">
            Encourage customers to use your Telegram bot by offering a small discount for their first order through the bot.
          </p>
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-xs font-mono text-gray-500 break-all">
              https://t.me/{settings?.telegramUsername || 'YourBot'}?start=welcome
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
