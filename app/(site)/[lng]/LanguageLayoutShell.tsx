"use client";

import CollectionScrollBridge from "@/app/components/CollectionScrollBridge";

export default function LanguageLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <CollectionScrollBridge />
      {children}
    </>
  );
}
