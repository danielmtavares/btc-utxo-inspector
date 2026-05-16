function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }

  return value;
}

export function formatJson(value: unknown): string {
  return `${JSON.stringify(value, jsonReplacer, 2)}\n`;
}
