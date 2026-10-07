"use client";

import CollectionScrollBridge from "@/app/components/CollectionScrollBridge";
import CollectionCollapseProbe from "@/app/components/collection/CollectionCollapseProbe";

export default function LanguageLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <CollectionScrollBridge />
      {/* Above the collection segment, not inside it: a probe mounted within the
          listing cannot observe the listing failing to render. Inert off /collection. */}
      <CollectionCollapseProbe />
      {children}
    </>
  );
}
