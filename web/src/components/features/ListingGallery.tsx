import Image from "next/image";

type Props = {
  images: string[];
  title: string;
};

export default function ListingGallery({ images, title }: Props) {
  if (images.length === 0) {
    return (
      <div className="aspect-[16/10] w-full rounded-xl bg-neutral-100" />
    );
  }

  const [cover, ...rest] = images;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl md:col-span-3">
        <Image
          src={cover}
          alt={title}
          fill
          priority
          sizes="(min-width: 768px) 100vw, 100vw"
          className="object-cover"
        />
      </div>

      {rest.length > 0 && (
        <div className="grid grid-cols-3 gap-3 md:col-span-3">
          {rest.slice(0, 6).map((src, i) => (
            <div
              key={src + i}
              className="relative aspect-square overflow-hidden rounded-lg"
            >
              <Image
                src={src}
                alt={`${title} ${i + 2}`}
                fill
                sizes="(min-width: 768px) 33vw, 33vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}