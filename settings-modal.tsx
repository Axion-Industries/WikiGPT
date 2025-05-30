import { X, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preferences: {
    autoScroll: boolean;
    typingIndicators: boolean;
    saveHistory: boolean;
    responseStyle: string;
  };
  onUpdatePreferences: (preferences: any) => void;
}

export default function SettingsModal({
  open,
  onOpenChange,
  preferences,
  onUpdatePreferences,
}: SettingsModalProps) {
  const { toast } = useToast();

  const handlePreferenceChange = (key: string, value: any) => {
    onUpdatePreferences({
      ...preferences,
      [key]: value,
    });
  };

  const exportChatHistory = () => {
    try {
      const chatData = localStorage.getItem('wikigpt_sessions');
      if (!chatData || chatData === '[]') {
        toast({
          title: "No data to export",
          description: "You don't have any chat history to export.",
          variant: "destructive",
        });
        return;
      }

      const dataStr = JSON.stringify(JSON.parse(chatData), null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `wikigpt-chat-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      toast({
        title: "Chat history exported",
        description: "Your chat history has been downloaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export chat history. Please try again.",
        variant: "destructive",
      });
    }
  };

  const importChatHistory = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string);
          
          if (window.confirm('This will replace your current chat history. Continue?')) {
            localStorage.setItem('wikigpt_sessions', JSON.stringify(imported));
            window.location.reload(); // Reload to show imported history
          }
        } catch (error) {
          toast({
            title: "Import failed",
            description: "Invalid chat history file. Please check the file and try again.",
            variant: "destructive",
          });
        }
      };
      reader.readAsText(file);
    };
    
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-dark-secondary border-dark-border text-text-primary data-[state=open]:bg-dark-secondary">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Settings</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-text-muted hover:text-text-primary"
            >
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Interface Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-text-primary">Interface</h3>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-scroll" className="text-text-primary">
                Auto-scroll to new messages
              </Label>
              <Switch
                id="auto-scroll"
                checked={preferences.autoScroll}
                onCheckedChange={(checked) => handlePreferenceChange('autoScroll', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="typing-indicators" className="text-text-primary">
                Show typing indicators
              </Label>
              <Switch
                id="typing-indicators"
                checked={preferences.typingIndicators}
                onCheckedChange={(checked) => handlePreferenceChange('typingIndicators', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="save-history" className="text-text-primary">
                Save chat history
              </Label>
              <Switch
                id="save-history"
                checked={preferences.saveHistory}
                onCheckedChange={(checked) => handlePreferenceChange('saveHistory', checked)}
              />
            </div>
          </div>

          <Separator className="border-dark-border" />

          {/* Response Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-text-primary">Response Style</h3>
            
            <div className="space-y-2">
              <Label htmlFor="response-style" className="text-text-primary text-sm">
                Default response style
              </Label>
              <Select
                value={preferences.responseStyle}
                onValueChange={(value) => handlePreferenceChange('responseStyle', value)}
              >
                <SelectTrigger className="bg-dark-tertiary border-dark-border text-text-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-dark-tertiary border-dark-border">
                  <SelectItem value="concise">Concise</SelectItem>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="detailed">Detailed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator className="border-dark-border" />

          {/* Data Management */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-text-primary">Data Management</h3>
            
            <div className="flex space-x-3">
              <Button
                onClick={exportChatHistory}
                variant="outline"
                size="sm"
                className="flex-1 bg-dark-tertiary border-dark-border text-text-primary hover:bg-dark-border"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Chat
              </Button>
              
              <Button
                onClick={importChatHistory}
                variant="outline"
                size="sm"
                className="flex-1 bg-dark-tertiary border-dark-border text-text-primary hover:bg-dark-border"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import Chat
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
