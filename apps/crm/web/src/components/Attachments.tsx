import { useRef } from 'react';
import { Paperclip, Download, Trash2, Upload } from 'lucide-react';
import { useAttachments, useUploadAttachment, useDeleteAttachment } from '../hooks/use-api.js';
import { showToast } from '../stores/toast.js';
import { CRM_API_URL, getAccessToken } from '../api.js';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface AttachmentsProps {
  leadId: string;
}

export default function Attachments({ leadId }: AttachmentsProps) {
  const { data: attachments, isLoading } = useAttachments(leadId);
  const upload = useUploadAttachment(leadId);
  const remove = useDeleteAttachment(leadId);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    upload.mutate(file, {
      onSuccess: () => showToast(`Uploaded "${file.name}"`, 'success'),
      onError: (err) => showToast(err instanceof Error ? err.message : 'Upload failed', 'error'),
    });
  };

  const handleDelete = (id: string, filename: string) => {
    if (!window.confirm(`Delete attachment "${filename}"?`)) return;
    remove.mutate(id, {
      onSuccess: () => showToast('Attachment deleted', 'success'),
      onError: (err) => showToast(err instanceof Error ? err.message : 'Delete failed', 'error'),
    });
  };

  const downloadUrl = (id: string) => {
    const token = getAccessToken();
    return `${CRM_API_URL}/api/leads/attachments/${id}/download?token=${encodeURIComponent(token ?? '')}`;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6">
      <h3 className="font-medium text-sm mb-3 flex items-center gap-2 text-slate-700">
        <Paperclip size={16} /> Attachments
      </h3>

      <div className="flex items-center gap-2 mb-4">
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
          className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-md text-sm hover:bg-slate-50 text-slate-600 disabled:opacity-50"
        >
          <Upload size={16} />
          {upload.isPending ? 'Uploading...' : 'Upload file'}
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-500">Loading attachments...</div>
      ) : attachments && attachments.length > 0 ? (
        <ul className="space-y-2">
          {attachments.map((att) => (
            <li
              key={att.id}
              className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-md px-3 py-2"
            >
              <Paperclip size={16} className="text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-700 truncate">{att.filename}</div>
                <div className="text-xs text-slate-500">
                  {formatSize(att.size)} · {new Date(att.createdAt).toLocaleDateString()}
                </div>
              </div>
              <a
                href={downloadUrl(att.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded hover:bg-slate-200 text-slate-500"
                title="Download"
              >
                <Download size={16} />
              </a>
              <button
                onClick={() => handleDelete(att.id, att.filename)}
                className="p-1.5 rounded hover:bg-red-100 text-red-500"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-sm text-slate-400">No attachments yet.</div>
      )}
    </div>
  );
}
