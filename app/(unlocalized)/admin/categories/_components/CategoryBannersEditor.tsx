'use client';

import { useCallback, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { uploadCmsImage } from '@/lib/upload-cms-image';
import {
  BANNER_CADENCE,
  MAX_COLLECTION_BANNERS,
  type CollectionBanner,
} from '@/lib/collection-banners';

/**
 * Grid banners for a category listing.
 *
 * Placement is a single number - how many products the banner follows - because
 * the listing renders 2 columns on mobile and 4 from lg. A row number would mean
 * a different place on each; the storefront derives the row from this ordinal.
 */

type Draft = CollectionBanner & { uploading?: boolean };

function newDraft(order: number): Draft {
  return {
    id: `banner-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    media: { type: 'image', src: '' },
    href: '',
    alt: '',
    afterProducts: BANNER_CADENCE.desktop * (order + 1),
    enabled: true,
    order,
  };
}

async function authedFetch(input: string, init?: RequestInit) {
  const token = await auth.currentUser?.getIdToken();
  return fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
}

export default function CategoryBannersEditor({ categoryId }: { categoryId: string }) {
  const [banners, setBanners] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const endpoint = `/api/admin/categories/${categoryId}/merchandising/banners`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await authedFetch(endpoint);
        const data = await response.json();
        if (!cancelled && response.ok) setBanners(data.banners ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  const update = useCallback((id: string, patch: Partial<Draft>) => {
    setBanners((current) =>
      current.map((banner) => (banner.id === id ? { ...banner, ...patch } : banner))
    );
  }, []);

  const move = (index: number, direction: -1 | 1) => {
    setBanners((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((banner, i) => ({ ...banner, order: i }));
    });
  };

  const upload = async (id: string, file: File, slot: 'src' | 'poster') => {
    update(id, { uploading: true });
    try {
      const url = await uploadCmsImage(file, 'categories');
      setBanners((current) =>
        current.map((banner) => {
          if (banner.id !== id) return banner;
          const isVideo = file.type.startsWith('video/');
          if (slot === 'poster') {
            return banner.media.type === 'video'
              ? { ...banner, media: { ...banner.media, poster: url }, uploading: false }
              : { ...banner, uploading: false };
          }
          return {
            ...banner,
            media: isVideo
              ? {
                  type: 'video',
                  src: url,
                  poster: banner.media.type === 'video' ? banner.media.poster : '',
                }
              : { type: 'image', src: url },
            uploading: false,
          };
        })
      );
    } catch {
      update(id, { uploading: false });
      setMessage({ tone: 'error', text: 'Upload failed' });
    }
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await authedFetch(endpoint, {
        method: 'PUT',
        body: JSON.stringify({
          // Strip the transient upload flag; it is UI state, not part of the record.
          banners: banners.map((banner) => {
            const record = { ...banner };
            delete record.uploading;
            return record;
          }),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Save failed');

      // The server returns what it stored. Anything incomplete was dropped, and
      // showing that back is more honest than leaving a row that did not persist.
      const stored: CollectionBanner[] = data.banners ?? [];
      setBanners(stored);
      setMessage(
        stored.length < banners.length
          ? {
              tone: 'error',
              text: `Saved ${stored.length}. ${banners.length - stored.length} incomplete banner(s) were dropped — each needs media, an internal link starting with "/", and a placement.`,
            }
          : { tone: 'ok', text: `Saved ${stored.length} banner(s).` }
      );
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
        Loading banners…
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Grid banners</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Each banner fills one card slot. Placement is “after N cards”, so it lands correctly on
            both layouts — the grid is 2 columns on mobile and 4 on desktop, and the row is worked
            out from this number. At most one banner per row. A useful rhythm is every{' '}
            {BANNER_CADENCE.desktop} cards (≈2 rows on desktop, ≈
            {Math.round(BANNER_CADENCE.desktop / 2)} on mobile).
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Banners are hidden when a shopper filters or searches.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save banners'}
        </button>
      </div>

      {message && (
        <p
          className={`mt-3 rounded-md px-3 py-2 text-sm ${
            message.tone === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="mt-5 space-y-4">
        {banners.length === 0 && (
          <p className="rounded-md border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
            No banners yet.
          </p>
        )}

        {banners.map((banner, index) => (
          <div key={banner.id} className="rounded-md border border-gray-200 p-4">
            <div className="flex flex-wrap items-start gap-4">
              <div className="h-24 w-20 shrink-0 overflow-hidden rounded border border-gray-200 bg-gray-50">
                {banner.media.src ? (
                  banner.media.type === 'video' ? (
                    <video src={banner.media.src} muted className="h-full w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={banner.media.src} alt="" className="h-full w-full object-cover" />
                  )
                ) : (
                  <span className="flex h-full items-center justify-center px-1 text-center text-[10px] text-gray-400">
                    No media
                  </span>
                )}
              </div>

              <div className="grid min-w-[16rem] flex-1 gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-gray-700">Media</span>
                  <input
                    type="file"
                    accept="image/*,video/mp4,video/webm"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void upload(banner.id, file, 'src');
                      event.target.value = '';
                    }}
                    className="block w-full text-xs text-gray-600"
                  />
                  {banner.uploading && <span className="text-xs text-gray-500">Uploading…</span>}
                  <span className="mt-1 block text-xs text-gray-500">
                    Image, or MP4/WebM. Not GIF — a short GIF loop is many times the size of the
                    same clip as video.
                  </span>
                </label>

                {banner.media.type === 'video' && (
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-gray-700">
                      Poster image <span className="text-red-600">*</span>
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void upload(banner.id, file, 'poster');
                        event.target.value = '';
                      }}
                      className="block w-full text-xs text-gray-600"
                    />
                    <span className="mt-1 block text-xs text-gray-500">
                      Shown before the video loads, and instead of it for reduced-motion. Required.
                    </span>
                  </label>
                )}

                <label className="text-sm">
                  <span className="mb-1 block font-medium text-gray-700">Links to</span>
                  <input
                    type="text"
                    value={banner.href}
                    onChange={(event) => update(banner.id, { href: event.target.value })}
                    placeholder="/collection/women/shoes/platform-loafers"
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <span className="mt-1 block text-xs text-gray-500">
                    Internal path, no language prefix — that is added per locale.
                  </span>
                </label>

                <label className="text-sm">
                  <span className="mb-1 block font-medium text-gray-700">After how many cards</span>
                  <input
                    type="number"
                    min={0}
                    value={banner.afterProducts}
                    onChange={(event) =>
                      update(banner.id, { afterProducts: Number(event.target.value) })
                    }
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <span className="mt-1 block text-xs text-gray-500">
                    Counts grid cards, and the listing shows one card per colour — a style in three
                    colours takes three slots. 0 puts the banner first.
                  </span>
                </label>

                <label className="text-sm sm:col-span-2">
                  <span className="mb-1 block font-medium text-gray-700">Accessible label</span>
                  <input
                    type="text"
                    value={banner.alt}
                    onChange={(event) => update(banner.id, { alt: event.target.value })}
                    placeholder="Shop platform loafers"
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <span className="mt-1 block text-xs text-gray-500">
                    Describes where it goes, not what the picture shows — it is a link.
                  </span>
                </label>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={banner.enabled}
                    onChange={(event) => update(banner.id, { enabled: event.target.checked })}
                  />
                  Enabled
                </label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40"
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === banners.length - 1}
                    className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40"
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setBanners((current) => current.filter((entry) => entry.id !== banner.id))
                  }
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setBanners((current) => [...current, newDraft(current.length)])}
        disabled={banners.length >= MAX_COLLECTION_BANNERS}
        className="mt-4 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        Add banner
      </button>
      {banners.length >= MAX_COLLECTION_BANNERS && (
        <span className="ml-3 text-xs text-gray-500">
          Maximum {MAX_COLLECTION_BANNERS} per category.
        </span>
      )}
    </section>
  );
}
