import { useParams } from 'react-router-dom';

export default function EmployeeDetailPage() {
  const { id } = useParams();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Employee Detail</h1>
      <p className="text-slate-500">Employee ID: {id}</p>
    </div>
  );
}
