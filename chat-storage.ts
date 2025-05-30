import { useState, useCallback } from "react";
import { LocalChatSession, LocalChatMessage } from "@shared/schema";

interface UserPreferences {
  autoScroll: boolean;
  typingIndicators: boolean;
  saveHistory: boolean;
  responseStyle: 'concise' | 'balanced' | 'detailed';
  darkMode: boolean;
}

const defaultPreferences: UserPreferences = {
  autoScroll: true,
  typingIndicators: true,
  saveHistory: true,
  responseStyle: 'balanced',
  darkMode: true,
};

class ChatStorage {
  private readonly SESSIONS_KEY = 'wikigpt_sessions';
  private readonly PREFERENCES_KEY = 'wikigpt_preferences';
  private readonly CURRENT_SESSION_KEY = 'wikigpt_current_session';

  saveSessions(sessions: LocalChatSession[]): void {
    try {
      localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error('Failed to save sessions:', error);
    }
  }

  loadSessions(): LocalChatSession[] {
    try {
      const saved = localStorage.getItem(this.SESSIONS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to load sessions:', error);
      return [];
    }
  }

  saveCurrentSessionId(sessionId: string | null): void {
    try {
      if (sessionId) {
        localStorage.setItem(this.CURRENT_SESSION_KEY, sessionId);
      } else {
        localStorage.removeItem(this.CURRENT_SESSION_KEY);
      }
    } catch (error) {
      console.error('Failed to save current session ID:', error);
    }
  }

  loadCurrentSessionId(): string | null {
    try {
      return localStorage.getItem(this.CURRENT_SESSION_KEY);
    } catch (error) {
      console.error('Failed to load current session ID:', error);
      return null;
    }
  }

  savePreferences(preferences: UserPreferences): void {
    try {
      localStorage.setItem(this.PREFERENCES_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  }

  loadPreferences(): UserPreferences {
    try {
      const saved = localStorage.getItem(this.PREFERENCES_KEY);
      return saved ? { ...defaultPreferences, ...JSON.parse(saved) } : defaultPreferences;
    } catch (error) {
      console.error('Failed to load preferences:', error);
      return defaultPreferences;
    }
  }

  createSession(title: string = "New Chat"): LocalChatSession {
    return {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  createMessage(role: 'user' | 'assistant', content: string, metadata?: any): LocalChatMessage {
    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role,
      content,
      metadata,
      timestamp: new Date().toISOString(),
    };
  }

  updateSessionTitle(session: LocalChatSession, firstMessage: string): string {
    if (session.messages.length <= 1) {
      return firstMessage.length > 50 
        ? firstMessage.substring(0, 47) + '...' 
        : firstMessage;
    }
    return session.title;
  }

  clearAllData(): void {
    try {
      localStorage.removeItem(this.SESSIONS_KEY);
      localStorage.removeItem(this.CURRENT_SESSION_KEY);
      // Keep preferences
    } catch (error) {
      console.error('Failed to clear data:', error);
    }
  }
}

export const chatStorage = new ChatStorage();

export function useChatStorage() {
  const [preferences, setPreferences] = useState<UserPreferences>(() => 
    chatStorage.loadPreferences()
  );

  const updatePreferences = useCallback((newPreferences: Partial<UserPreferences>) => {
    const updated = { ...preferences, ...newPreferences };
    setPreferences(updated);
    chatStorage.savePreferences(updated);
  }, [preferences]);

  const loadChats = useCallback(() => {
    return chatStorage.loadSessions();
  }, []);

  const saveChats = useCallback((sessions: LocalChatSession[]) => {
    chatStorage.saveSessions(sessions);
  }, []);

  const getCurrentSessionId = useCallback(() => {
    return chatStorage.loadCurrentSessionId();
  }, []);

  const setCurrentSessionId = useCallback((sessionId: string | null) => {
    chatStorage.saveCurrentSessionId(sessionId);
  }, []);

  return {
    preferences,
    updatePreferences,
    loadChats,
    saveChats,
    getCurrentSessionId,
    setCurrentSessionId,
    chatStorage,
  };
}
