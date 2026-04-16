import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { Plus, X, Trash2, Edit2, AlertCircle } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

interface Props {
  user: User;
}

export default function Budgets({ user }: Props) {
  const [budgets, setBudgets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    category: '',
    amount: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });

  useEffect(() => {
    const q = query(collection(db, 'budgets'), where('uid', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setBudgets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'budgets'));
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'categories'), where('uid', '==', user.uid), where('type', '==', 'expense'));
    const unsub = onSnapshot(q, (snap) => {
      setCategories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'categories'));
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'transactions'), where('uid', '==', user.uid), where('type', '==', 'expense'));
    const unsub = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'transactions'));
    return () => unsub();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        amount: parseFloat(formData.amount),
        uid: user.uid,
        createdAt: Timestamp.now()
      };

      if (editingId) {
        await updateDoc(doc(db, 'budgets', editingId), data);
      } else {
        await addDoc(collection(db, 'budgets'), data);
      }

      setShowModal(false);
      setEditingId(null);
      setFormData({
        category: '',
        amount: '',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
      });
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'budgets');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'budgets', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'budgets');
    }
  };

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold">Budgets</h3>
          <p className="text-gray-400 text-sm">Manage your monthly category budgets</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/80 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Budget
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {budgets.map((budget) => {
          const spent = transactions
            .filter(t => t.category === budget.category && 
                        new Date(t.date.seconds * 1000).getMonth() + 1 === budget.month &&
                        new Date(t.date.seconds * 1000).getFullYear() === budget.year)
            .reduce((sum, t) => sum + t.amount, 0);
          
          const percentage = Math.min((spent / budget.amount) * 100, 100);
          const isOver = spent > budget.amount;

          return (
            <div key={budget.id} className="bg-[#141414] border border-[#262626] rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-lg font-bold">{budget.category}</h4>
                  <p className="text-xs text-gray-500">{months[budget.month - 1]} {budget.year}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => {
                    setEditingId(budget.id);
                    setFormData({
                      category: budget.category,
                      amount: budget.amount.toString(),
                      month: budget.month,
                      year: budget.year
                    });
                    setShowModal(true);
                  }} className="p-2 text-gray-400 hover:text-white hover:bg-[#262626] rounded-lg">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteId(budget.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Spent: ₹{spent.toFixed(2)}</span>
                  <span className="font-bold">Budget: ₹{budget.amount.toFixed(2)}</span>
                </div>
                <div className="h-2 bg-[#262626] rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${isOver ? 'bg-red-500' : 'bg-primary'}`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                {isOver && (
                  <div className="flex items-center gap-2 text-xs text-red-500 font-medium">
                    <AlertCircle className="w-3 h-3" />
                    Budget exceeded by ₹{(spent - budget.amount).toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {budgets.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500 bg-[#141414] border border-[#262626] rounded-2xl">
            No budgets set. Start by adding one!
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        title="Delete Budget"
        message="Are you sure you want to delete this budget? This will stop tracking your spending against this limit."
      />

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#141414] border border-[#262626] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">{editingId ? 'Edit' : 'Add'} Budget</h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Category</label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-[#1f1f1f] border border-[#262626] rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
                >
                  <option value="">Select category</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Budget Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full bg-[#1f1f1f] border border-[#262626] rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Month</label>
                  <select
                    value={formData.month}
                    onChange={(e) => setFormData({ ...formData, month: parseInt(e.target.value) })}
                    className="w-full bg-[#1f1f1f] border border-[#262626] rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
                  >
                    {months.map((m, i) => (
                      <option key={i} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Year</label>
                  <input
                    type="number"
                    required
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                    className="w-full bg-[#1f1f1f] border border-[#262626] rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/80 transition-all mt-4"
              >
                {editingId ? 'Update' : 'Add'} Budget
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
