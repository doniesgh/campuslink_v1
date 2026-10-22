export default function Avatar({ name = 'U' }: { name?: string }) {
  return (
    <div className="grid h-9 w-9 flex-none place-items-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
      {name[0]?.toUpperCase()}
    </div>
  );
}
