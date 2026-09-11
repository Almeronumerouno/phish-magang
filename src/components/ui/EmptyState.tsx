export function EmptyState({ message = "Halaman masih kosong" }: { message?: string }) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[400px]">
      <p className="text-base text-empty">{message}</p>
    </div>
  );
}
