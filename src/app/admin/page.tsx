export default function AdminPage() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-zinc-400">
      <div className="text-6xl mb-4">🛡️</div>
      <h2 className="text-xl font-medium">管理后台</h2>
      <p className="text-sm mt-2">仅管理员可访问</p>
    </div>
  );
}
