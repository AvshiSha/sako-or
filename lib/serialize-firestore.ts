/** Serialize Firestore timestamps and nested objects for RSC → client props. */
export function serializeFirestoreValue<T>(value: T): T {
  if (value === null || value === undefined) return value;

  if (
    typeof value === "object" &&
    "seconds" in (value as object) &&
    "nanoseconds" in (value as object)
  ) {
    const ts = value as unknown as { seconds: number; nanoseconds: number };
    const milliseconds = ts.seconds * 1000 + ts.nanoseconds / 1_000_000;
    return new Date(milliseconds).toISOString() as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeFirestoreValue(item)) as T;
  }

  if (typeof value === "object") {
    const serialized: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      serialized[key] = serializeFirestoreValue(nestedValue);
    }
    return serialized as T;
  }

  return value;
}
