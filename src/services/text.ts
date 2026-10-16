export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function isTypeableText(text: string): boolean {
  return /^[\x20-\x7E]*$/.test(text);
}

export function encodeInputText(text: string): string {
  return shellQuote(text.replace(/ /g, "%s"));
}
