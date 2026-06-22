import { useParams } from 'react-router-dom';

export default function InvoiceDetailPage() {
  const { id } = useParams();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Invoice Detail</h1>
      <p className="text-slate-500">Invoice ID: {id}</p>
    </div>
  );
}
