import React, { useState } from 'react';
import { trpc } from '../../api';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Loading } from '../../components/ui/Loading';
import { addToast } from '../../components/ui/Toast';
import {
  Search,
  Grid,
  List,
  FileText,
  Trash2,
  Upload,
  Filter,
  X,
  Calendar,
  User,
  Building,
  Receipt,
} from 'lucide-react';

interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
  entityType: string;
  entityName: string;
}

const entityTypeIcons: Record<string, React.ReactNode> = {
  contact: <User size={14} />,
  employee: <User size={14} />,
  transaction: <Receipt size={14} />,
  organization: <Building size={14} />,
};

const entityTypeLabels: Record<string, string> = {
  contact: 'Contact',
  employee: 'Employee',
  transaction: 'Transaction',
  organization: 'Organization',
  invoice: 'Invoice',
  contract: 'Contract',
};

export default function DocumentLibrary(): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const query = trpc.document.list.useQuery({
    search: searchQuery,
    entityType: entityFilter === 'all' ? undefined : entityFilter,
    page,
    pageSize,
  });

  const deleteMutation = trpc.document.delete.useMutation({
    onSuccess: () => {
      addToast('success', 'Document deleted');
      query.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to delete document');
    },
  });

  const createMutation = trpc.document.create.useMutation({
    onSuccess: () => {
      addToast('success', 'Document created');
      query.refetch();
    },
    onError: (err) => {
      addToast('error', err.message || 'Failed to create document');
    },
  });

  const documents: Document[] = query.data?.documents ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleDelete = (id: string) => {
    if (!confirm('Delete this document?')) return;
    deleteMutation.mutate({ id });
  };

  const handleSimulateUpload = () => {
    const types = ['PDF', 'DOCX', 'XLSX', 'PNG'];
    const entities = ['contact', 'employee', 'transaction', 'organization', 'invoice', 'contract'];
    const type = types[Math.floor(Math.random() * types.length)];
    const entity = entities[Math.floor(Math.random() * entities.length)];
    createMutation.mutate({
      name: `Document_${Date.now()}.${type.toLowerCase()}`,
      type,
      size: Math.floor(Math.random() * 5000000) + 1000,
      entityType: entity,
      entityId: `demo-${entity}-${Date.now()}`,
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const clearFilters = () => {
    setEntityFilter('all');
    setSearchQuery('');
    setPage(1);
  };

  const hasActiveFilters = entityFilter !== 'all' || searchQuery !== '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Document Library</h1>
          <p className="page-subtitle">Manage documents and attachments</p>
        </div>
        <Button onClick={handleSimulateUpload} loading={createMutation.isPending}>
          <Upload size={16} className="mr-2" />
          Upload Document
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <div className="p-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="form-input pl-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={entityFilter}
                onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
                className="form-input"
              >
                <option value="all">All Types</option>
                <option value="contact">Contact</option>
                <option value="employee">Employee</option>
                <option value="transaction">Transaction</option>
                <option value="organization">Organization</option>
                <option value="invoice">Invoice</option>
                <option value="contract">Contract</option>
              </select>
              <div className="flex rounded-md border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-primary-50 text-primary-600' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <Grid size={16} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-primary-50 text-primary-600' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <List size={16} />
                </button>
              </div>
            </div>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Clear all filters
            </button>
          )}
        </div>
      </Card>

      {/* Documents */}
      {query.isLoading && !documents.length ? (
        <Loading message="Loading documents..." />
      ) : query.isError ? (
        <div className="py-12 text-center">
          <p className="text-sm text-red-600 mb-3">Failed to load documents</p>
          <Button variant="secondary" onClick={() => query.refetch()}>Retry</Button>
        </div>
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents found"
          description={hasActiveFilters ? 'Try adjusting your filters.' : 'Upload your first document to get started.'}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {documents.map((doc) => (
            <div key={doc.id} className="card hover:shadow-md transition-shadow">
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                    <FileText size={20} className="text-gray-500" />
                  </div>
                  <Badge variant="gray" className="text-xs">
                    {doc.type}
                  </Badge>
                </div>
                <h3 className="mt-3 text-sm font-medium text-gray-900 truncate" title={doc.name}>
                  {doc.name}
                </h3>
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                  {entityTypeIcons[doc.entityType] || <FileText size={14} />}
                  <span>{entityTypeLabels[doc.entityType] || doc.entityType}</span>
                  <span className="text-gray-300">|</span>
                  <span>{formatSize(doc.size)}</span>
                </div>
                <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                  <Calendar size={12} />
                  <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(doc.id)}
                    loading={deleteMutation.isPending && deleteMutation.variables?.id === doc.id}
                  >
                    <Trash2 size={14} className="text-red-500" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <div className="divide-y divide-gray-200">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 flex-shrink-0">
                  <FileText size={20} className="text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                    <Badge variant="gray" className="text-xs">{doc.type}</Badge>
                    <span>{entityTypeLabels[doc.entityType] || doc.entityType}</span>
                    <span className="text-gray-300">|</span>
                    <span>{formatSize(doc.size)}</span>
                    <span className="text-gray-300">|</span>
                    <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(doc.id)}
                  loading={deleteMutation.isPending && deleteMutation.variables?.id === doc.id}
                >
                  <Trash2 size={14} className="text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Pagination */}
      {documents.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing <span className="font-medium">{(page - 1) * pageSize + 1}</span> to{' '}
            <span className="font-medium">{Math.min(page * pageSize, total)}</span> of{' '}
            <span className="font-medium">{total}</span> results
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Prev
            </Button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
