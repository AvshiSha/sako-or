"use client";

import { createContext, useContext, type RefObject } from "react";
import type { CollectionBrowseSnapshot, CollectionKey } from "@/lib/collectionBrowseStore";

type CollectionBrowseContextValue = {
  browseKey?: CollectionKey;
  snapshotRef?: RefObject<CollectionBrowseSnapshot | null>;
};

const CollectionBrowseContext = createContext<CollectionBrowseContextValue>({});

export function CollectionBrowseProvider({
  browseKey,
  snapshotRef,
  children,
}: {
  browseKey?: CollectionKey;
  snapshotRef: RefObject<CollectionBrowseSnapshot | null>;
  children: React.ReactNode;
}) {
  return (
    <CollectionBrowseContext.Provider value={{ browseKey, snapshotRef }}>
      <div
        data-collection-browse-key={browseKey ?? undefined}
        style={{ display: "contents" }}
      >
        {children}
      </div>
    </CollectionBrowseContext.Provider>
  );
}

export function useCollectionBrowseContext() {
  return useContext(CollectionBrowseContext);
}
