const GEMINI_TYPES: Record<string, string> = {
  object: 'OBJECT',
  string: 'STRING',
  number: 'NUMBER',
  integer: 'INTEGER',
  boolean: 'BOOLEAN',
  array: 'ARRAY',
  null: 'NULL',
};

export function toGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...schema };
  if (typeof schema.type === 'string') result.type = GEMINI_TYPES[schema.type.toLowerCase()] ?? schema.type.toUpperCase();
  if (schema.properties && typeof schema.properties === 'object') {
    const properties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema.properties as Record<string, unknown>)) {
      if (value && typeof value === 'object') properties[key] = toGeminiSchema(value as Record<string, unknown>);
    }
    result.properties = properties;
  }
  if (schema.items && typeof schema.items === 'object') result.items = toGeminiSchema(schema.items as Record<string, unknown>);
  return result;
}