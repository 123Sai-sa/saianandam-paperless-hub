import React, { useState } from 'react';
import {
  MessageSquare,
  Send,
  Users,
  Hash,
  Smile,
  Paperclip,
  CheckCheck,
} from 'lucide-react';
import { ChatMessage, ChatGroup, User, ALL_INSTITUTIONAL_CLASSES } from '../types';

interface CommunityChatViewProps {
  groups: ChatGroup[];
  activeGroupId: string;
  onSelectGroup: (groupId: string) => void;
  messages: ChatMessage[];
  currentUser: User;
  onSendMessage: (groupId: string, text: string) => Promise<ChatMessage>;
  onPlayChime: () => void;
}

export const CommunityChatView: React.FC<CommunityChatViewProps> = ({
  groups,
  activeGroupId,
  onSelectGroup,
  messages,
  currentUser,
  onSendMessage,
  onPlayChime,
}) => {
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  const [chatClassFilter, setChatClassFilter] = useState<string>('All');

  // Filter groups class-wise:
  // For students: only show their own class forum and general school forum
  // For teachers/admins: allow filtering by class or viewing all
  const isStudent = currentUser.role === 'student';
  const myClass = currentUser.classSec || 'Class 8-A';

  // Ensure every class in ALL_INSTITUTIONAL_CLASSES has an accessible channel for faculty/students
  const allClassGroups: ChatGroup[] = React.useMemo(() => {
    const existingClassMap = new Set(groups.filter(g => g.classSec).map(g => g.classSec));
    const dynamicGroups: ChatGroup[] = ALL_INSTITUTIONAL_CLASSES
      .filter(cls => !existingClassMap.has(cls))
      .map(cls => ({
        id: `grp-${cls.toLowerCase().replace(/\s+/g, '-')}`,
        name: `${cls} Academic Forum`,
        description: `Classwise study group & faculty announcements for ${cls}`,
        memberRoles: ['admin', 'teacher', 'student'] as ('admin' | 'teacher' | 'student')[],
        classSec: cls,
        membersCount: 30,
        unreadCount: 0,
      }));
    return [...groups, ...dynamicGroups];
  }, [groups]);

  const visibleGroups = allClassGroups.filter((g) => {
    if (isStudent) {
      // Student only sees their class group and schoolwide general group
      return g.classSec === myClass || !g.classSec || g.id === 'grp-general';
    }
    // Teachers & admins: can filter or view all
    if (chatClassFilter === 'All') return true;
    return g.classSec === chatClassFilter || !g.classSec;
  });

  const activeGroup = visibleGroups.find((g) => g.id === activeGroupId) || visibleGroups[0] || allClassGroups[0];
  const groupMessages = messages.filter((m) => m.groupId === (activeGroup?.id || activeGroupId));

  // If active group is not visible to this student, auto-select their class group
  React.useEffect(() => {
    if (activeGroup && activeGroup.id !== activeGroupId) {
      onSelectGroup(activeGroup.id);
    }
  }, [activeGroup?.id, activeGroupId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeGroup) return;

    setSending(true);
    try {
      await onSendMessage(activeGroup.id, inputText.trim());
      setInputText('');
      onPlayChime();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col md:flex-row h-[75vh]">
      {/* Left Channel Sidebar */}
      <div className="w-full md:w-80 bg-slate-950 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              <span>Classwise Digital Channels</span>
            </h2>
            {isStudent && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {myClass}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {isStudent ? `Classroom chat for ${myClass} and institutional circulars` : 'Zero-paper classwise academic forums'}
          </p>

          {/* Teacher/Admin Class Filter */}
          {!isStudent && (
            <div className="mt-2.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Filter by Class ({ALL_INSTITUTIONAL_CLASSES.length} Classes):
              </label>
              <select
                value={chatClassFilter}
                onChange={(e) => setChatClassFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-indigo-500"
              >
                <option value="All">All Class Forums</option>
                {ALL_INSTITUTIONAL_CLASSES.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls} Forum
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="p-2 space-y-1 overflow-y-auto flex-1">
          {visibleGroups.map((group) => {
            const isCurrent = group.id === activeGroup?.id;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => onSelectGroup(group.id)}
                className={`w-full text-left p-3 rounded-xl transition flex items-start gap-2.5 cursor-pointer ${
                  isCurrent
                    ? 'bg-indigo-600/20 border border-indigo-500/30 text-white'
                    : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Hash className={`w-4 h-4 shrink-0 mt-0.5 ${isCurrent ? 'text-indigo-400' : 'text-slate-500'}`} />
                <div className="overflow-hidden">
                  <div className="text-xs font-bold truncate flex items-center justify-between">
                    <span className="truncate">{group.name}</span>
                    {group.classSec && (
                      <span className="ml-1 text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-normal shrink-0">
                        {group.classSec}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">
                    {group.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-900/60">
        {/* Channel Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hash className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-sm font-bold text-white">
                {activeGroup?.name}
              </h3>
              <p className="text-[11px] text-slate-400">
                {activeGroup?.description}
              </p>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 hidden sm:block">
            {activeGroup?.membersCount} Registered Members
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {groupMessages.map((msg) => {
            const isMe = msg.senderId === currentUser.id;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-2 mb-1 text-[11px]">
                  <span className="font-bold text-slate-300">
                    {msg.senderName}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 uppercase font-semibold">
                    {msg.role}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div
                  className={`max-w-md p-3.5 rounded-2xl text-xs leading-relaxed ${
                    isMe
                      ? 'bg-indigo-600 text-white rounded-tr-xs shadow-md shadow-indigo-600/20'
                      : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-xs'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center gap-2">
          <input
            type="text"
            placeholder={`Message #${activeGroup?.name || 'channel'}...`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition"
          />
          <button
            type="submit"
            disabled={sending || !inputText.trim()}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
