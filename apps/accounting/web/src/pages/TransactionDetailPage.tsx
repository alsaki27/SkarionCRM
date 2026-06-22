import { useParams } from 'react-router-dom';

export default function TransactionDetailPage() {
  const { id } = useParams();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Transaction Detail</h1>
      <p className="text-slate-500">Transaction ID: {id}</p>
    </div>
  );
}
