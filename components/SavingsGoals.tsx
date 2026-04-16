import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { Plus, X, Trash2, Edit2, Target, Trophy } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

interface Props {
  user: User;
}

export default function SavingsGoals({ user }: Props) {
  const [goals, setGoals] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    targetAmount: '',
    currentAmount: '',
    deadline: ''
  });

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
      const data = {
        ...formData,
        targetAmount: parseFloat(formData.targetAmount),
        currentAmount: parseFloat(formData.currentAmount),
        uid: user.uid,
        deadline: formData.deadline ? Timestamp.fromDate(new Date(formData.deadline)) : null,
        createdAt: Timestamp.now()
      };

      if (editingId) {
        await updateDoc(doc(db, 'savingsGoals', editingId), data);
      } else {
        await addDoc(collection(db, 'savingsGoals'), data);
      }

      setShowModal(false);
      setEditingId(null);
      setFormData({
        name: '',
        targetAmount: '',
        currentAmount: '',
        deadline: ''
      });
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'savingsGoals');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'savingsGoals', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'savingsGoals');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold">Savings Goals</h3>
          <p className="text-gray-400 text-sm">Track your progress towards financial milestones</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/80 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Goal
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map((goal) => {
          const percentage = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
          const isCompleted = goal.currentAmount >= goal.targetAmount;

          return (
            <div key={goal.id} className="bg-[#141414] border border-[#262626] rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isCompleted ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary'}`}>
                    {isCompleted ? <Trophy className="w-5 h-5" /> : <Target className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="text-lg font-bold">{goal.name}</h4>
                    {goal.deadline && (
                      <p className="text-xs text-gray-500">Deadline: {new Date(goal.deadline.seconds * 1000).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => {
                    setEditingId(goal.id);
                    setFormData({
                      name: goal.name,
                      targetAmount: goal.targetAmount.toString(),
                      currentAmount: goal.currentAmount.toString(),
                      deadline: goal.deadline ? new Date(goal.deadline.seconds * 1000).toISOString().split('T')[0] : ''
                    });
                    setShowModal(true);
                  }} className="p-2 text-gray-400 hover:text-white hover:bg-[#262626] rounded-lg">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteId(goal.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">₹{goal.currentAmount.toFixed(2)} saved</span>
                  <span className="font-bold">Target: ₹{goal.targetAmount.toFixed(2)}</span>
                </div>
                <div className="h-3 bg-[#262626] rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${isCompleted ? 'bg-emerald-500' : 'bg-primary'}`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <p className="text-right text-xs text-gray-500">{percentage.toFixed(1)}% completed</p>
              </div>
            </div>
          );
        })}
        {goals.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500 bg-[#141414] border border-[#262626] rounded-2xl">
            No savings goals yet. What are you saving for?
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        title="Delete Savings Goal"
        message="Are you sure you want to delete this goal? Your progress data for this goal will be permanently removed."
      />

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#141414] border border-[#262626] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">{editingId ? 'Edit' : 'Add'} Savings Goal</h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Goal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Emergency Fund"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[#1f1f1f] border border-[#262626] rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Target Amount (₹)</label>
                  <input
                    type="number"
                    required
                    value={formData.targetAmount}
                    onChange={(e) => setFormData({ ...formData, targetAmount: e.target.value })}
                    className="w-full bg-[#1f1f1f] border border-[#262626] rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Current Amount (₹)</label>
                  <input
                    type="number"
                    required
                    value={formData.currentAmount}
                    onChange={(e) => setFormData({ ...formData, currentAmount: e.target.value })}
                    className="w-full bg-[#1f1f1f] border border-[#262626] rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Deadline (Optional)</label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  className="w-full bg-[#1f1f1f] border border-[#262626] rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/80 transition-all mt-4"
              >
                {editingId ? 'Update' : 'Add'} Goal
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
