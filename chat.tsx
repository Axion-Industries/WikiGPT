import { useEffect } from "react";
import ChatInterface from "@/components/chat/chat-interface";
import { useChatStorage } from "@/lib/chat-storage";

export default function ChatPage() {
  const { loadChats } = useChatStorage();

  useEffect(() => {
    // Load chat history from localStorage on mount
    loadChats();
  }, [loadChats]);

  return (
    <div className="h-screen bg-transparent text-white">
      <ChatInterface />
    </div>
  );
}
