"use client";

import { useState } from "react";
import { Plus, Users, Shield, Layers } from "lucide-react";

const spaces = [
  { id: "1", name: "默认空间", role: "admin", members: 3, desc: "个人工作空间", created: "2026-06-15" },
  { id: "2", name: "企智研发团队", role: "admin", members: 5, desc: "产品研发协作空间", created: "2026-06-20" },
];

export default function SpacesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  return (
    <div className="h-full flex flex-col bg-white dark:bg-black">
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">空间</h1>
          <p className="text-sm text-zinc-500">多租户 · 团队协作 · 数据隔离</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus size={16} /> 创建空间
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {spaces.map(s => (
            <div key={s.id} className="border rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Layers size={20} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">{s.name}</h3>
                  <p className="text-xs text-zinc-500">{s.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-zinc-400">
                <span className="flex items-center gap-1"><Users size={12} /> {s.members} 成员</span>
                <span className="flex items-center gap-1"><Shield size={12} /> {s.role}</span>
                <span>{s.created}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm border">
            <h2 className="text-lg font-semibold mb-4">创建空间</h2>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="空间名称" className="w-full px-3 py-2 text-sm rounded-lg border outline-none mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border rounded-lg">取消</button>
              <button className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
