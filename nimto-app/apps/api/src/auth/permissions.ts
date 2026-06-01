export const PERMISSIONS = {
  rolesView: "roles:view",
  rolesManage: "roles:manage",
  permissionsView: "permissions:view",
  permissionsManage: "permissions:manage",
  staffView: "staff:view",
  staffManage: "staff:manage",
  sessionsView: "sessions:view",
  sessionsManage: "sessions:manage",
  auditView: "audit:view",
} as const;

export const PERMISSION_CATALOG = [
  { key: PERMISSIONS.rolesView, description: "View roles." },
  {
    key: PERMISSIONS.rolesManage,
    description: "Create, edit, and delete roles.",
  },
  { key: PERMISSIONS.permissionsView, description: "View permission catalog." },
  {
    key: PERMISSIONS.permissionsManage,
    description: "Assign permissions to roles.",
  },
  { key: PERMISSIONS.staffView, description: "View staff accounts." },
  {
    key: PERMISSIONS.staffManage,
    description: "Create and maintain staff accounts.",
  },
  { key: PERMISSIONS.sessionsView, description: "View active sessions." },
  {
    key: PERMISSIONS.sessionsManage,
    description: "Force logout active sessions.",
  },
  { key: PERMISSIONS.auditView, description: "View audit logs." },
] as const;

export const SUPER_ADMIN_ROLE = "SUPER_ADMIN";
