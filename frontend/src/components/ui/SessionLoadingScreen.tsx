export default function SessionLoadingScreen({ message = "Cargando sesión…" }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-slate-500">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#3eafd4] border-t-transparent" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
