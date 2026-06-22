"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

export type ProductGalleryImageProps = {
  src: string;
  alt: string;
  eager?: boolean;
  objectFit?: "cover" | "contain";
  className?: string;
  draggable?: boolean;
};

/** Native img wrapper shared by carousel slides, vertical gallery, and lightbox. */
export const ProductGalleryImage = memo(function ProductGalleryImage({
  src,
  alt,
  eager = false,
  objectFit = "cover",
  className,
  draggable = false,
}: ProductGalleryImageProps) {
  return (
    <div
      className={cn(
        "relative aspect-square h-full w-full overflow-hidden bg-gray-50",
        className
      )}
      style={{ aspectRatio: "1 / 1" }}
    >
      <img
        src={src}
        alt={alt}
        width={600}
        height={600}
        loading={eager ? "eager" : "lazy"}
        decoding={eager ? "sync" : "async"}
        fetchPriority={eager ? "high" : "auto"}
        draggable={draggable}
        className={cn(
          "h-full w-full object-center select-none",
          objectFit === "contain" ? "object-contain" : "object-cover",
          !draggable && "[-webkit-user-drag:none] [user-drag:none]"
        )}
        style={{ aspectRatio: "1 / 1" }}
      />
    </div>
  );
});
