import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListSmtpAccounts } from "@workspace/api-client-react";
import { formatDistanceToNow, format } from "date-fns";
import { 
  Mail, Search, RefreshCw, Server, Calendar, CheckSquare, Eye, AlertCircle, Inbox as InboxIcon,
  Send, Sparkles, AlertTriangle, Paperclip, Smile, MoreVertical, Star, Reply, Archive, Trash2, CheckCircle2,
  User, Check, ChevronRight, CornerUpLeft, Minimize2, Maximize2, X
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface SenderItem {
  _id: string;
  fromName: string | null;
  fromAddress: string;
  latestSubject: string;
  latestText: string;
  latestDate: string;
  totalCount: number;
  unreadCount: number;
}

interface EmailMessage {
  _id: string;
  accountId: string;
  uid: number;
  messageId: string | null;
  fromName: string | null;
  fromAddress: string;
  toAddress: string;
  subject: string;
  text: string;
  html: string;
  date: string;
  isRead: boolean;
  aiDraft?: string;
}

const getAvatarColor = (name: string) => {
  const colors = [
    "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
    "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
    "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
    "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
    "bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function Inbox() {
  const [search, setSearch] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>(""); // Empty string means "All Inboxes"
  const [selectedSender, setSelectedSender] = useState<string | null>(null);
  const [selectedSenderName, setSelectedSenderName] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replyAccountId, setReplyAccountId] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("reply");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Deep-link support: when arriving from the Leads page (/inbox?email=addr),
  // pre-select that sender's conversation. Category is forced to "reply" so the
  // lead's thread is visible under the default filter.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get("email");
    if (emailParam) {
      const addr = emailParam.toLowerCase();
      setSelectedSender(addr);
      setSelectedSenderName(null);
      setCategoryFilter("reply");
    }
  }, []);

  // 1. Fetch SMTP Accounts (to let the user choose which email account inbox to view)
  const { data: smtpAccounts = [] } = useListSmtpAccounts();
  const imapAccounts = smtpAccounts.filter(acc => acc.isImapEnabled !== false);

  // 2. Fetch Senders (filtered by selected SMTP account & category)
  const { data: senders = [], isLoading: loadingSenders } = useQuery<SenderItem[]>({
    queryKey: ["inbox", "senders", selectedAccountId, categoryFilter],
    queryFn: async () => {
      let url = selectedAccountId 
        ? `/api/inbox/senders?accountId=${selectedAccountId}`
        : "/api/inbox/senders";
      
      if (categoryFilter) {
        url += (selectedAccountId ? "&" : "?") + `category=${categoryFilter}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch senders");
      return res.json();
    }
  });

  // 3. Fetch Messages for Selected Sender
  const { data: messages = [], isLoading: loadingMessages } = useQuery<EmailMessage[]>({
    queryKey: ["inbox", "messages", selectedSender, selectedAccountId, categoryFilter],
    queryFn: async () => {
      if (!selectedSender) return [];
      let url = `/api/inbox/messages?email=${encodeURIComponent(selectedSender)}`;
      if (selectedAccountId) url += `&accountId=${selectedAccountId}`;
      if (categoryFilter) url += `&category=${categoryFilter}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!selectedSender
  });

  // 4. Background Real-time Sync (polls every 20 seconds)
  useQuery({
    queryKey: ["inbox", "backgroundSync"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/inbox/sync");
        if (!res.ok) return null;
        const data = await res.json();
        if (data.syncedCount > 0) {
          queryClient.invalidateQueries({ queryKey: ["inbox", "senders"] });
          if (selectedSender) {
            queryClient.invalidateQueries({ queryKey: ["inbox", "messages", selectedSender] });
          }
        }
        return data;
      } catch (err) {
        console.warn("Background sync failed:", err);
        return null;
      }
    },
    refetchInterval: 20000, // Sync every 20 seconds in the background
    refetchOnWindowFocus: true,
  });

  // 5. Mark as Read Mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const res = await fetch(`/api/inbox/messages/${messageId}/read`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true })
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inbox", "senders"] });
      queryClient.invalidateQueries({ queryKey: ["inbox", "messages", selectedSender] });
    }
  });

  // Manual Sync Trigger
  const handleSync = async () => {
    setIsSyncing(true);
    toast({ title: "Syncing your inbox...", description: "Connecting to cPanel IMAP server." });
    try {
      const res = await fetch("/api/inbox/sync");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to sync");

      const failedAccount = data.details?.find((d: any) => d.status === "failed");
      if (failedAccount) {
        toast({
          title: "Sync Warning",
          description: `Failed to connect to ${failedAccount.email}: ${failedAccount.error}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sync completed",
          description: data.message || `Synced ${data.syncedCount} new emails.`,
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ["inbox", "senders"] });
      if (selectedSender) {
        queryClient.invalidateQueries({ queryKey: ["inbox", "messages", selectedSender] });
      }
    } catch (error: any) {
      toast({
        title: "Sync failed",
        description: error.message || "Could not connect to cPanel mail server.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSenderClick = (sender: SenderItem) => {
    setSelectedSender(sender.fromAddress);
    setSelectedSenderName(sender.fromName || sender.fromAddress);
    setReplyBody("");
    
    // Auto-prefill the reply account matching the mailbox/sender account
    const matchedAccount = imapAccounts.find(acc => acc.username.toLowerCase() === sender.fromAddress.toLowerCase());
    if (matchedAccount) {
      setReplyAccountId(matchedAccount.id);
    } else if (selectedAccountId) {
      setReplyAccountId(selectedAccountId);
    } else if (imapAccounts.length > 0) {
      setReplyAccountId(imapAccounts[0].id);
    }
  };

  // Auto-prefill AI Draft if available when a message thread is loaded
  useEffect(() => {
    if (messages.length > 0 && selectedSender) {
      const latestMsg = messages[0];
      if (latestMsg.aiDraft && !replyBody) {
        setReplyBody(latestMsg.aiDraft);
      }
    }
  }, [messages, selectedSender]);

  const handleSendReply = async () => {
    if (!replyBody.trim()) return;
    const activeAccount = replyAccountId || selectedAccountId || imapAccounts[0]?.id;
    if (!activeAccount) {
      toast({ title: "No active mailbox account configured", variant: "destructive" });
      return;
    }

    const latestMsg = messages[0];
    const replySubject = latestMsg ? latestMsg.subject : "Re: Conversation";

    setIsSendingReply(true);
    try {
      const res = await fetch("/api/inbox/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: activeAccount,
          to: selectedSender,
          subject: replySubject,
          body: replyBody,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reply");

      toast({ title: "Reply sent successfully!" });
      setReplyBody("");
      
      // Invalidate queries to refresh listing
      queryClient.invalidateQueries({ queryKey: ["inbox", "messages", selectedSender] });
      queryClient.invalidateQueries({ queryKey: ["inbox", "senders"] });
    } catch (err: any) {
      toast({
        title: "Failed to send reply",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleMessageOpen = (msg: EmailMessage) => {
    if (!msg.isRead) {
      markAsReadMutation.mutate(msg._id);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch("/api/inbox/read-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: selectedAccountId || undefined }),
      });
      if (!res.ok) throw new Error("Failed to mark all as read");
      
      toast({ title: "All messages marked as read" });
      queryClient.invalidateQueries({ queryKey: ["inbox", "senders"] });
      if (selectedSender) {
        queryClient.invalidateQueries({ queryKey: ["inbox", "messages", selectedSender] });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Filter senders based on search term
  const filteredSenders = senders.filter(
    (s) =>
      s.fromAddress.toLowerCase().includes(search.toLowerCase()) ||
      (s.fromName && s.fromName.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex h-[calc(100vh-6.5rem)] w-full gap-4 overflow-hidden bg-[#f6f8fc] dark:bg-zinc-950 p-2 rounded-2xl">
      
      {/* Column 1: SMTP Accounts Sidebar */}
      <div className="flex w-64 flex-col bg-transparent">
        {/* Compose Button / Area */}
        <div className="p-3">
          <Button 
            className="w-full py-6 rounded-2xl shadow-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center gap-3 text-sm font-semibold tracking-wide"
            onClick={handleSync}
            disabled={isSyncing}
          >
            <RefreshCw className={`h-4 w-4 text-primary ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing..." : "Sync Inbox"}
          </Button>
        </div>

        <div className="px-3 py-2 flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider text-zinc-500 uppercase px-3">
            Mailboxes
          </span>
          <span className="text-[10px] text-zinc-400 bg-zinc-200/50 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-mono">
            {imapAccounts.length}
          </span>
        </div>

        <ScrollArea className="flex-1 px-2">
          <div className="space-y-1">
            <button
              onClick={() => {
                setSelectedAccountId("");
                setSelectedSender(null);
              }}
              className={`w-full flex items-center justify-between px-4 py-2 text-sm font-semibold rounded-full transition-all ${
                selectedAccountId === "" 
                  ? "bg-[#d3e3fd] text-[#041e49] dark:bg-blue-900/40 dark:text-blue-100" 
                  : "hover:bg-zinc-200/60 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <InboxIcon className="h-4 w-4" />
                <span>All Inboxes</span>
              </div>
            </button>

            {imapAccounts.map((account) => {
              const isSelected = selectedAccountId === account.id;
              const initials = (account.name || account.username).substring(0, 1).toUpperCase();
              return (
                <button
                  key={account.id}
                  onClick={() => {
                    setSelectedAccountId(account.id);
                    setSelectedSender(null);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-full transition-all text-left ${
                    isSelected 
                      ? "bg-[#d3e3fd] text-[#041e49] dark:bg-blue-900/40 dark:text-blue-100 font-semibold" 
                      : "hover:bg-zinc-200/60 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-300"
                  }`}
                >
                  <div className="flex items-center justify-center h-5 w-5 rounded-full bg-zinc-300/60 dark:bg-zinc-800 text-[10px] font-bold">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-xs font-semibold">{account.name}</div>
                    <div className={`text-[10px] truncate ${isSelected ? "text-[#041e49]/70 dark:text-zinc-400" : "text-zinc-400"}`}>
                      {account.username}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
 
      {/* Column 2: Senders List */}
      <div className="flex w-96 flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
              <Mail className="h-4.5 w-4.5 text-blue-600" />
              Inbox
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              className="text-[11px] h-7 px-2.5 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 font-medium"
            >
              <CheckSquare className="h-3 w-3 mr-1.5 text-zinc-500" />
              Mark all read
            </Button>
          </div>

          {/* Category Tabs Filter */}
          <div className="flex rounded-full bg-zinc-100 dark:bg-zinc-800/80 p-1 text-xs">
            <button
              onClick={() => { setCategoryFilter("reply"); setSelectedSender(null); }}
              className={`flex-1 rounded-full py-1.5 text-center font-semibold transition-all ${
                categoryFilter === "reply" 
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" 
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
              }`}
            >
              Replies
            </button>
            <button
              onClick={() => { setCategoryFilter("bounce"); setSelectedSender(null); }}
              className={`flex-1 rounded-full py-1.5 text-center font-semibold transition-all ${
                categoryFilter === "bounce" 
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" 
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
              }`}
            >
              Bounces
            </button>
            <button
              onClick={() => { setCategoryFilter(""); setSelectedSender(null); }}
              className={`flex-1 rounded-full py-1.5 text-center font-semibold transition-all ${
                categoryFilter === "" 
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" 
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
              }`}
            >
              All
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <Input
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 focus-visible:ring-1 focus-visible:ring-blue-500 rounded-lg"
            />
          </div>
        </div>

        <ScrollArea className="flex-1 bg-zinc-50/50 dark:bg-zinc-900/30">
          {loadingSenders ? (
            <div className="p-8 text-center text-xs text-zinc-500 font-medium">Loading conversation threads...</div>
          ) : filteredSenders.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-400">
              {search ? "No matches found." : "No emails found for this mailbox."}
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredSenders.map((sender) => {
                const isActive = selectedSender === sender.fromAddress;
                const initials = (sender.fromName || sender.fromAddress).substring(0, 1).toUpperCase();
                const avatarBg = getAvatarColor(sender.fromName || sender.fromAddress);
                const hasUnread = sender.unreadCount > 0;
                
                return (
                  <button
                    key={sender.fromAddress}
                    onClick={() => handleSenderClick(sender)}
                    className={`w-full text-left p-3.5 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40 transition-colors flex items-start gap-3 relative ${
                      isActive 
                        ? "bg-blue-50/80 dark:bg-blue-950/20 border-l-4 border-blue-600" 
                        : hasUnread 
                          ? "bg-white dark:bg-zinc-800/50" 
                          : ""
                    }`}
                  >
                    {/* Avatar Icon */}
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-sm ${avatarBg}`}>
                      {initials}
                    </div>

                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-xs truncate ${hasUnread ? "font-bold text-zinc-900 dark:text-white" : "font-semibold text-zinc-700 dark:text-zinc-300"}`}>
                          {sender.fromName || sender.fromAddress.split("@")[0]}
                        </span>
                        <span className="text-[10px] text-zinc-400 shrink-0 font-medium">
                          {formatDistanceToNow(new Date(sender.latestDate), { addSuffix: false })}
                        </span>
                      </div>
                      
                      <div className="text-[11px] truncate text-zinc-500 font-medium">
                        {sender.fromAddress}
                      </div>
                      
                      <div className={`text-[11px] truncate mt-1 ${hasUnread ? "font-semibold text-zinc-900 dark:text-zinc-100" : "text-zinc-500"}`}>
                        {sender.latestSubject}
                      </div>
                      
                      <div className="text-[10px] text-zinc-400 truncate line-clamp-1">
                        {sender.latestText}
                      </div>

                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-zinc-400 font-medium">
                          {sender.totalCount} {sender.totalCount === 1 ? "email" : "emails"}
                        </span>
                        {hasUnread && (
                          <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 font-bold rounded-full">
                            {sender.unreadCount} new
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Column 3: Conversation View */}
      <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm overflow-hidden">
        {selectedSender ? (
          <>
            {/* Sender Header */}
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ${getAvatarColor(selectedSenderName || selectedSender)}`}>
                  {(selectedSenderName || selectedSender).substring(0, 1).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-100">{selectedSenderName}</h3>
                  <p className="text-[11px] text-zinc-500 font-medium">{selectedSender}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  onClick={handleSync}
                  title="Refresh Conversation"
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

            {/* Message Thread */}
            <ScrollArea className="flex-1 bg-zinc-50/30 dark:bg-zinc-900/10 p-6">
              {loadingMessages ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <Card key={i} className="animate-pulse border-zinc-100 dark:border-zinc-800">
                      <CardContent className="h-32 bg-zinc-100/50 dark:bg-zinc-800/50" />
                    </Card>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-xs text-zinc-500 p-8">No messages found.</div>
              ) : (
                <div className="space-y-4">
                  {/* Large Subject header for the thread */}
                  <div className="pb-2 border-b border-zinc-100 dark:border-zinc-800">
                    <h1 className="text-base font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                      {messages[0]?.subject}
                    </h1>
                  </div>

                  {messages.map((msg) => {
                    const isHtml = !!msg.html;
                    const msgInitials = (msg.fromName || msg.fromAddress).substring(0, 1).toUpperCase();
                    
                    return (
                      <Card 
                        key={msg._id} 
                        className={`border-zinc-200/70 dark:border-zinc-800 shadow-sm transition-all overflow-hidden ${
                          msg.isRead 
                            ? "bg-white dark:bg-zinc-900" 
                            : "border-l-4 border-l-blue-600 bg-white dark:bg-zinc-900"
                        }`}
                        onMouseEnter={() => handleMessageOpen(msg)}
                        onClick={() => handleMessageOpen(msg)}
                      >
                        <CardContent className="p-5 space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs ${getAvatarColor(msg.fromName || msg.fromAddress)}`}>
                                {msgInitials}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-zinc-800 dark:text-zinc-200">
                                    {msg.fromName || msg.fromAddress.split("@")[0]}
                                  </span>
                                  <span className="text-[10px] text-zinc-400 font-mono">
                                    &lt;{msg.fromAddress}&gt;
                                  </span>
                                </div>
                                <p className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1 font-medium">
                                  <Calendar className="h-3 w-3 text-zinc-400" />
                                  {format(new Date(msg.date), "PPP p")}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-zinc-400 font-semibold bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                                to: {msg.toAddress}
                              </span>
                              {!msg.isRead && (
                                <Badge className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5">NEW</Badge>
                              )}
                            </div>
                          </div>

                          {/* Email Body Rendering */}
                          <div className="border border-zinc-100 dark:border-zinc-800 rounded-xl p-4 bg-zinc-50/50 dark:bg-zinc-900/50 overflow-x-auto min-h-[80px]">
                            {isHtml ? (
                              <iframe
                                srcDoc={`
                                  <html>
                                    <head>
                                      <style>
                                        body { 
                                          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                                          font-size: 13.5px;
                                          line-height: 1.6;
                                          color: #3f3f46;
                                          margin: 0;
                                          padding: 4px;
                                        }
                                        a { color: #2563eb; text-decoration: underline; }
                                      </style>
                                    </head>
                                    <body>
                                      ${msg.html}
                                    </body>
                                  </html>
                                `}
                                className="w-full min-h-[220px] border-0"
                                sandbox="allow-same-origin allow-popups"
                                title={`Email Content ${msg._id}`}
                              />
                            ) : (
                              <p className="text-xs whitespace-pre-line text-zinc-700 dark:text-zinc-300 leading-relaxed">{msg.text}</p>
                            )}
                          </div>

                          {msg.aiDraft && (
                            <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-900/30 rounded-xl p-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                  <Sparkles className="h-3.5 w-3.5" />
                                  Suggested AI Draft Reply
                                </span>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-6 px-2 text-[10px] text-amber-700 hover:text-amber-800 hover:bg-amber-100/50"
                                  onClick={() => setReplyBody(msg.aiDraft || "")}
                                >
                                  Use Draft
                                </Button>
                              </div>
                              <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 whitespace-pre-line italic">
                                "{msg.aiDraft}"
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Sticky Reply Editor */}
            <div className="border-t border-zinc-200/80 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <CornerUpLeft className="h-4 w-4 text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-500">
                    Reply to <span className="text-zinc-800 dark:text-zinc-200 font-bold">{selectedSenderName}</span>
                  </span>
                </div>
                
                {/* Account Selector for replying */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-400 font-bold">FROM:</span>
                  <select
                    value={replyAccountId}
                    onChange={(e) => setReplyAccountId(e.target.value)}
                    className="h-7.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {imapAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.username})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl focus-within:ring-1 focus-within:ring-blue-500 overflow-hidden bg-zinc-50/30 dark:bg-zinc-950/20">
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder={`Type your response to ${selectedSenderName || "this sender"}...`}
                  rows={4}
                  className="w-full bg-transparent px-3.5 py-3 text-xs placeholder:text-zinc-400 focus:outline-none resize-none border-0 text-zinc-800 dark:text-zinc-200"
                  disabled={isSendingReply}
                />
                
                <div className="flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                      title="Attach file (mock)"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                      title="Insert emoji (mock)"
                    >
                      <Smile className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button 
                      onClick={handleSendReply} 
                      disabled={isSendingReply || !replyBody.trim()}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-sm flex items-center gap-1.5 h-8"
                    >
                      {isSendingReply ? (
                        "Sending..."
                      ) : (
                        <>
                          <span>Send</span>
                          <Send className="h-3.5 w-3.5" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-600 p-8 text-center bg-zinc-50/10 dark:bg-zinc-900/50">
            <div className="h-16 w-16 rounded-full bg-blue-50/80 dark:bg-blue-950/10 flex items-center justify-center mb-4">
              <Mail className="h-8 w-8 text-blue-500/60" />
            </div>
            <h3 className="font-bold text-sm text-zinc-700 dark:text-zinc-300">No conversation selected</h3>
            <p className="text-[11px] max-w-xs mt-1 text-zinc-500 dark:text-zinc-500 leading-normal">
              Select a conversation from the sidebar to read and reply. You can filter by sender account or inbox categories.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

