import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import type { ChatMessage } from "@shared/schema";

interface YahChatProps {
  rideId?: string;
  isModal?: boolean;
}

export default function YahChat({ rideId, isModal = false }: YahChatProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messagesData, isLoading } = useQuery({
    queryKey: ['/api/chat/messages', { customerId: user?.id, rideId }],
    enabled: !!user?.id && (isModal ? isOpen : true),
    refetchInterval: isOpen || !isModal ? 2000 : false,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageText: string) => {
      return await apiRequest('POST', '/api/chat/message', {
        customerId: user?.id,
        rideId,
        message: messageText,
        isFromCustomer: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/messages'] });
      setMessage("");
      setIsTyping(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Message",
        description: error.message,
        variant: "destructive",
      });
      setIsTyping(false);
    },
  });

  const messages = (messagesData as any)?.messages || [];

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    setIsTyping(true);
    sendMessageMutation.mutate(message);
  };

  const quickResponses = [
    "Where is my driver?",
    "How much longer?",
    "Can I change my destination?",
    "I need to cancel my ride",
    "Report an issue",
    "Payment question"
  ];

  const ChatContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center space-x-3 p-4 border-b border-yah-gold/20">
        <div className="w-10 h-10 bg-gradient-gold rounded-full flex items-center justify-center">
          <i className="fas fa-robot text-yah-darker"></i>
        </div>
        <div>
          <h3 className="font-semibold text-yah-gold">Yah™Chat</h3>
          <p className="text-xs text-green-400 flex items-center">
            <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
            Online & Ready to Help
          </p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4 custom-scrollbar">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gradient-gold rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-robot text-yah-darker text-2xl"></i>
              </div>
              <h4 className="font-semibold mb-2 text-yah-gold">Welcome to Yah™Chat!</h4>
              <p className="text-sm text-gray-400 mb-4">
                I'm here to help with your ride. Ask me anything!
              </p>
              
              {/* Quick Response Buttons */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                {quickResponses.map((response, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMessage(response);
                      handleSendMessage(new Event('submit') as any);
                    }}
                    className="text-xs border-yah-gold/30 text-yah-gold hover:bg-yah-gold/20"
                    data-testid={`quick-response-${index}`}
                  >
                    {response}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg: ChatMessage) => (
              <div
                key={msg.id}
                className={`flex ${msg.isFromCustomer ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                    msg.isFromCustomer
                      ? 'bg-gradient-gold text-yah-darker'
                      : 'bg-yah-muted/50 text-white border border-yah-gold/20'
                  }`}
                >
                  <p className="text-sm">{msg.message}</p>
                  <span className="text-xs opacity-70 mt-1 block">
                    {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    }) : 'Now'}
                  </span>
                </div>
              </div>
            ))
          )}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-yah-muted/50 px-4 py-3 rounded-2xl border border-yah-gold/20">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-yah-gold rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-yah-gold rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-yah-gold rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-yah-gold/20">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-yah-muted rounded-full px-4 py-2 border-yah-gold/30 focus:border-yah-gold"
            disabled={sendMessageMutation.isPending}
            data-testid="input-chatMessage"
          />
          <Button
            type="submit"
            disabled={!message.trim() || sendMessageMutation.isPending}
            className="w-12 h-12 bg-gradient-gold rounded-full flex items-center justify-center ripple"
            data-testid="button-sendMessage"
          >
            {sendMessageMutation.isPending ? (
              <i className="fas fa-spinner fa-spin text-yah-darker"></i>
            ) : (
              <i className="fas fa-paper-plane text-yah-darker"></i>
            )}
          </Button>
        </form>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            className="fixed bottom-24 right-4 w-14 h-14 bg-gradient-gold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 z-50"
            data-testid="button-openYahChat"
          >
            <i className="fas fa-robot text-yah-darker text-xl"></i>
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-yah-darker border-yah-gold/20 max-w-md h-[600px] p-0">
          <ChatContent />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Card className="glass border-yah-gold/20 h-full">
      <ChatContent />
    </Card>
  );
}
