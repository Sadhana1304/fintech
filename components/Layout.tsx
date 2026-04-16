import React, { useState, useEffect } from 'react';
import { auth, db, logout, OperationType, handleFirestoreError } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, Timestamp, addDoc } from 'firebase/firestore';
import { LayoutDashboard, ReceiptText, WalletCards, Target, Tags, BarChart3, LogOut, Bell, Menu, X, Wallet } from 'lucide-react';
import Dashboard from './Dashboard';
import Transactions from './Transactions';
import Budgets from './Budgets';
import SavingsGoals from './SavingsGoals';
import Categories from './Categories';
import Reports from './Reports';
import { ErrorBoundary } from './ErrorBoundary';

type View = 'dashboard' | 'transactions' | 'budgets' | 'savings' | 'categories' | 'reports';

const DEFAULT_CATEGORIES = [
  { name: 'Food', color: '#10b981', type: 'expense' },
  { name: 'Transport', color: '#3b82f6', type: 'expense' },
  { name: 'Shopping', color: '#f59e0b', type: 'expense' },
  { name: 'Rent', color: '#8b5cf6', type: 'expense' },
  { name: 'Entertainment', color: '#ec4899', type: 'expense' },
  { name: 'Salary', color: '#10b981', type: 'income' },
  { name: 'Utilities', color: '#f97316', type: 'expense' },
  { name: 'Healthcare', color: '#ef4444', type: 'expense' },
  { name: 'Savings', color: '#fbbf24', type: 'expense' },
];

export default function Layout() {
  const [user, setUser] = useState<User | null>(null);
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Initialize Categories
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'categories'), where('uid', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const cats = snap.docs.map(doc => doc.data());
      const existingNames = cats.map(c => c.name);
      
      DEFAULT_CATEGORIES.forEach(async (defaultCat) => {
        if (!existingNames.includes(defaultCat.name)) {
          try {
            await addDoc(collection(db, 'categories'), {
              ...defaultCat,
              uid: user.uid,
              createdAt: Timestamp.now()
            });
          } catch (err) {
            console.error('Error adding default category:', err);
          }
        }
      });
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'categories'));

    return () => unsub();
  }, [user]);

  // Budget Alert Logic
  useEffect(() => {
    if (!user) return;

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const budgetsQuery = query(
      collection(db, 'budgets'),
      where('uid', '==', user.uid),
      where('month', '==', currentMonth),
      where('year', '==', currentYear)
    );

    const transactionsQuery = query(
      collection(db, 'transactions'),
      where('uid', '==', user.uid),
      where('type', '==', 'expense')
    );

    const unsubBudgets = onSnapshot(budgetsQuery, (budgetSnap) => {
      const budgets = budgetSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const unsubTransactions = onSnapshot(transactionsQuery, (transSnap) => {
        const transactions = transSnap.docs.map(doc => doc.data());
        const newNotifications: string[] = [];

        budgets.forEach((budget: any) => {
          const spent = transactions
            .filter(t => t.category === budget.category && 
                        new Date(t.date.seconds * 1000).getMonth() + 1 === budget.month &&
                        new Date(t.date.seconds * 1000).getFullYear() === budget.year)
            .reduce((sum, t) => sum + t.amount, 0);

          if (spent > budget.amount) {
            const percent = ((spent / budget.amount) * 100).toFixed(0);
            newNotifications.push(`🚨 ${budget.category} budget exceeded! Spent ₹${spent.toFixed(2)} of ₹${budget.amount.toFixed(2)} (${percent}%)`);
          } else if (spent > budget.amount * 0.8) {
            newNotifications.push(`⚠️ Warning: You've used 80% of your ${budget.category} budget.`);
          }
        });

        setNotifications(newNotifications);
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'transactions'));

      return () => unsubTransactions();
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'budgets'));

    return () => unsubBudgets();
  }, [user]);

  if (!user) return null;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: ReceiptText },
    { id: 'budgets', label: 'Budgets', icon: WalletCards },
    { id: 'savings', label: 'Savings Goals', icon: Target },
    { id: 'categories', label: 'Categories', icon: Tags },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex overflow-hidden">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-[#141414] border-r border-[#262626] transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
      `}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Wallet className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold italic serif tracking-tight">FinTrack</h1>
        </div>

        <nav className="mt-6 px-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveView(item.id as View);
                setIsSidebarOpen(false);
              }}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                ${activeView === item.id 
                  ? 'bg-primary/10 text-primary font-medium' 
                  : 'text-gray-400 hover:bg-[#1f1f1f] hover:text-white'}
              `}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#262626]">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} alt="User" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{user.displayName}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-[#141414] border-b border-[#262626] flex items-center justify-between px-6">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 text-gray-400 hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </button>

          <h2 className="text-lg font-semibold capitalize">{activeView}</h2>

          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 text-gray-400 hover:text-white relative"
            >
              <Bell className="w-6 h-6" />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-[#1f1f1f] border border-[#262626] rounded-xl shadow-2xl z-50 p-4 max-h-96 overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">Notifications</h3>
                  <button onClick={() => setShowNotifications(false)}><X className="w-4 h-4" /></button>
                </div>
                {notifications.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No new alerts</p>
                ) : (
                  <div className="space-y-3">
                    {notifications.map((note, i) => (
                      <div key={i} className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-200">
                        {note}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#0a0a0a]">
          <ErrorBoundary>
            {activeView === 'dashboard' && <Dashboard user={user} alerts={notifications} />}
            {activeView === 'transactions' && <Transactions user={user} />}
            {activeView === 'budgets' && <Budgets user={user} />}
            {activeView === 'savings' && <SavingsGoals user={user} />}
            {activeView === 'categories' && <Categories user={user} />}
            {activeView === 'reports' && <Reports user={user} />}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
