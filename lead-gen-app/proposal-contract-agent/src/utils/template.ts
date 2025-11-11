export function renderTemplate(body: string, variables: Record<string, string | number>): string {
  return body.replace(/{{\s*([\w.]+)\s*}}/g, (_, key: string) => {
    const value = variables[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

export function findMissingTokens(requiredTokens: string[], variables: Record<string, unknown>): string[] {
  return requiredTokens.filter((token) => {
    const value = variables[token];
    return value === undefined || value === null || value === '';
  });
}
