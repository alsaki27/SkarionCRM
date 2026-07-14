import { useParams } from 'react-router-dom';

export default function DepartmentDetailPage() {
  const { id } = useParams();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Department Detail</h1>
      <p className="text-slate-500">Department ID: {id}</p>
    </div>
  );
}
