import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Send, Users, User, X, MessageCircle } from 'lucide-react';

interface ChatMessage {
  id: string;
  company_id: string;
  sender_id: string;
  recipient_id: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
  sender?: {
    full_name: string;
    role: string;
  };
}

interface ChatUser {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

export const LiveChat: React.FC = () => {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadUsers();
    loadMessages();

    const subscription = supabase
      .channel('chat_messages_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `company_id=eq.${profile?.company_id}`
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [profile?.company_id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (selectedUser) {
      markMessagesAsRead();
    }
  }, [selectedUser, messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, is_active')
        .eq('company_id', profile?.company_id)
        .neq('id', profile?.id)
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          profiles:sender_id(full_name, role)
        `)
        .eq('company_id', profile?.company_id)
        .or(`sender_id.eq.${profile?.id},recipient_id.eq.${profile?.id}`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formattedData = data?.map((item: any) => ({
        ...item,
        sender: item.profiles
      })) || [];

      setMessages(formattedData);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const markMessagesAsRead = async () => {
    try {
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('recipient_id', profile?.id)
        .eq('sender_id', selectedUser)
        .eq('is_read', false);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || !profile?.company_id) return;

    setSending(true);

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert([
          {
            company_id: profile.company_id,
            sender_id: profile.id,
            recipient_id: selectedUser,
            message: newMessage.trim(),
            is_read: false
          }
        ]);

      if (error) throw error;

      setNewMessage('');
      loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const getFilteredMessages = () => {
    if (!selectedUser) {
      return messages.filter(m => m.recipient_id === null);
    }

    return messages.filter(
      m =>
        (m.sender_id === profile?.id && m.recipient_id === selectedUser) ||
        (m.sender_id === selectedUser && m.recipient_id === profile?.id)
    );
  };

  const getUnreadCount = (userId: string) => {
    return messages.filter(
      m =>
        m.sender_id === userId &&
        m.recipient_id === profile?.id &&
        !m.is_read
    ).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const filteredMessages = getFilteredMessages();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Live Chat</h1>
        <p className="text-gray-600 mt-2">Communicate with your team in real-time</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Contacts</h2>
            <Users className="h-5 w-5 text-gray-400" />
          </div>

          <button
            onClick={() => setSelectedUser(null)}
            className={`w-full flex items-center space-x-3 p-3 rounded-lg mb-2 transition-colors ${
              selectedUser === null
                ? 'bg-blue-50 border-2 border-blue-500'
                : 'hover:bg-gray-50 border-2 border-transparent'
            }`}
          >
            <div className="bg-blue-100 p-2 rounded-full">
              <MessageCircle className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-gray-900">Group Chat</p>
              <p className="text-sm text-gray-500">Everyone</p>
            </div>
          </button>

          <div className="space-y-2">
            {users.map((user) => {
              const unreadCount = getUnreadCount(user.id);
              return (
                <button
                  key={user.id}
                  onClick={() => setSelectedUser(user.id)}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    selectedUser === user.id
                      ? 'bg-blue-50 border-2 border-blue-500'
                      : 'hover:bg-gray-50 border-2 border-transparent'
                  }`}
                >
                  <div className="bg-gray-100 p-2 rounded-full">
                    <User className="h-5 w-5 text-gray-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-gray-900">{user.full_name}</p>
                    <p className="text-sm text-gray-500 capitalize">{user.role}</p>
                  </div>
                  {unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-3 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col h-[700px]">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedUser
                  ? users.find(u => u.id === selectedUser)?.full_name || 'Unknown User'
                  : 'Group Chat'}
              </h2>
              <p className="text-sm text-gray-500">
                {selectedUser
                  ? users.find(u => u.id === selectedUser)?.role
                  : 'Team communication'}
              </p>
            </div>
            {selectedUser && (
              <button
                onClick={() => setSelectedUser(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {filteredMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageCircle className="h-16 w-16 text-gray-300 mb-4" />
                <p className="text-gray-500 text-lg font-medium">No messages yet</p>
                <p className="text-gray-400 text-sm">Start a conversation below</p>
              </div>
            ) : (
              filteredMessages.map((message) => {
                const isOwn = message.sender_id === profile?.id;
                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] ${
                        isOwn
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      } rounded-lg p-3`}
                    >
                      {!isOwn && (
                        <p className="text-xs font-semibold mb-1 opacity-75">
                          {message.sender?.full_name}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>
                      <p
                        className={`text-xs mt-1 ${
                          isOwn ? 'text-blue-100' : 'text-gray-500'
                        }`}
                      >
                        {new Date(message.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="p-4 border-t border-gray-200">
            <div className="flex space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={`Message ${
                  selectedUser
                    ? users.find(u => u.id === selectedUser)?.full_name || 'user'
                    : 'everyone'
                }...`}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Send className="h-5 w-5" />
                <span>Send</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
