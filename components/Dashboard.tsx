import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { TrendingUp, TrendingDown, PiggyBank, Wallet, ArrowUpRight, ArrowDownRight, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts';

interface Props {
  user: User;
  alerts?: string[];
}

export default function Dashboard({ user, alerts = [] }: Props) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'transactions'),
      where('uid', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'transactions'));

    return () => unsub();
  }, [user]);

  useEffect(() => {
    const q = query(
      collection(db, 'budgets'),
      where('uid', '==', user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      setBudgets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'budgets'));

    return () => unsub();
  }, [user]);

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome - totalExpenses;
  const savings = totalIncome > 0 ? totalIncome - totalExpenses : -totalExpenses;

  // Category Data for Pie Chart
  const categoryData = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc: any[], t) => {
      const existing = acc.find(item => item.name === t.category);
      if (existing) {
        existing.value += t.amount;
      } else {
        acc.push({ name: t.category, value: t.amount });
      }
      return acc;
    }, []);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // Budget vs Spent Data
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const budgetVsSpent = budgets
    .filter(b => b.month === currentMonth && b.year === currentYear)
    .map(b => {
      const spent = transactions
        .filter(t => t.type === 'expense' && t.category === b.category && 
                    new Date(t.date.seconds * 1000).getMonth() + 1 === currentMonth &&
                    new Date(t.date.seconds * 1000).getFullYear() === currentYear)
        .reduce((sum, t) => sum + t.amount, 0);
      return {
        name: b.category,
        budget: b.amount,
        spent: spent
      };
    });

  if (loading) return <div className="flex items-center justify-center h-full">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div key={i} className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{alert}</p>
            </div>
          ))}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Income" amount={totalIncome} icon={TrendingUp} color="text-emerald-500" bg="bg-emerald-500/10" />
        <StatCard title="Total Expenses" amount={totalExpenses} icon={TrendingDown} color="text-red-500" bg="bg-red-500/10" />
        <StatCard title="Net Savings" amount={savings} icon={PiggyBank} color="text-blue-500" bg="bg-blue-500/10" />
        <StatCard title="Balance" amount={balance} icon={Wallet} color="text-purple-500" bg="bg-purple-500/10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expenses by Category */}
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-6">Expenses by Category</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f1f1f', border: '1px solid #262626', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Budget vs Spent */}
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-6">Budget vs Spent (Current Month)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={budgetVsSpent}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f1f1f', border: '1px solid #262626', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend />
                <Bar dataKey="budget" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="spent" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold mb-6">Recent Transactions</h3>
          <div className="space-y-4">
            {transactions.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between p-4 bg-[#1f1f1f] rounded-xl border border-[#262626]">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${t.type === 'income' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                    {t.type === 'income' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="font-medium">{t.description}</p>
                    <p className="text-xs text-gray-500">{t.category} • {new Date(t.date.seconds * 1000).toLocaleDateString()}</p>
                  </div>
                </div>
                <p className={`font-bold ${t.type === 'income' ? 'text-emerald-500' : 'text-red-500'}`}>
                  {t.type === 'income' ? '+' : '-'}₹{t.amount.toFixed(2)}
                </p>
              </div>
            ))}
            {transactions.length === 0 && (
              <p className="text-center text-gray-500 py-8">No transactions yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, amount, icon: Icon, color, bg }: any) {
  return (
    <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6">
      <div className="flex justify-between items-start mb-4">
        <p className="text-sm text-gray-400 font-medium">{title}</p>
        <div className={`p-2 rounded-lg ${bg} ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-2xl font-bold">₹{amount.toFixed(2)}</p>
    </div>
  );
}
