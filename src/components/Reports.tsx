import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { TrendingUp, TrendingDown, PiggyBank, Wallet } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area } from 'recharts';

interface Props {
  user: User;
}

export default function Reports({ user }: Props) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'transactions'),
      where('uid', '==', user.uid),
      orderBy('date', 'asc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'transactions'));

    return () => unsub();
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'budgets'), where('uid', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setBudgets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'budgets'));
    return () => unsub();
  }, [user]);

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const balance = totalIncome - totalExpenses;
  const savings = totalIncome > 0 ? totalIncome - totalExpenses : -totalExpenses;

  // Category-wise Spending
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

  // Monthly Spending Trend
  const monthlyTrend = transactions.reduce((acc: any[], t) => {
    const date = new Date(t.date.seconds * 1000);
    const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
    const existing = acc.find(item => item.name === monthYear);
    if (existing) {
      if (t.type === 'income') existing.income += t.amount;
      else existing.expenses += t.amount;
    } else {
      acc.push({
        name: monthYear,
        income: t.type === 'income' ? t.amount : 0,
        expenses: t.type === 'expense' ? t.amount : 0
      });
    }
    return acc;
  }, []);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4'];

  if (loading) return <div className="flex items-center justify-center h-full">Loading...</div>;

  return (
    <div className="space-y-8 pb-12">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Income" amount={totalIncome} icon={TrendingUp} color="text-emerald-500" bg="bg-emerald-500/10" />
        <StatCard title="Total Expenses" amount={totalExpenses} icon={TrendingDown} color="text-red-500" bg="bg-red-500/10" />
        <StatCard title="Net Savings" amount={savings} icon={PiggyBank} color="text-blue-500" bg="bg-blue-500/10" />
        <StatCard title="Balance" amount={balance} icon={Wallet} color="text-purple-500" bg="bg-purple-500/10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Monthly Trend */}
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-6">Income vs Expenses Trend</h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrend}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f1f1f', border: '1px solid #262626', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend />
                <Area type="monotone" dataKey="income" stroke="#10b981" fillOpacity={1} fill="url(#colorIncome)" />
                <Area type="monotone" dataKey="expenses" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpenses)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-6">Category-wise Spending</h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
