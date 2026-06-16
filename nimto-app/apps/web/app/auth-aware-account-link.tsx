"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthUser } from "@/lib/api";

type AccountLinkState = {
  href: string;
  label: string;
};

export function AuthAwareAccountLink({
  className,
  loggedOutLabel = "Log in",
}: {
  className: string;
  loggedOutLabel?: string;
}) {
  const [link, setLink] = useState<AccountLinkState>({
    href: "/auth?mode=login",
    label: loggedOutLabel,
  });

  useEffect(() => {
    const token = localStorage.getItem("nimto_token");
    const storedUser = localStorage.getItem("nimto_user");
    if (!token || !storedUser) {
      setLink({ href: "/auth?mode=login", label: loggedOutLabel });
      return;
    }

    try {
      const user = JSON.parse(storedUser) as AuthUser;
      if (isAdminUser(user)) {
        setLink({ href: "/dashboard", label: "Dashboard" });
        return;
      }
      setLink({ href: "/events", label: "My workspace" });
    } catch {
      localStorage.removeItem("nimto_token");
      localStorage.removeItem("nimto_user");
      setLink({ href: "/auth?mode=login", label: loggedOutLabel });
    }
  }, [loggedOutLabel]);

  return (
    <Link className={className} href={link.href}>
      {link.label}
    </Link>
  );
}

function isAdminUser(user: AuthUser) {
  return Boolean(
    user.permissions?.includes("*") ||
      user.permissions?.some((permission) =>
        [
          "template:",
          "design:",
          "content:",
          "blog:",
          "staff:",
          "category:",
          "subcategory:",
        ].some((prefix) => permission.startsWith(prefix)),
      ),
  );
}
