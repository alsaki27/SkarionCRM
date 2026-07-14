import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Linkedin,
  Mail,
  Facebook,
  MessageCircle,
  Instagram,
  Phone,
  Plus,
  ChevronDown,
} from 'lucide-react';
import { cn } from '../lib/utils.js';
import { useLeadChannels, useLogOutreachAction } from '../hooks/use-api.js';
import { showToast } from '../stores/toast.js';
import { type OutreachChannel, type LeadChannelStage } from '../api.js';

const CHANNEL_ICON: Record<
  OutreachChannel,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  linkedin: Linkedin,
  instagram: Instagram,
  facebook: Facebook,
  whatsapp: MessageCircle,
  email: Mail,
  phone: Phone,
};

const CHANNEL_LABEL: Record<OutreachChannel, string> = {
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  email: 'Email',
  phone: 'Phone',
};

const ALL_STAGES: LeadChannelStage[] = [
  'not_started',
  'connection_request_sent',
  'connection_accepted',
  'message_sent',
  'awaiting_reply',
  'in_conversation',
  'warm_up_needed',
  'replied',
  'booked_call',
  'no_response',
];

const STAGE_BADGE: Record<LeadChannelStage, string> = {
  not_started: 'bg-slate-100 text-slate-600',
  connection_request_sent: 'bg-blue-100 text-blue-700',
  connection_accepted: 'bg-green-100 text-green-700',
  message_sent: 'bg-blue-100 text-blue-700',
  awaiting_reply: 'bg-amber-100 text-amber-700',
  in_conversation: 'bg-green-100 text-green-700',
  warm_up_needed: 'bg-orange-100 text-orange-700',
  replied: 'bg-green-100 text-green-700',
  booked_call: 'bg-purple-100 text-purple-700',
  no_response: 'bg-red-100 text-red-700',
};

interface ChannelPanelProps {
  leadId: string;
}

export default function ChannelPanel({ leadId }: ChannelPanelProps) {
  const { data, isLoading } = useLeadChannels(leadId);
  const logAction = useLogOutreachAction(leadId);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const channels = data?.channels ?? [];

  const handleLog = (channel: string) => {
    logAction.mutate(
      { channel, action: 'log_attempt', stage: 'message_sent' },
      {
        onSuccess: () => showToast('Attempt logged', 'success'),
        onError: (err) =>
          showToast(err instanceof Error ? err.message : 'Failed to log attempt', 'error'),
      }
    );
  };

  const handleStage = (channel: string, stage: LeadChannelStage) => {
    logAction.mutate(
      { channel, action: 'set_stage', stage },
      {
        onSuccess: () => showToast(`Stage set to ${stage.replace(/_/g, ' ')}`, 'success'),
        onError: (err) =>
          showToast(err instanceof Error ? err.message : 'Failed to set stage', 'error'),
      }
    );
    setOpenDropdown(null);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6">
      <h3 className="font-medium text-sm mb-3 text-slate-700">Outreach Channels</h3>

      {isLoading ? (
        <div className="text-sm text-slate-500">Loading channels...</div>
      ) : channels.length === 0 ? (
        <div className="text-sm text-slate-400">No outreach channels tracked yet.</div>
      ) : (
        <div className="space-y-3">
          {channels.map((ch) => {
            const Icon = CHANNEL_ICON[ch.channel] ?? Mail;
            const stage = (ch.stage as LeadChannelStage) ?? 'not_started';
            return (
              <div
                key={ch.id}
                className="flex flex-wrap items-center gap-3 bg-slate-50 border border-slate-200 rounded-md px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-[140px]">
                  <Icon size={16} className="text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">
                    {CHANNEL_LABEL[ch.channel] ?? ch.channel}
                  </span>
                </div>

                <span
                  className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium capitalize',
                    STAGE_BADGE[stage]
                  )}
                >
                  {stage.replace(/_/g, ' ')}
                </span>

                <span className="text-xs text-slate-500">
                  {ch.attemptCount} attempt{ch.attemptCount === 1 ? '' : 's'}
                </span>

                <span className="text-xs text-slate-400">
                  {ch.lastAttemptAt
                    ? `Last attempt ${formatDistanceToNow(new Date(ch.lastAttemptAt), { addSuffix: true })}`
                    : 'No attempts yet'}
                </span>

                <div className="flex-1" />

                <button
                  onClick={() => handleLog(ch.channel)}
                  disabled={logAction.isPending}
                  className="flex items-center gap-1 px-2 py-1 text-xs border border-slate-300 rounded-md bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-50"
                >
                  <Plus size={12} /> Log Attempt
                </button>

                <div className="relative">
                  <button
                    onClick={() => setOpenDropdown(openDropdown === ch.id ? null : ch.id)}
                    className="flex items-center gap-1 px-2 py-1 text-xs border border-slate-300 rounded-md bg-white hover:bg-slate-50 text-slate-600"
                  >
                    Set stage <ChevronDown size={12} />
                  </button>
                  {openDropdown === ch.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)} />
                      <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 max-h-64 overflow-y-auto">
                        {ALL_STAGES.map((s) => (
                          <button
                            key={s}
                            onClick={() => handleStage(ch.channel, s)}
                            className={cn(
                              'w-full text-left px-3 py-2 text-sm hover:bg-slate-50 capitalize',
                              stage === s && 'font-medium text-blue-600 bg-blue-50'
                            )}
                          >
                            {s.replace(/_/g, ' ')}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
