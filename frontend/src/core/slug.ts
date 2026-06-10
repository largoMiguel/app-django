/** Normaliza texto para slug mientras el usuario escribe (no quita guiones al final). */
export function sanitizeSlugInput(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-");
}

/** Limpia el slug al perder foco o al guardar. */
export function finalizeSlugInput(value: string): string {
  return sanitizeSlugInput(value).replace(/^-|-$/g, "");
}

export function slugFromName(name: string): string {
  return finalizeSlugInput(name);
}
