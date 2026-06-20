export type CrmRole = "superadmin" | "manager" | "outreach" | "viewer";

export interface CallerInfo {
  userId: string;
  managedUserIds?: string[];
}

export interface ResourceInfo {
  ownerId: string;
}

export type CrmAction = "view" | "create" | "edit" | "delete" | "reassign";

export function can(
  role: string,
  action: CrmAction,
  resource: ResourceInfo,
  caller: CallerInfo
): boolean {
  const normalizedRole = role.toLowerCase();

  if (normalizedRole === "superadmin") {
    return true;
  }

  if (normalizedRole === "viewer") {
    return action === "view";
  }

  const isOwnResource = resource.ownerId === caller.userId;
  const isManagedResource = caller.managedUserIds?.includes(resource.ownerId) ?? false;

  switch (normalizedRole) {
    case "manager": {
      if (action === "view") return true;
      if (isOwnResource || isManagedResource) return true;
      return false;
    }
    case "outreach": {
      if (!isOwnResource) return false;
      return action !== "delete" && action !== "reassign";
    }
    default:
      return false;
  }
}

export function canList(role: string, caller: CallerInfo, resourceOwnerId?: string): boolean {
  const normalizedRole = role.toLowerCase();
  if (normalizedRole === "superadmin") return true;
  if (normalizedRole === "manager") return true;
  if (normalizedRole === "viewer" || normalizedRole === "outreach") {
    return resourceOwnerId === undefined || resourceOwnerId === caller.userId;
  }
  return false;
}
