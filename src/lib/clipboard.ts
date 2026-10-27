/**
 * Copies text, resolving to whether it worked. Browsers only offer the
 * Clipboard API over HTTPS or on localhost, so elsewhere (a phone testing the
 * dev server by network address) it falls back to the older copy command.
 */
export const copyText = async (text: string): Promise<boolean> => {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  const field = document.createElement("textarea");
  field.value = text;
  // Read-only keeps a phone's keyboard from opening; fixed keeps the page still.
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  // iOS Safari ignores select() alone.
  field.setSelectionRange(0, text.length);
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
};
