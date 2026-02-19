export type AdminRole = "operator" | "admin";

export const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  operator: ["view", "quote_confirm", "status_change_limited"],
  admin: [
    "view",
    "quote_confirm",
    "status_change",
    "price_change",
    "payment_confirm",
    "delete",
  ],
};

export function hasPermission(role: AdminRole, action: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(action) || role === "admin";
}
