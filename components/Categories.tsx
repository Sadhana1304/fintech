import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { Plus, X, Trash2, Edit2, Palette } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

interface Props {
  user: User;
}

export default function Categories({ user }: Props) {
  const [categories, setCategories] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    color: '#3b82f6',
    type: 'expense'
  });

  useEffect(() => {
    const q = query(collection(db, 'categories'), where('uid', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const cats = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setCategories(cats);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'categories'));
    return () => unsub();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        uid: user.uid,
        createdAt: Timestamp.now()
      };

      if (editingId) {
        await updateDoc(doc(db, 'categories', editingId), data);
      } else {
        await addDoc(collection(db, 'categories'), data);
      }

      setShowModal(false);
      setEditingId(null);
      setFormData({ name: '', color: '#3b82f6', type: 'expense' });
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'categories');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'categories');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold">Categories</h3>
          <p className="text-gray-400 text-sm">Manage expense and income categories</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/80 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Category
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.map((cat) => (
          <div key={cat.id} className="bg-[#141414] border border-[#262626] rounded-2xl p-4 flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }}></div>
              <div>
                <p className="font-medium">{cat.name}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">{cat.type}</p>
              </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => {
                setEditingId(cat.id);
                setFormData({ name: cat.name, color: cat.color, type: cat.type });
                setShowModal(true);
              }} className="p-1.5 text-gray-400 hover:text-white hover:bg-[#262626] rounded-lg">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setDeleteId(cat.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && handleDelete(deleteId)}
        title="Delete Category"
        message="Are you sure you want to delete this category? This will not delete transactions in this category, but they will no longer be associated with it."
      />

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#141414] border border-[#262626] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">{editingId ? 'Edit' : 'Add'} Category</h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Subscriptions"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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

              <div>
                <label className="block text-sm text-gray-400 mb-1">Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-12 h-12 bg-transparent border-none cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="flex-1 bg-[#1f1f1f] border border-[#262626] rounded-xl px-4 py-2 text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/80 transition-all mt-4"
              >
                {editingId ? 'Update' : 'Add'} Category
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
