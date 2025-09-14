import { useState, useEffect, useRef } from "react";
import { useRoute } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import BottomNavigation from "@/components/bottom-navigation";
import { createClient } from "@supabase/supabase-js";
import type { ChatMessage, YahChatSession } from "@shared/schema";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ||
    "https://vkytupgdapdfpfolsmnd.supabase.co",
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZreXR1cGdkYXBkZnBmb2xzbW5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwOTg5MjIsImV4cCI6MjA2NzY3NDkyMn0.lWBBmpKAzjg7OcJh5CC8ox8EV0Hd1zALIineF7ZZCuA",
);

const EVENT_MESSAGE_TYPE = "chat_message";

// Request notification permission
const requestNotificationPermission = async () => {
  if ("Notification" in window) {
    const permission = await Notification.requestPermission();
    return permission;
  }
  return "denied";
};

// Show notification for new driver messages
const showNotification = (message: string, driverName: string = "Driver") => {
  if ("Notification" in window && Notification.permission === "granted") {
    const notification = new Notification(`New message from ${driverName}`, {
      body: message,
      icon: "/yah-logo.png",
      badge: "/yah-logo.png",
      vibrate: [200, 100, 200],
      tag: "yah-chat",
    });

    // Auto close after 5 seconds
    setTimeout(() => {
      notification.close();
    }, 5000);

    // Focus window when notification is clicked
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }
};

export default function Chat() {
  const [match, params] = useRoute("/chat/:rideId?");
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatSession, setChatSession] = useState<YahChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [channel, setChannel] = useState<any>(null);
  const [notificationPermission, setNotificationPermission] =
    useState<string>("default");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Request notification permission on component mount
  useEffect(() => {
    const initNotifications = async () => {
      const permission = await requestNotificationPermission();
      setNotificationPermission(permission);
    };

    initNotifications();
  }, []);

  // Load chat session using direct Supabase query with proper filtering
  useEffect(() => {
    const loadChatSession = async () => {
      if (!user?.id) return;

      try {
        // Build query with all required filters
        let query = supabase
          .from("yah_chat_sessions")
          .select("*")
          .eq("is_active", true)
          .eq("customer_id", user.id);

        // Filter by ride_id if provided in URL
        if (params?.rideId) {
          query = query.eq("ride_id", params.rideId);
        }

        const { data, error } = await query.order("created_at", {
          ascending: false,
        });

        console.log("Chat session query:", {
          userId: user.id,
          rideId: params?.rideId,
        });
        console.log("Chat sessions found:", data);

        if (error) {
          console.error("Error loading chat session:", error);
          return;
        }

        if (data && data.length > 0) {
          const tempSession = data[0];
          const newChatSession = {
            id: tempSession.id,
            ride_id: tempSession.ride_id,
            driver_id: tempSession.driver_id,
            customer_id: tempSession.customer_id,
            is_active: tempSession.is_active,
            created_at: tempSession.created_at,
            started_at: tempSession.started_at,
            room_name: tempSession.room_name,
            session_id: tempSession.session_id || null,
            status: tempSession.status || null,
          };
          setChatSession(newChatSession);
          console.log("Chat session loaded:", newChatSession);
        } else {
          console.log("No active chat session found");
        }
      } catch (error) {
        console.error("Error loading chat session:", error);
      }
    };

    loadChatSession();
  }, [user?.id, params?.rideId]);

  // Load existing messages from database
  useEffect(() => {
    const loadMessages = async () => {
      if (!user?.id) return;

      try {
        let query = supabase
          .from("yah_messages")
          .select("*")
          .eq("is_deleted", false)
          .order("created_at", { ascending: true });

        // First, let's check what messages exist for debugging
        const { data: allMessages } = await supabase
          .from("yah_messages")
          .select("*")
          .eq("is_deleted", false);

        console.log("All messages in database:", allMessages);

        // Filter by chat_session_id if available, otherwise by ride_id
        if (chatSession?.id) {
          query = query.eq("chat_session_id", chatSession.id);
          console.log("Filtering by chat_session_id:", chatSession.id);
        } else if (chatSession?.ride_id) {
          query = query.eq("ride_id", chatSession.ride_id);
          console.log("Filtering by ride_id:", chatSession.ride_id);
        } else {
          // If no session yet, try to load messages by user participation
          query = query.or(`sender_by.eq.${user.id}`);
          console.log("Filtering by sender_by:", user.id);
        }

        const { data, error } = await query;

        console.log("Loading messages for:", {
          chatSessionId: chatSession?.id,
          rideId: chatSession?.ride_id,
          userId: user.id,
        });
        console.log("Messages data:", data);

        if (error) {
          console.error("Error loading messages:", error);
          return;
        }

        if (data && data.length > 0) {
          const formattedMessages = data.map((msg: any) => ({
            id: msg.id,
            created_at: new Date(msg.created_at),
            ride_id: msg.ride_id,
            sender_by: msg.sender_by,
            sender_role: msg.sender_role,
            message: msg.message,
            is_deleted: msg.is_deleted,
            chat_session_id: msg.chat_session_id,
            is_read: msg.is_read,
            isFromCustomer: msg.sender_role === "customer",
          }));
          setMessages(formattedMessages);
          console.log("Loaded historical messages:", formattedMessages.length);
        } else {
          console.log("No historical messages found");
        }
      } catch (error) {
        console.error("Error loading messages:", error);
      }
    };

    loadMessages();
  }, [chatSession, user?.id]);

  // Real-time chat functionality
  useEffect(() => {
    if (chatSession && user && chatSession.room_name) {
      const newChannel = supabase.channel(chatSession.room_name);
      newChannel
        .on("broadcast", { event: EVENT_MESSAGE_TYPE }, (payload) => {
          console.log("Message received from broadcast!", payload);
          const newMessage = payload.payload;

          // Show notification for driver messages (not from current user)
          if (
            newMessage.sender_role === "driver" &&
            newMessage.sender_by !== user?.id
          ) {
            showNotification(newMessage.message, "Your Driver");
          }

          setMessages((current) => {
            // Avoid duplicates - only add if message doesn't exist and is not from current user
            const exists = current.some((msg) => msg.id === newMessage.id);
            if (exists || newMessage.sender_by === user?.id) return current;
            return [
              ...current,
              {
                ...newMessage,
                isFromCustomer: newMessage.sender_role === "customer",
              },
            ];
          });
        })
        .subscribe(async (status) => {
          console.log("Channel status:", status);
          if (status === "SUBSCRIBED") {
            setIsConnected(true);
          }
        });

      setChannel(newChannel);
      return () => {
        supabase.removeChannel(newChannel);
      };
    }
  }, [chatSession]);

  const sendMessage = async (messageText: string) => {
    if (!chatSession || !channel || !user) return;

    const newMessage = {
      id: crypto.randomUUID(),
      created_at: new Date(),
      ride_id: chatSession.ride_id || "",
      sender_by: user.id,
      sender_role: "customer",
      message: messageText,
      is_deleted: false,
      chat_session_id: chatSession.id,
      is_read: false,
      isFromCustomer: true,
    };

    try {
      // Store message in database first
      const { error: dbError } = await supabase.from("yah_messages").insert({
        id: newMessage.id,
        created_at: newMessage.created_at.toISOString(),
        ride_id: newMessage.ride_id,
        sender_by: newMessage.sender_by,
        sender_role: newMessage.sender_role,
        message: newMessage.message,
        is_deleted: newMessage.is_deleted,
        chat_session_id: newMessage.chat_session_id,
        is_read: newMessage.is_read,
      });

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`);
      }

      // Add message to UI immediately
      setMessages((current) => [...current, newMessage]);

      // Broadcast message to channel for other users
      await channel.send({
        type: "broadcast",
        event: EVENT_MESSAGE_TYPE,
        payload: newMessage,
      });

      setMessage("");
      setIsTyping(false);
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Failed to Send Message",
        description: "Could not send message. Please try again.",
        variant: "destructive",
      });
      setIsTyping(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsTyping(true);
    sendMessage(message);
  };

  return (
    <div className="min-h-screen bg-background pb-20 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border p-4">
        {notificationPermission !== "granted" && (
          <div className="mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm">
            <p className="text-yellow-800 dark:text-yellow-200">
              Enable notifications to get alerts when your driver sends
              messages.
            </p>
            <button
              onClick={async () => {
                const permission = await requestNotificationPermission();
                setNotificationPermission(permission);
              }}
              className="mt-1 text-xs text-yellow-700 dark:text-yellow-300 underline"
            >
              Enable Notifications
            </button>
          </div>
        )}
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
            <i className="fas fa-robot text-primary-foreground text-xl"></i>
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">
              {chatSession ? `Chat with Driver` : "Yah™Chat"}
            </h1>
            <div className="text-xs text-accent flex items-center">
              <div
                className={`w-2 h-2 rounded-full mr-2 ${isConnected ? "bg-green-500 animate-pulse" : "bg-gray-400"}`}
              ></div>
              {chatSession
                ? `Ride: ${chatSession.ride_id?.slice(0, 8)}... ${isConnected ? "(Connected)" : "(Connecting...)"}`
                : "AI Assistant"}
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {!chatSession ? (
            <div className="text-center py-8 text-muted-foreground">
              <i className="fas fa-info-circle text-4xl mb-4 opacity-50"></i>
              <p>No active ride. Start a ride to chat with your driver!</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <i className="fas fa-comments text-4xl mb-4 opacity-50"></i>
              <p>No messages yet. Start a conversation with your driver!</p>
            </div>
          ) : (
            messages.map((msg: any) => (
              <div
                key={msg.id}
                className={`flex ${msg.isFromCustomer ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2 rounded-lg ${
                    msg.isFromCustomer
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <p className="text-sm">{msg.message}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {msg.created_at
                      ? new Date(msg.created_at).toLocaleTimeString()
                      : "Now"}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Message Input */}
      {chatSession && (
        <div className="p-4 border-t border-border">
          <form
            onSubmit={handleSendMessage}
            className="flex items-center space-x-2"
          >
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1"
              data-testid="input-chat-message"
            />
            <Button
              type="submit"
              disabled={isTyping || !message.trim() || !isConnected}
              className="bg-primary hover:bg-primary/90"
              data-testid="button-send-message"
            >
              <i className="fas fa-paper-plane"></i>
            </Button>
          </form>
        </div>
      )}

      <BottomNavigation currentPage="chat" />
    </div>
  );
}
