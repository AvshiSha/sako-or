'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
  Bars3Icon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { getAdminAuthHeaders } from '@/lib/admin-api';
import type { MerchandisingPreviewRow } from '@/lib/campaign-merchandising-types';
import { parseVariantKey } from '@/lib/campaign-merchandising-types';

type CategoryMerchandisingMode = 'auto' | 'pinned' | 'manual';

type CategoryMeta = {
  id: string;
  name?: { en?: string; he?: string };
  slug?: { en?: string; he?: string };
  path?: string;
  level?: number;
  parentId?: string;
  isEnabled?: boolean;
};

function SortableRow({
  row,
  index,
  onRemove,
}: {
  row: MerchandisingPreviewRow;
  index: number;
  onRemove: (key: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.variantKey,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-white border rounded-lg ${
        row.isStale ? 'border-amber-300 bg-amber-50' : 'border-gray-200'
      }`}
    >
      <button
        type="button"
        className="cursor-grab text-gray-400 hover:text-gray-600 touch-none"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <Bars3Icon className="h-5 w-5" />
      </button>
      <span className="text-xs text-gray-400 w-8 text-right shrink-0">{index + 1}</span>
      <div className="relative h-14 w-14 shrink-0 rounded overflow-hidden bg-gray-100">
        {row.imageUrl ? (
          <img src={row.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-xs text-gray-400">
            N/A
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{row.productName}</p>
        <p className="text-xs text-gray-500 truncate">
          {row.colorName || row.colorSlug}
          {row.sku ? ` · ${row.sku}` : ''}
        </p>
        {row.isStale && (
          <p className="text-xs text-amber-700 flex items-center gap-1 mt-0.5">
            <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0" />
            Stale — missing variant
          </p>
        )}
      </div>
      <span className="text-xs text-gray-500 shrink-0">{row.totalStock ?? 0} in stock</span>
      <button
        type="button"
        onClick={() => onRemove(row.variantKey)}
        className="text-red-500 hover:text-red-700 p-1 shrink-0"
        title="Remove from list"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function CategoryMerchandisingBoard({ categoryId }: { categoryId: string }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryMeta | null>(null);
  const [mode, setMode] = useState<CategoryMerchandisingMode>('auto');
  const [orderedKeys, setOrderedKeys] = useState<string[]>([]);
  const [previewMap, setPreviewMap] = useState<Map<string, MerchandisingPreviewRow>>(new Map());
  const [poolSearch, setPoolSearch] = useState('');
  const [poolItems, setPoolItems] = useState<MerchandisingPreviewRow[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [poolPage, setPoolPage] = useState(1);
  const [poolHasMore, setPoolHasMore] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const orderedKeysRef = useRef(orderedKeys);
  orderedKeysRef.current = orderedKeys;
  const userRef = useRef(user);
  userRef.current = user;
  const poolSearchRef = useRef(poolSearch);
  poolSearchRef.current = poolSearch;
  const poolItemsRef = useRef(poolItems);
  poolItemsRef.current = poolItems;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const poolPageRef = useRef(poolPage);
  poolPageRef.current = poolPage;

  const setModeLive = useCallback((next: CategoryMerchandisingMode) => {
    modeRef.current = next;
    setMode(next);
  }, []);

  const setOrderedKeysLive = useCallback((value: string[] | ((prev: string[]) => string[])) => {
    setOrderedKeys((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      orderedKeysRef.current = next;
      return next;
    });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const rows: MerchandisingPreviewRow[] = useMemo(
    () =>
      orderedKeys.map((key) => {
        const preview = previewMap.get(key);
        const parsed = parseVariantKey(key);
        return (
          preview ?? {
            variantKey: key,
            productId: parsed?.productId ?? key,
            colorSlug: parsed?.colorSlug ?? '',
            productName: parsed ? `${parsed.productId} (${parsed.colorSlug})` : key,
            isActive: false,
            isStale: true,
          }
        );
      }),
    [orderedKeys, previewMap]
  );

  const staleCount = rows.filter((r) => r.isStale).length;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 76,
    overscan: 8,
  });

  const loadMerchandising = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await getAdminAuthHeaders(currentUser);
      const res = await fetch(`/api/admin/categories/${categoryId}/merchandising`, { headers });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load merchandising');
      }
      const data = await res.json();
      setCategory(data.category);
      setModeLive(data.merchandising.mode);
      setOrderedKeysLive(data.merchandising.orderedVariantKeys ?? []);
      const map = new Map<string, MerchandisingPreviewRow>();
      for (const row of data.previews ?? []) {
        map.set(row.variantKey, row);
      }
      setPreviewMap(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [categoryId, setModeLive, setOrderedKeysLive]);

  const fetchPool = useCallback(
    async (
      options?: { excludeKeys?: string[]; page?: number; append?: boolean }
    ) => {
      const currentUser = userRef.current;
      if (!currentUser || modeRef.current === 'auto') return;

      const append = options?.append ?? false;
      const page = Math.max(1, options?.page ?? 1);
      const excludeKeys = options?.excludeKeys;
      const showSpinner = !append && poolItemsRef.current.length === 0;
      if (showSpinner) setPoolLoading(true);

      try {
        setPoolError(null);
        const headers = await getAdminAuthHeaders(currentUser);
        const exclude = excludeKeys ?? orderedKeysRef.current;
        const params = new URLSearchParams({
          page: String(page),
          pageSize: '50',
          exclude: exclude.join(','),
        });
        const q = poolSearchRef.current.trim();
        if (q) params.set('q', q);
        const res = await fetch(`/api/admin/categories/${categoryId}/merchandising/pool?${params}`, {
          headers,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed to load pool (HTTP ${res.status})`);
        }
        const data = await res.json();
        setPoolHasMore(Boolean(data.hasMore));
        setPoolPage(data.page || page);
        if (append) {
          setPoolItems((prev) => {
            const seen = new Set(prev.map((p) => p.variantKey));
            const next = (data.previews ?? []) as MerchandisingPreviewRow[];
            const deduped = next.filter((p) => !seen.has(p.variantKey));
            return [...prev, ...deduped];
          });
        } else {
          setPoolItems(data.previews ?? []);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to load pool';
        setPoolError(message);
        // Avoid misleading "No more variants" on failure.
        if (!append) {
          setPoolItems([]);
          setPoolHasMore(false);
          setPoolPage(page);
        }
      } finally {
        if (showSpinner) setPoolLoading(false);
      }
    },
    [categoryId]
  );

  const fetchPoolRef = useRef(fetchPool);
  fetchPoolRef.current = fetchPool;

  useEffect(() => {
    if (user?.uid) void loadMerchandising();
  }, [loadMerchandising, user?.uid]);

  // Only refetch pool when search/mode changes — not when curated order or keys change.
  useEffect(() => {
    if (mode === 'auto' || !user?.uid) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      setPoolPage(1);
      void fetchPoolRef.current({ page: 1, append: false });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user?.uid, mode, poolSearch]);

  const handleSave = async () => {
    if (!user) return;
    const modeToSave = modeRef.current;
    const keysToSave = orderedKeysRef.current;
    setSaving(true);
    setSaveMessage(null);
    setError(null);
    try {
      const headers = await getAdminAuthHeaders(user);
      const res = await fetch(`/api/admin/categories/${categoryId}/merchandising`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ mode: modeToSave, orderedVariantKeys: keysToSave }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }
      const data = await res.json();
      const savedKeys = data.merchandising.orderedVariantKeys ?? [];
      setModeLive(data.merchandising.mode);
      setOrderedKeysLive(savedKeys);
      const map = new Map<string, MerchandisingPreviewRow>();
      for (const row of data.previews ?? []) {
        map.set(row.variantKey, row);
      }
      setPreviewMap(map);
      setSaveMessage('Saved successfully');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async (strategy: 'replace' | 'append', save: boolean) => {
    if (!user) return;
    setSyncing(true);
    setError(null);
    try {
      const headers = await getAdminAuthHeaders(user);
      const res = await fetch(`/api/admin/categories/${categoryId}/merchandising/sync`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ strategy, save }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to sync');
      }
      const data = await res.json();
      // If save=false we should not override the user's current mode (they may change it while sync runs).
      const nextMode = (save ? data.merchandising.mode : modeRef.current) as CategoryMerchandisingMode;
      const syncedKeys = data.merchandising.orderedVariantKeys ?? [];
      setOrderedKeysLive(syncedKeys);
      if (save) setModeLive(nextMode);
      const map = new Map<string, MerchandisingPreviewRow>();
      for (const row of data.previews ?? []) {
        map.set(row.variantKey, row);
      }
      setPreviewMap(map);
      setSaveMessage(
        save
          ? `Synced and saved ${data.syncedCount} variants`
          : `Loaded ${data.syncedCount} variants — click Save to persist`
      );
      if (nextMode !== 'auto') {
        setPoolPage(1);
        void fetchPool({ excludeKeys: syncedKeys, page: 1, append: false });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to sync');
    } finally {
      setSyncing(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrderedKeysLive((keys) => {
      const oldIndex = keys.indexOf(String(active.id));
      const newIndex = keys.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return keys;
      return arrayMove(keys, oldIndex, newIndex);
    });
  };

  const addFromPool = (row: MerchandisingPreviewRow) => {
    if (orderedKeys.includes(row.variantKey)) return;
    setOrderedKeysLive((keys) => [...keys, row.variantKey]);
    setPreviewMap((map) => new Map(map).set(row.variantKey, row));
    setPoolItems((items) => items.filter((i) => i.variantKey !== row.variantKey));
  };

  const removeKey = (key: string) => {
    setOrderedKeysLive((keys) => keys.filter((k) => k !== key));
    const row = previewMap.get(key);
    if (row && mode !== 'auto') {
      setPoolItems((items) => {
        if (items.some((i) => i.variantKey === key)) return items;
        return [row, ...items];
      });
    }
  };

  const removeStale = () => {
    setOrderedKeysLive((keys) => keys.filter((k) => !previewMap.get(k)?.isStale));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-16 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const title = category?.name?.en || category?.name?.he || categoryId;
  const storefrontHref = category?.path ? `/en/collection/${category.path}` : undefined;

  return (
    <div className="min-h-screen bg-gray-50 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Link
              href="/admin/categories"
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-2"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Back to categories
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Merchandising: {title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {orderedKeys.length} curated variants
              {staleCount > 0 && <span className="text-amber-600"> · {staleCount} stale</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {storefrontHref && (
              <Link
                href={storefrontHref}
                target="_blank"
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50"
              >
                <EyeIcon className="h-4 w-4 mr-1" />
                Preview storefront
              </Link>
            )}
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md">
            {error}
          </div>
        )}
        {saveMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 text-sm rounded-md">
            {saveMessage}
          </div>
        )}

        <div className="bg-white shadow rounded-lg p-4 mb-6">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
              <select
                value={mode}
                onChange={(e) => setModeLive(e.target.value as CategoryMerchandisingMode)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-800"
              >
                <option value="auto">Auto (default order)</option>
                <option value="pinned">Pinned (curated top + auto tail)</option>
                <option value="manual">Manual (full curated order + auto tail)</option>
              </select>
            </div>
            <button
              type="button"
              disabled={syncing}
              onClick={() => handleSync('replace', false)}
              className="inline-flex items-center px-3 py-2 border border-gray-700 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 hover:border-gray-700 disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
              Sync from category
            </button>
            <button
              type="button"
              disabled={syncing}
              onClick={() => handleSync('append', false)}
              className="px-3 py-2 border border-gray-600 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 hover:border-gray-700 disabled:opacity-50"
            >
              Append new
            </button>
            <button
              type="button"
              disabled={syncing}
              onClick={() => handleSync('replace', true)}
              className="px-3 py-2 border border-indigo-300 text-indigo-700 rounded-md text-sm hover:bg-indigo-50 disabled:opacity-50"
            >
              Sync &amp; save
            </button>
            {staleCount > 0 && (
              <button
                type="button"
                onClick={removeStale}
                className="px-3 py-2 text-amber-800 border border-amber-300 rounded-md text-sm hover:bg-amber-50"
              >
                Remove stale ({staleCount})
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            <span className="font-medium text-gray-700">Sync from category</span> rebuilds your curated list from
            products in this category (current catalog order).{' '}
            <span className="font-medium text-gray-700">Append new</span> keeps your existing order and adds only new
            variants not already in the list. Neither saves until you click Save or Sync &amp; save. Merchandising
            applies when sort is Relevance; price and newest override merchandising.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {mode !== 'auto' && (
            <div className="lg:col-span-1 bg-white shadow rounded-lg p-4 h-fit max-h-[70vh] flex flex-col">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Add from category pool</h2>
              <div className="relative mb-3">
                <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute left-2 top-2.5" />
                <input
                  type="search"
                  value={poolSearch}
                  onChange={(e) => setPoolSearch(e.target.value)}
                  placeholder="Search name, SKU, color…"
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {poolError ? (
                  <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2">
                    {poolError}
                  </div>
                ) : poolLoading && poolItems.length === 0 ? (
                  <p className="text-sm text-gray-500">Loading pool…</p>
                ) : poolItems.length === 0 ? (
                  <p className="text-sm text-gray-500">No more variants in pool.</p>
                ) : (
                  poolItems.map((row) => (
                    <button
                      key={row.variantKey}
                      type="button"
                      onClick={() => addFromPool(row)}
                      className={`w-full flex items-center gap-2 p-2 rounded border text-left ${
                        row.isStale
                          ? 'border-amber-300 bg-amber-50 hover:bg-amber-100'
                          : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
                      }`}
                    >
                      <div className="h-10 w-10 rounded bg-gray-100 overflow-hidden shrink-0">
                        {row.imageUrl ? (
                          <img src={row.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[10px] text-gray-400">
                            No img
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-900 truncate">{row.productName}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {row.colorName || row.colorSlug}
                          {row.sku ? ` · ${row.sku}` : ''}
                        </p>
                        {row.isStale && <p className="text-[10px] text-amber-700">Incomplete catalog data</p>}
                      </div>
                      <PlusIcon className="h-4 w-4 text-indigo-600 shrink-0" />
                    </button>
                  ))
                )}
              </div>
              {poolHasMore && (
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={() =>
                      void fetchPoolRef.current({
                        page: (poolPageRef.current ?? 1) + 1,
                        append: true,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Load more
                  </button>
                </div>
              )}
            </div>
          )}

          <div
            className={`bg-white shadow rounded-lg p-4 flex flex-col ${
              mode === 'auto' ? 'lg:col-span-3' : 'lg:col-span-2'
            }`}
          >
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              {mode === 'auto' ? 'Curated order (disabled in auto mode)' : 'Curated order'}
            </h2>

            {mode === 'auto' ? (
              <p className="text-sm text-gray-500 py-8 text-center">
                Switch to Pinned or Manual to arrange products. Use Sync from category to import the current order as a
                starting point.
              </p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">
                No variants yet. Sync from category or add from the pool.
              </p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={orderedKeys} strategy={verticalListSortingStrategy}>
                  <div ref={parentRef} className="overflow-auto flex-1" style={{ height: 'min(60vh, 640px)' }}>
                    <div
                      style={{
                        height: `${virtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative',
                      }}
                    >
                      {virtualizer.getVirtualItems().map((virtualRow) => {
                        const row = rows[virtualRow.index];
                        return (
                          <div
                            key={row.variantKey}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              transform: `translateY(${virtualRow.start}px)`,
                              paddingBottom: 8,
                            }}
                          >
                            <SortableRow row={row} index={virtualRow.index} onRemove={removeKey} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

