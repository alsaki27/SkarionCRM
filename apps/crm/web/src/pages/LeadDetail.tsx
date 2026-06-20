import { useNavigate, useParams } from 'react-router-dom';
import { useLead, useDeleteEntity, useSummarizeLead, useDraftOutreach, useScoreLead, useSuggestNextAction } from '../hooks/use-api.js';
import { ArrowLeft, Target, Mail, Phone, Building2, Calendar, FileText, Pencil, Trash2, Sparkles, Copy, Check, MessageSquare, Star, Zap, Loader2, X } from 'lucide-react';
import { cn } from '../lib/utils.js';
import { useState } from 'react';
import ActivityTimeline from '../components/ActivityTimeline.js';
import ActivityForm from '../components/ActivityForm.js';
import LeadForm from '../components/forms/LeadForm.js';
import type { ActivityType } from '../api.js';

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useLead(id ?? '');
  const deleteMutation = useDeleteEntity();
  const summarizeMutation = useSummarizeLead(id ?? '');
  const draftMutation = useDraftOutreach(id ?? '');
  const scoreMutation = useScoreLead(id ?? '');
  const suggestMutation = useSuggestNextAction(id ?? '');
  const [editOpen, setEditOpen] = useState(false);
  const [activityType, setActivityType] = useState<ActivityType | null>(null);
  const [aiPanel, setAiPanel] = useState<'summary' | 'outreach' | 'score' | 'next' | null>(null);
  const [outreachTone, setOutreachTone] = useState('professional');
  const [outreachChannel, setOutreachChannel] = useState('email');
  const [copied, setCopied] = useState(false);

  if (isLoading) return <div className="text-slate-500">Loading lead...</div>;
  if (!data?.lead) return <div className="text-slate-500">Lead not found</div>;

  const lead = data.lead;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const TONE_OPTIONS = [
    { value: 'short', label: 'Short / Direct' },
    { value: 'professional', label: 'Professional' },
    { value: 'warm', label: 'Warm / Community' },
    { value: 'sales', label: 'Sales-focused' },
    { value: 'candidate', label: 'Candidate-friendly' },
  ];

  const CHANNEL_OPTIONS = [
    { value: 'email', label: 'Email' },
    { value: 'linkedin', label: 'LinkedIn DM' },
    { value: 'sms', label: 'SMS / WhatsApp' },
  ];

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate('/leads')}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={16} /> Back to leads
      </button>

      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-medium">
              {lead.firstName.charAt(0)}{lead.lastName.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-semibold">{lead.firstName} {lead.lastName}</h1>
              <div className="text-slate-500 text-sm">{lead.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('px-3 py-1 rounded-full text-sm font-medium capitalize',
              lead.status === 'new' ? 'bg-blue-100 text-blue-700' :
              lead.status === 'contacted' ? 'bg-amber-100 text-amber-700' :
              lead.status === 'qualified' ? 'bg-green-100 text-green-700' :
              lead.status === 'converted' ? 'bg-purple-100 text-purple-700' :
              'bg-slate-100 text-slate-600'
            )}>
              {lead.status}
            </span>
            <button onClick={() => setEditOpen(true)} className="p-2 rounded hover:bg-slate-100 text-slate-500">
              <Pencil size={16} />
            </button>
            <button
              onClick={() => {
                deleteMutation.mutate({ type: 'leads', id: lead.id }, { onSuccess: () => navigate('/leads') });
              }}
              className="p-2 rounded hover:bg-red-100 text-red-500"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="flex items-center gap-2 text-sm">
            <Mail size={16} className="text-slate-400" />
            <span>{lead.email}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Phone size={16} className="text-slate-400" />
            <span>{lead.phone ?? 'No phone'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Building2 size={16} className="text-slate-400" />
            <span>{lead.companyName ?? 'No company'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar size={16} className="text-slate-400" />
            <span>Created {new Date(lead.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Target size={16} className="text-slate-400" />
            <span className="capitalize">{lead.source.replace('_', ' ')}</span>
          </div>
        </div>

        {lead.notes && (
          <div className="mt-6">
            <h3 className="font-medium text-sm mb-2 flex items-center gap-2">
              <FileText size={16} /> Notes
            </h3>
            <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{lead.notes}</p>
          </div>
        )}

        {/* AI Actions */}
        <div className="mt-6 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-blue-500" />
            <span className="text-sm font-medium text-slate-700">AI Actions</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setAiPanel(aiPanel === 'summary' ? null : 'summary'); summarizeMutation.mutate(); }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors',
                aiPanel === 'summary' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 hover:bg-slate-50'
              )}
            >
              <Sparkles size={14} />
              Summarize
            </button>
            <button
              onClick={() => setAiPanel(aiPanel === 'outreach' ? null : 'outreach')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors',
                aiPanel === 'outreach' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 hover:bg-slate-50'
              )}
            >
              <MessageSquare size={14} />
              Draft Outreach
            </button>
            <button
              onClick={() => { setAiPanel(aiPanel === 'score' ? null : 'score'); scoreMutation.mutate(); }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors',
                aiPanel === 'score' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 hover:bg-slate-50'
              )}
            >
              <Star size={14} />
              Score Lead
            </button>
            <button
              onClick={() => { setAiPanel(aiPanel === 'next' ? null : 'next'); suggestMutation.mutate(); }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors',
                aiPanel === 'next' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 hover:bg-slate-50'
              )}
            >
              <Zap size={14} />
              Next Action
            </button>
          </div>

          {/* AI Panel Content */}
          {aiPanel === 'summary' && (
            <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-800">AI Summary</span>
                <button onClick={() => setAiPanel(null)} className="text-blue-500 hover:text-blue-700"><X size={14} /></button>
              </div>
              {summarizeMutation.isPending ? (
                <div className="flex items-center gap-2 text-sm text-blue-600"><Loader2 size={14} className="animate-spin" /> Summarizing...</div>
              ) : summarizeMutation.data ? (
                <div className="text-sm text-blue-900 whitespace-pre-wrap">{summarizeMutation.data.summary}</div>
              ) : (
                <div className="text-sm text-blue-600">Could not generate summary. AI may not be configured.</div>
              )}
            </div>
          )}

          {aiPanel === 'outreach' && (
            <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-blue-800">Draft Outreach</span>
                <button onClick={() => setAiPanel(null)} className="text-blue-500 hover:text-blue-700"><X size={14} /></button>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="text-xs text-blue-700 font-medium mb-1 block">Tone</label>
                  <select
                    value={outreachTone}
                    onChange={(e) => setOutreachTone(e.target.value)}
                    className="w-full rounded border border-blue-200 px-2 py-1.5 text-sm bg-white"
                  >
                    {TONE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-blue-700 font-medium mb-1 block">Channel</label>
                  <select
                    value={outreachChannel}
                    onChange={(e) => setOutreachChannel(e.target.value)}
                    className="w-full rounded border border-blue-200 px-2 py-1.5 text-sm bg-white"
                  >
                    {CHANNEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <button
                onClick={() => draftMutation.mutate({ tone: outreachTone, channel: outreachChannel })}
                disabled={draftMutation.isPending}
                className="mb-3 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
              >
                {draftMutation.isPending ? <><Loader2 size={14} className="animate-spin" /> Drafting...</> : <><Sparkles size={14} /> Generate Draft</>}
              </button>
              {draftMutation.data && (
                <div className="relative">
                  <div className="text-sm text-blue-900 whitespace-pre-wrap bg-white rounded-lg p-3 border border-blue-200">
                    {draftMutation.data.draft}
                  </div>
                  <button
                    onClick={() => handleCopy(draftMutation.data.draft)}
                    className="absolute top-2 right-2 p-1.5 rounded bg-white shadow border border-blue-200 text-blue-600 hover:bg-blue-50"
                    title="Copy to clipboard"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              )}
            </div>
          )}

          {aiPanel === 'score' && (
            <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-800">Lead Score</span>
                <button onClick={() => setAiPanel(null)} className="text-blue-500 hover:text-blue-700"><X size={14} /></button>
              </div>
              {scoreMutation.isPending ? (
                <div className="flex items-center gap-2 text-sm text-blue-600"><Loader2 size={14} className="animate-spin" /> Scoring...</div>
              ) : scoreMutation.data ? (
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg',
                    scoreMutation.data.score >= 70 ? 'bg-green-500' : scoreMutation.data.score >= 40 ? 'bg-amber-500' : 'bg-red-500'
                  )}>
                    {scoreMutation.data.score}
                  </div>
                  <div className="text-sm text-blue-900">{scoreMutation.data.reasoning}</div>
                </div>
              ) : (
                <div className="text-sm text-blue-600">Could not score lead. AI may not be configured.</div>
              )}
            </div>
          )}

          {aiPanel === 'next' && (
            <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-800">Suggested Next Action</span>
                <button onClick={() => setAiPanel(null)} className="text-blue-500 hover:text-blue-700"><X size={14} /></button>
              </div>
              {suggestMutation.isPending ? (
                <div className="flex items-center gap-2 text-sm text-blue-600"><Loader2 size={14} className="animate-spin" /> Analyzing...</div>
              ) : suggestMutation.data ? (
                <div className="text-sm text-blue-900 whitespace-pre-wrap">{suggestMutation.data.suggestion}</div>
              ) : (
                <div className="text-sm text-blue-600">Could not suggest next action. AI may not be configured.</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <ActivityTimeline
          filters={{ contactId: lead.id }}
          entityName={`${lead.firstName} ${lead.lastName}`}
          onAddActivity={(type) => setActivityType(type)}
        />
      </div>

      <LeadForm open={editOpen} onClose={() => setEditOpen(false)} lead={lead} />
      {activityType && (
        <ActivityForm
          open={!!activityType}
          onClose={() => setActivityType(null)}
          type={activityType}
          filters={{ contactId: lead.id }}
          entityName={`${lead.firstName} ${lead.lastName}`}
        />
      )}
    </div>
  );
}
