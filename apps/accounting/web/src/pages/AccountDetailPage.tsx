import { useParams } from 'react-router-dom';

export default function AccountDetailPage() {
  const { id } = useParams();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Account Detail</h1>
      <p className="text-slate-500">Account ID: {id}</p>
    </div>
  );
}
