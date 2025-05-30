import { Brain } from "lucide-react";

export default function TypingIndicator() {
  return (
    <div className="flex items-start space-x-3 mb-4 animate-fade-in">
      <div className="w-8 h-8 gradient-bg rounded-full flex items-center justify-center flex-shrink-0">
        <Brain className="w-4 h-4 text-white" />
      </div>
      
      <div className="bg-black/40 backdrop-blur-sm rounded-2xl rounded-tl-md px-4 py-3 max-w-xs">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-text-muted rounded-full typing-dot animate-typing" />
          <div className="w-2 h-2 bg-text-muted rounded-full typing-dot animate-typing" style={{ animationDelay: '0.2s' }} />
          <div className="w-2 h-2 bg-text-muted rounded-full typing-dot animate-typing" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    </div>
  );
}
