import { BookOpen, ArrowLeftRight, FileText, BarChart3 } from 'lucide-react';

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ size: number; className?: string }>; label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="p-2 bg-slate-100 rounded-md">
          <Icon size={18} className="text-slate-600" />
        </div>
      </div>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-slate-500 text-sm">{label}</div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Welcome back to Skarion Books</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={BookOpen} label="Total Assets" value="$0.00" />
        <StatCard icon={ArrowLeftRight} label="Total Liabilities" value="$0.00" />
        <StatCard icon={FileText} label="Net Income" value="$0.00" />
        <StatCard icon={BarChart3} label="Outstanding Invoices" value="$0.00" />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="font-semibold mb-4">Recent Activity</h2>
        <div className="text-slate-400 text-sm text-center py-8">No recent activity</div>
      </div>
    </div>
  );
}
