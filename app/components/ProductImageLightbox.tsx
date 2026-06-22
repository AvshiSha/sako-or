"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

export type ProductImageLightboxProps = {
  images: string[];
  alt: string;
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  direction?: "ltr" | "rtl";
  labels?: {
    close?: string;
    previous?: string;
    next?: string;
    imageOf?: (current: number, total: number) => string;
  };
};

export function ProductImageLightbox({
  images,
  alt,
  initialIndex = 0,
  isOpen,
  onClose,
  direction = "ltr",
  labels,
}: ProductImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const isRtl = direction === "rtl";

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
    }
  }, [isOpen, initialIndex]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i <= 0 ? images.length - 1 : i - 1));
  }, [images.length]);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i >= images.length - 1 ? 0 : i + 1));
  }, [images.length]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        isRtl ? goNext() : goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        isRtl ? goPrev() : goNext();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isRtl, goPrev, goNext]);

  if (images.length === 0) return null;

  const currentSrc = images[currentIndex];
  const imageLabel =
    labels?.imageOf?.(currentIndex + 1, images.length) ??
    `${alt} - ${currentIndex + 1} of ${images.length}`;

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-[70]"
        onClose={onClose}
        aria-label={imageLabel}
      >
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/90" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 flex items-center justify-center p-4 sm:p-8">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-20 rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={labels?.close ?? "Close"}
          >
            <XMarkIcon className="h-6 w-6" aria-hidden />
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={isRtl ? goNext : goPrev}
                className={cn(
                  "absolute top-1/2 z-20 -translate-y-1/2 rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white",
                  isRtl ? "right-2 sm:right-6" : "left-2 sm:left-6"
                )}
                aria-label={labels?.previous ?? "Previous image"}
              >
                <ChevronLeftIcon className="h-8 w-8" aria-hidden />
              </button>
              <button
                type="button"
                onClick={isRtl ? goPrev : goNext}
                className={cn(
                  "absolute top-1/2 z-20 -translate-y-1/2 rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white",
                  isRtl ? "left-2 sm:left-6" : "right-2 sm:right-6"
                )}
                aria-label={labels?.next ?? "Next image"}
              >
                <ChevronRightIcon className="h-8 w-8" aria-hidden />
              </button>
            </>
          )}

          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="relative flex max-h-[90vh] max-w-[90vw] items-center justify-center">
              <img
                src={currentSrc}
                alt={imageLabel}
                width={1200}
                height={1200}
                loading="eager"
                decoding="sync"
                className="max-h-[90vh] max-w-[90vw] object-contain"
              />
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
