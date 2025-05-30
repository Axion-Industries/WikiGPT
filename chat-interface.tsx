import { useState, useRef, useEffect } from "react";
import { Brain, Send, Trash2, Settings, Menu, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import MessageBubble from "./message-bubble";
import TypingIndicator from "./typing-indicator";
import SettingsModal from "./settings-modal";
import { useChat } from "@/hooks/use-chat";
import { useChatStorage } from "@/lib/chat-storage";
import { useToast } from "@/hooks/use-toast";

const sampleQuestions = [
  "Tell me about artificial intelligence",
  "How does photosynthesis work?",
  "Compare democracy and republic",
  "What is quantum computing?",
];

export default function ChatInterface() {
  const [input, setInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { 
    currentSession, 
    sessions, 
    sendMessage, 
    createNewSession, 
    switchSession, 
    clearCurrentSession,
    isLoading 
  } = useChat();

  const { preferences, updatePreferences } = useChatStorage();

  const scrollToBottom = () => {
    if (preferences.autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.messages, isLoading, preferences.autoScroll]);

  const handleSubmit = async (message?: string) => {
    const messageToSend = message || input.trim();
    if (!messageToSend || isLoading) return;

    setInput("");
    
    try {
      await sendMessage(messageToSend);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };

  const handleClearChat = () => {
    if (currentSession?.messages.length === 0) return;
    
    if (window.confirm("Are you sure you want to clear this chat? This action cannot be undone.")) {
      clearCurrentSession();
      toast({
        title: "Chat cleared",
        description: "Your chat history has been cleared.",
      });
    }
  };

  const Sidebar = () => (
    <div className="w-80 bg-black/40 backdrop-blur-sm border-r border-purple-500/30 flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-dark-border">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 gradient-bg rounded-lg flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold gradient-text">WikiGPT</h1>
            <p className="text-xs text-text-muted">Wikipedia AI Assistant</p>
          </div>
        </div>
        
        <Button
          onClick={createNewSession}
          className="w-full bg-wiki-blue hover:bg-wiki-blue-light"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>

      {/* Chat History */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-text-muted uppercase tracking-wide mb-3">
            Recent Chats
          </h3>
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => switchSession(session.id)}
              className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
                currentSession?.id === session.id
                  ? "bg-dark-tertiary border border-wiki-blue"
                  : "hover:bg-dark-tertiary border border-transparent"
              }`}
            >
              <div className="font-medium text-white text-sm mb-1 truncate">
                {session.title}
              </div>
              <div className="text-xs text-text-muted">
                {session.messages.length} messages
              </div>
              <div className="text-xs text-text-muted">
                {new Date(session.updatedAt).toLocaleDateString()}
              </div>
            </button>
          ))}
          {sessions.length === 0 && (
            <div className="text-center text-text-muted py-8">
              <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No chats yet</p>
              <p className="text-xs">Start a conversation!</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Stats */}
      <div className="p-4 border-t border-dark-border">
        <div className="flex items-center justify-between text-sm text-text-muted">
          <span>{sessions.length} chats</span>
          <span>
            {sessions.reduce((total, session) => total + session.messages.length, 0)} messages
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-80 bg-dark-secondary border-dark-border">
          <Sidebar />
        </SheetContent>
      </Sheet>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-black/40 backdrop-blur-sm border-b border-purple-500/30 p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
            </Sheet>
            
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 gradient-bg rounded-lg flex items-center justify-center lg:hidden">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-text-primary">
                  {currentSession?.title || "New Chat"}
                </h2>
                <p className="text-sm text-text-muted">Ask me anything about Wikipedia</p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="hidden sm:flex items-center space-x-2 text-text-muted text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>Wikipedia Connected</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearChat}
              disabled={!currentSession?.messages.length}
              className="text-text-muted hover:text-red-400"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(true)}
              className="text-text-muted hover:text-wiki-blue"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-4">
            {(!currentSession || currentSession.messages.length === 0) && (
              <div className="text-center py-12 animate-fade-in">
                <div className="w-16 h-16 gradient-bg rounded-2xl mx-auto mb-4 flex items-center justify-center animate-bounce-gentle">
                  <Brain className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-2 gradient-text">Welcome to WikiGPT</h3>
                <p className="text-text-secondary max-w-2xl mx-auto mb-8 leading-relaxed">
                  Ask me anything about the world's knowledge! I can help you explore Wikipedia articles,
                  compare topics, explain complex concepts, and answer your questions with detailed information.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                  {sampleQuestions.map((question, index) => (
                    <button
                      key={index}
                      onClick={() => handleSubmit(question)}
                      className="text-left p-4 bg-dark-surface rounded-xl border border-dark-border hover:border-wiki-blue transition-all duration-300 group"
                      disabled={isLoading}
                    >
                      <div className="font-medium text-text-primary mb-1 group-hover:text-wiki-blue transition-colors">
                        "{question}"
                      </div>
                      <div className="text-sm text-text-muted">
                        Click to ask this question
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {currentSession?.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {isLoading && preferences.typingIndicators && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="bg-black/40 backdrop-blur-sm border-t border-purple-500/30 p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end space-x-4">
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything about Wikipedia topics..."
                  className="min-h-[2.5rem] max-h-[150px] resize-none bg-black/30 border-purple-500/30 text-white placeholder:text-gray-400 focus:border-purple-500 focus:ring-purple-500"
                  disabled={isLoading}
                />
                <div className="absolute bottom-2 right-3 text-xs text-text-muted">
                  {input.length}/500
                </div>
              </div>
              
              <Button
                onClick={() => handleSubmit()}
                disabled={!input.trim() || isLoading}
                className="bg-wiki-blue hover:bg-wiki-blue-light h-10 w-10 p-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center justify-between mt-2 text-xs text-text-muted">
              <span>Press Enter to send, Shift+Enter for new line</span>
              {isLoading && (
                <span className="flex items-center space-x-2">
                  <div className="loading-spinner" />
                  <span>Searching Wikipedia...</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
        preferences={preferences}
        onUpdatePreferences={updatePreferences}
      />
    </div>
  );
}
