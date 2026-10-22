export default function PostGallery({ images }: { images?: string[] }) {
  if (!images?.length) return null;
  return (
    <div className="flex gap-2 overflow-x-auto">
      {images.map((src) => (
        <img key={src} src={src} alt="" className="h-44 flex-none rounded-xl object-cover" />
      ))}
    </div>
  );
}
