import { Building2, Users, Calendar, Clock } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Departments" value="—" color="bg-blue-500" />
        <StatCard icon={Users} label="Employees" value="—" color="bg-green-500" />
        <StatCard icon={Calendar} label="Pending Time Off" value="—" color="bg-yellow-500" />
        <StatCard icon={Clock} label="Recent Activity" value="—" color="bg-purple-500" />
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ size: number }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center text-white`}
        >
          <Icon size={20} />
        </div>
        <div>
          <div className="text-sm text-slate-500">{label}</div>
          <div className="text-xl font-semibold text-slate-900">{value}</div>
        </div>
      </div>
    </div>
  );
}
