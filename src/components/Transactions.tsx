import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, addDoc, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { Plus, Search, Filter, Trash2, Edit2, X, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

interface Props {
  user: User;
}

export default function Transactions({ user }: Props) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    amount: '',
    type: 'expense',
    category: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    goalId: ''
  });

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
    const q = query(collection(db, 'categories'), where('uid', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'categories'));
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'savingsGoals'), where('uid', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setGoals(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'savingsGoals'));
    return () => unsub();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amount = parseFloat(formData.amount);
      const data = {
        ...formData,
        amount,
        uid: user.uid,
        date: Timestamp.fromDate(new Date(formData.date)),
        createdAt: Timestamp.now()
      };

      if (editingId) {
        const oldTransaction = transactions.find(t => t.id === editingId);
        
        // Revert old goal amount if it was a savings deposit
        if (oldTransaction.category === 'Savings' && oldTransaction.goalId) {
          const goal = goals.find(g => g.id === oldTransaction.goalId);
          if (goal) {
            await updateDoc(doc(db, 'savingsGoals', goal.id), {
              currentAmount: goal.currentAmount - oldTransaction.amount
            });
          }
        }

        await updateDoc(doc(db, 'transactions', editingId), data);
        
        // Apply new goal amount if it's a savings deposit
        if (formData.category === 'Savings' && formData.goalId) {
          const goal = goals.find(g => g.id === formData.goalId);
          if (goal) {
            await updateDoc(doc(db, 'savingsGoals', goal.id), {
              currentAmount: goal.currentAmount + amount
            });
          }
        }
      } else {
        await addDoc(collection(db, 'transactions'), data);
        
        // Apply goal amount if it's a savings deposit
        if (formData.category === 'Savings' && formData.goalId) {
          const goal = goals.find(g => g.id === formData.goalId);
          if (goal) {
            await updateDoc(doc(db, 'savingsGoals', goal.id), {
              currentAmount: goal.currentAmount + amount
            });
          }
        }
      }

      setShowModal(false);
      setEditingId(null);
      setFormData({
        amount: '',
        type: 'expense',
        category: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        goalId: ''
      });
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'transactions');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const t = transactions.find(t => t.id === id);
      if (t.category === 'Savings' && t.goalId) {
        const goal = goals.find(g => g.id === t.goalId);
        if (goal) {
          await updateDoc(doc(db, 'savingsGoals', goal.id), {
            currentAmount: goal.currentAmount - t.amount
          });
        }
      }
      await deleteDoc(doc(db, 'transactions', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'transactions');
    }
  };

  const handleEdit = (t: any) => {
    setEditingId(t.id);
    setFormData({
      amount: t.amount.toString(),
      type: t.type,
      category: t.category,
      description: t.description,
      date: new Date(t.date.seconds * 1000).toISOString().split('T')[0],
      goalId: t.goalId || ''
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold">Transactions</h3>
          <p className="text-gray-400 text-sm">{transactions.length} total transactions</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/80 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Transaction
        </button>
      </div>

      {/* Transactions List */}
      <div className="bg-[#141414] border border-[#262626] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#262626] text-gray-400 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Description</th>
                <th className="px-6 py-4 font-medium">Category</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">Amount</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626]">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-[#1f1f1f] transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-300">
                    {new Date(t.date.seconds * 1000).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 font-medium">{t.description}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-[#262626] rounded-full text-xs text-gray-300">
                      {t.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${t.type === 'income' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                      {t.type}
                    </span>
                  </td>
                  <td className={`px-6 py-4 font-bold ${t.type === 'income' ? 'text-emerald-500' : 'text-red-500'}`}>
                    {t.type === 'income' ? '+' : '-'}₹{t.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleEdit(t)} className="p-2 text-gray-400 hover:text-white hover:bg-[#262626] rounded-lg transition-all">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteId(t.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No transactions found. Add your first one!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction? This action cannot be undone."
      />

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#141414] border border-[#262626] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">{editingId ? 'Edit' : 'Add'} Transaction</h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-[#1f1f1f] border border-[#262626] rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-[#1f1f1f] border border-[#262626] rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Category</label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value, goalId: '' })}
                  className="w-full bg-[#1f1f1f] border border-[#262626] rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
                >
                  <option value="">Select category</option>
                  {categories.filter(c => c.type === formData.type).map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                  {formData.type === 'expense' && !categories.some(c => c.name === 'Savings' && c.type === 'expense') && (
                    <option value="Savings">Savings (Auto-created)</option>
                  )}
                </select>
              </div>

              {formData.category === 'Savings' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Select Savings Goal</label>
                  <select
                    required
                    value={formData.goalId}
                    onChange={(e) => setFormData({ ...formData, goalId: e.target.value })}
                    className="w-full bg-[#1f1f1f] border border-[#262626] rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary border-emerald-500/50"
                  >
                    <option value="">Select a goal to deposit into</option>
                    {goals.map(goal => (
                      <option key={goal.id} value={goal.id}>{goal.name} (Current: ₹{goal.currentAmount.toFixed(2)})</option>
                    ))}
                  </select>
                  {goals.length === 0 && (
                    <p className="text-xs text-amber-500 mt-1">No savings goals found. Create one in the Savings section first!</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Grocery shopping"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-[#1f1f1f] border border-[#262626] rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full bg-[#1f1f1f] border border-[#262626] rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/80 transition-all mt-4"
              >
                {editingId ? 'Update' : 'Add'} Transaction
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
