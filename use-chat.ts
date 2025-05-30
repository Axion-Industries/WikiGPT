import { useState, useCallback, useEffect } from "react";
import { LocalChatSession, LocalChatMessage } from "@shared/schema";
import { wikipediaAPI } from "@/lib/wikipedia-api";
import { useChatStorage } from "@/lib/chat-storage";

export function useChat() {
  const [sessions, setSessions] = useState<LocalChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const { 
    loadChats, 
    saveChats, 
    getCurrentSessionId, 
    setCurrentSessionId: saveCurrentSessionId,
    chatStorage,
    preferences 
  } = useChatStorage();

  // Load data on mount
  useEffect(() => {
    const savedSessions = loadChats();
    setSessions(savedSessions);
    
    const savedCurrentId = getCurrentSessionId();
    if (savedCurrentId && savedSessions.find(s => s.id === savedCurrentId)) {
      setCurrentSessionId(savedCurrentId);
    } else if (savedSessions.length > 0) {
      setCurrentSessionId(savedSessions[0].id);
      saveCurrentSessionId(savedSessions[0].id);
    }
  }, [loadChats, getCurrentSessionId, saveCurrentSessionId]);

  // Save sessions whenever they change
  useEffect(() => {
    if (sessions.length > 0 && preferences.saveHistory) {
      saveChats(sessions);
    }
  }, [sessions, saveChats, preferences.saveHistory]);

  // Save current session ID whenever it changes
  useEffect(() => {
    saveCurrentSessionId(currentSessionId);
  }, [currentSessionId, saveCurrentSessionId]);

  const currentSession = sessions.find(s => s.id === currentSessionId) || null;

  const createNewSession = useCallback(() => {
    const newSession = chatStorage.createSession();
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    return newSession;
  }, [chatStorage]);

  const switchSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
  }, []);

  const updateSession = useCallback((sessionId: string, updates: Partial<LocalChatSession>) => {
    setSessions(prev => prev.map(session => 
      session.id === sessionId 
        ? { ...session, ...updates, updatedAt: new Date().toISOString() }
        : session
    ));
  }, []);

  const addMessage = useCallback((sessionId: string, message: LocalChatMessage) => {
    setSessions(prev => prev.map(session => 
      session.id === sessionId
        ? {
            ...session,
            messages: [...session.messages, message],
            updatedAt: new Date().toISOString()
          }
        : session
    ));
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    // Create session if none exists
    let targetSessionId = currentSessionId;
    if (!targetSessionId) {
      const newSession = createNewSession();
      targetSessionId = newSession.id;
    }

    // Add user message
    const userMessage = chatStorage.createMessage('user', content);
    addMessage(targetSessionId, userMessage);

    // Update session title if it's the first message
    if (currentSession?.messages.length === 0) {
      const newTitle = chatStorage.updateSessionTitle(currentSession, content);
      updateSession(targetSessionId, { title: newTitle });
    }

    setIsLoading(true);

    try {
      // Process the question using Wikipedia API
      const response = await wikipediaAPI.processQuestion(content);
      
      if (response.success && response.response) {
        const assistantMessage = chatStorage.createMessage(
          'assistant', 
          response.response,
          {
            sources: response.sources,
            searchQuery: content,
            processingTime: response.processingTime
          }
        );
        addMessage(targetSessionId, assistantMessage);
      } else {
        // Fallback to direct Wikipedia API
        const searchResults = await wikipediaAPI.searchDirect(content, 3);
        
        if (searchResults.length > 0) {
          const article = await wikipediaAPI.getArticleDirect(searchResults[0].title);
          
          let responseText = "";
          if (article) {
            responseText = generateFallbackResponse(content, article, searchResults);
          } else {
            responseText = generateNoResultResponse(content);
          }
          
          const assistantMessage = chatStorage.createMessage(
            'assistant',
            responseText,
            {
              sources: searchResults.map(r => r.title),
              searchQuery: content,
            }
          );
          addMessage(targetSessionId, assistantMessage);
        } else {
          const errorMessage = chatStorage.createMessage(
            'assistant',
            generateNoResultResponse(content)
          );
          addMessage(targetSessionId, errorMessage);
        }
      }
    } catch (error) {
      console.error('Send message error:', error);
      const errorMessage = chatStorage.createMessage(
        'assistant',
        "I apologize, but I'm having trouble connecting to Wikipedia right now. Please check your internet connection and try again."
      );
      addMessage(targetSessionId, errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [currentSessionId, currentSession, createNewSession, addMessage, updateSession, chatStorage]);

  const clearCurrentSession = useCallback(() => {
    if (!currentSessionId) return;
    
    updateSession(currentSessionId, { messages: [], updatedAt: new Date().toISOString() });
  }, [currentSessionId, updateSession]);

  const deleteSession = useCallback((sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    
    if (currentSessionId === sessionId) {
      const remainingSessions = sessions.filter(s => s.id !== sessionId);
      if (remainingSessions.length > 0) {
        setCurrentSessionId(remainingSessions[0].id);
      } else {
        setCurrentSessionId(null);
      }
    }
  }, [currentSessionId, sessions]);

  return {
    sessions,
    currentSession,
    currentSessionId,
    isLoading,
    sendMessage,
    createNewSession,
    switchSession,
    clearCurrentSession,
    deleteSession,
    updateSession,
  };
}

function generateFallbackResponse(question: string, article: any, searchResults: any[]): string {
  const extract = article.extract;
  const title = article.title;
  const url = article.url;

  // Extract relevant paragraphs
  const paragraphs = extract.split('\n').filter((p: string) => p.trim().length > 50);
  const relevantContent = paragraphs.slice(0, 2).join('\n\n');

  // Generate conversational response
  const questionType = detectQuestionType(question);
  const conversationalIntros = [
    "Great question! Let me tell you about",
    "I'd be happy to explain",
    "Here's what I can share about",
    "That's an interesting topic! From what I know,",
    "Let me break this down for you -",
    "This is a fascinating subject!"
  ];
  
  const intro = conversationalIntros[Math.floor(Math.random() * conversationalIntros.length)];
  
  let response = "";
  
  if (questionType === 'what') {
    response = `${intro} **${title}**.\n\n`;
  } else if (questionType === 'how') {
    response = `${intro} Here's how ${title.toLowerCase()} works:\n\n`;
  } else if (questionType === 'why') {
    response = `${intro} The reasoning behind ${title.toLowerCase()}:\n\n`;
  } else if (questionType === 'when') {
    response = `${intro} Looking at the timeline of ${title.toLowerCase()}:\n\n`;
  } else {
    response = `${intro} **${title}**:\n\n`;
  }

  // Make content more conversational
  const processedContent = makeContentConversational(relevantContent.substring(0, 600));
  response += processedContent;

  // Add engaging conclusion
  const conclusions = [
    "\n\nHope this helps clarify things!",
    "\n\nPretty fascinating stuff, right?",
    "\n\nThere's definitely more to explore on this topic!",
    "\n\nLet me know if you'd like to dive deeper into any aspect!"
  ];
  
  response += conclusions[Math.floor(Math.random() * conclusions.length)];
  
  response += '\n\n**📚 Sources & Further Reading:**\n';
  response += `• [${title} on Wikipedia](${url})\n`;
  
  if (searchResults.length > 1) {
    const relatedTopics = searchResults.slice(1, 3).map((result: any) => result.title);
    response += `\n**🔗 You might also be interested in:** ${relatedTopics.join(', ')}`;
  }

  return response;

  function detectQuestionType(question: string): string {
    const lowerQuestion = question.toLowerCase();
    if (lowerQuestion.startsWith('what') || lowerQuestion.includes('what is') || lowerQuestion.includes('what are')) {
      return 'what';
    } else if (lowerQuestion.startsWith('how') || lowerQuestion.includes('how does') || lowerQuestion.includes('how to')) {
      return 'how';
    } else if (lowerQuestion.startsWith('why') || lowerQuestion.includes('why is') || lowerQuestion.includes('why does')) {
      return 'why';
    } else if (lowerQuestion.startsWith('when') || lowerQuestion.includes('when did') || lowerQuestion.includes('when was')) {
      return 'when';
    }
    return 'general';
  }

  function makeContentConversational(content: string): string {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    let processedSentences = sentences.slice(0, 3).map(sentence => {
      sentence = sentence.trim();
      
      if (Math.random() > 0.7) {
        const connectors = [
          "Essentially, ",
          "In simple terms, ",
          "Basically, ",
          "Put simply, ",
          "Here's the thing - ",
          "What's interesting is that "
        ];
        sentence = connectors[Math.floor(Math.random() * connectors.length)] + sentence.toLowerCase();
      }
      
      if (sentence.length > 100 && Math.random() > 0.5) {
        sentence = "**" + sentence + "**";
      }
      
      return sentence;
    });
    
    const connectors = [". ", ". Additionally, ", ". Also, ", ". What's more, ", ". Interestingly, "];
    return processedSentences.join(connectors[Math.floor(Math.random() * connectors.length)]);
  }
}

function generateNoResultResponse(question: string): string {
  const encouragingResponses = [
    "Hmm, I couldn't find specific information about that topic on Wikipedia.",
    "That's a tricky one! I wasn't able to locate relevant Wikipedia articles for that question.",
    "Interesting question, but I'm having trouble finding Wikipedia content that matches what you're looking for.",
    "I searched through Wikipedia but couldn't find detailed information on that specific topic."
  ];
  
  const response = encouragingResponses[Math.floor(Math.random() * encouragingResponses.length)];
  
  return `${response}

**Here are some ways we can try to get better results:**
• Try rephrasing with different keywords or terms
• Check if it might be a very recent topic (Wikipedia might not have coverage yet)
• Consider asking about a broader or more general version of the topic
• Make sure the topic has an established Wikipedia page

**Your search:** "${question}"

Feel free to try asking in a different way - I'm here to help!`;
}
