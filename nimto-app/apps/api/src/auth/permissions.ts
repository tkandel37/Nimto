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
  contentManage: "content:manage",
  blogManageOwn: "blog:manage:own",
  blogManageAll: "blog:manage:all",
  templateViewOwn: "template:view:own",
  templateViewAll: "template:view:all",
  templateCreate: "template:create",
  templateUpdateOwn: "template:update:own",
  templateUpdateAll: "template:update:all",
  templatePublish: "template:publish",
  templateUnpublish: "template:unpublish",
  templateDuplicate: "template:duplicate",
  designViewOwn: "design:view:own",
  designViewAll: "design:view:all",
  designManageOwn: "design:manage:own",
  designManageAll: "design:manage:all",
  categoryView: "category:view",
  categoryManage: "category:manage",
  subcategoryView: "subcategory:view",
  subcategoryManage: "subcategory:manage",
} as const;

export const DESIGN_MODULE_PERMISSIONS = [
  PERMISSIONS.templateViewOwn,
  PERMISSIONS.templateViewAll,
  PERMISSIONS.templateCreate,
  PERMISSIONS.templateUpdateOwn,
  PERMISSIONS.templateUpdateAll,
  PERMISSIONS.templatePublish,
  PERMISSIONS.templateUnpublish,
  PERMISSIONS.templateDuplicate,
  PERMISSIONS.designViewOwn,
  PERMISSIONS.designViewAll,
  PERMISSIONS.designManageOwn,
  PERMISSIONS.designManageAll,
  PERMISSIONS.categoryView,
  PERMISSIONS.categoryManage,
  PERMISSIONS.subcategoryView,
  PERMISSIONS.subcategoryManage,
] as const;

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
  {
    key: PERMISSIONS.contentManage,
    description: "Manage public website page content.",
  },
  {
    key: PERMISSIONS.blogManageOwn,
    description: "Create and edit own blog posts.",
  },
  {
    key: PERMISSIONS.blogManageAll,
    description: "Create, edit, publish, and manage all blog posts.",
  },
  {
    key: PERMISSIONS.templateViewOwn,
    description: "Template and Design: view templates created by self.",
  },
  {
    key: PERMISSIONS.templateViewAll,
    description: "Template and Design: view all staff templates.",
  },
  {
    key: PERMISSIONS.templateCreate,
    description: "Template and Design: create HTML templates.",
  },
  {
    key: PERMISSIONS.templateUpdateOwn,
    description: "Template and Design: edit templates created by self.",
  },
  {
    key: PERMISSIONS.templateUpdateAll,
    description: "Template and Design: edit all staff templates.",
  },
  {
    key: PERMISSIONS.templatePublish,
    description: "Template and Design: publish templates as designs.",
  },
  {
    key: PERMISSIONS.templateUnpublish,
    description: "Template and Design: unpublish templates and designs.",
  },
  {
    key: PERMISSIONS.templateDuplicate,
    description: "Template and Design: duplicate templates or designs.",
  },
  {
    key: PERMISSIONS.designViewOwn,
    description: "Template and Design: view designs created by self.",
  },
  {
    key: PERMISSIONS.designViewAll,
    description: "Template and Design: view all staff designs.",
  },
  {
    key: PERMISSIONS.designManageOwn,
    description: "Template and Design: manage designs created by self.",
  },
  {
    key: PERMISSIONS.designManageAll,
    description: "Template and Design: manage all staff designs.",
  },
  {
    key: PERMISSIONS.categoryView,
    description: "Template and Design: view design categories.",
  },
  {
    key: PERMISSIONS.categoryManage,
    description: "Template and Design: create and edit design categories.",
  },
  {
    key: PERMISSIONS.subcategoryView,
    description: "Template and Design: view design subcategories.",
  },
  {
    key: PERMISSIONS.subcategoryManage,
    description: "Template and Design: create and edit design subcategories.",
  },
] as const;

export const SUPER_ADMIN_ROLE = "SUPER_ADMIN";
