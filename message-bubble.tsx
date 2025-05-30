import { Brain, User, ExternalLink } from "lucide-react";
import { LocalChatMessage } from "@shared/schema";

interface MessageBubbleProps {
  message: LocalChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  
  const formatContent = (content: string) => {
    // Convert markdown-like formatting to HTML
    return content
      .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mb-3 gradient-text">$1</h1>')
      .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mb-2 text-wiki-blue">$2</h2>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" class="text-wiki-blue hover:text-wiki-blue-light underline transition-colors inline-flex items-center gap-1">$1 <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></a>')
      .replace(/^• (.+)$/gm, '<div class="flex items-start space-x-2 mb-1"><span class="text-wiki-blue mt-1 text-sm">•</span><span>$1</span></div>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');
  };

  return (
    <div className={`chat-bubble flex items-start space-x-3 mb-4 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser ? 'bg-wiki-blue-light' : 'gradient-bg'
      }`}>
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Brain className="w-4 h-4 text-white" />
        )}
      </div>
      
      <div className={`max-w-3xl ${
        isUser 
          ? 'bg-purple-900/30 backdrop-blur-sm rounded-2xl rounded-tr-md' 
          : 'bg-black/40 backdrop-blur-sm rounded-2xl rounded-tl-md'
      } px-4 py-3`}>
        <div className={`message-content ${isUser ? 'text-white' : 'text-white'}`}>
          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <div 
              className="prose prose-invert prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
            />
          )}
        </div>
        
        <div className="flex items-center justify-between mt-2 text-xs text-text-muted">
          <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {message.metadata?.sources && message.metadata.sources.length > 0 && (
            <div className="flex items-center space-x-1">
              <ExternalLink className="w-3 h-3" />
              <span>{message.metadata.sources.length} source{message.metadata.sources.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
