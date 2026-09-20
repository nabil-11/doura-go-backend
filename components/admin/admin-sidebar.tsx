"use client";

import {
  ChevronsUpDownIcon,
  ExternalLinkIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MotorbikeIcon,
  RadarIcon,
  RouteIcon,
  ShieldUserIcon,
  TagsIcon,
  UserCogIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";

import { LogoMark } from "@/components/brand/logo";
import { useDictionary, useLocale } from "@/components/i18n/locale-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { logoutAction } from "@/lib/actions/auth";
import { can, type AdminRole, type Permission } from "@/lib/auth/roles";
import { localeMeta } from "@/lib/i18n/config";
import { formatNumber, initials } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

type NavItem = {
  key: "overview" | "drivers" | "riders" | "rides" | "live" | "pricing" | "team";
  href: string;
  icon: LucideIcon;
  permission: Permission;
  exact?: boolean;
};

type NavGroup = { key: "main" | "operations" | "business" | "administration"; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    key: "main",
    items: [{ key: "overview", href: "/admin", icon: LayoutDashboardIcon, permission: "dashboard:view", exact: true }],
  },
  {
    key: "operations",
    items: [
      { key: "drivers", href: "/admin/drivers", icon: MotorbikeIcon, permission: "drivers:view" },
      { key: "riders", href: "/admin/riders", icon: UsersIcon, permission: "riders:view" },
      { key: "rides", href: "/admin/rides", icon: RouteIcon, permission: "rides:view" },
      { key: "live", href: "/admin/live", icon: RadarIcon, permission: "rides:view" },
    ],
  },
  {
    key: "business",
    items: [{ key: "pricing", href: "/admin/pricing", icon: TagsIcon, permission: "pricing:view" }],
  },
  {
    key: "administration",
    items: [{ key: "team", href: "/admin/team", icon: ShieldUserIcon, permission: "team:view" }],
  },
];

/**
 * End of a nav item: the pending-review count, replaced by a spinner while
 * that page loads. The spinner only fades in after 120ms, so quick
 * navigations don't flash.
 */
function NavItemEnd({ count }: { count?: number }) {
  const { pending } = useLinkStatus();
  const locale = useLocale();
  return (
    <span className="relative ms-auto flex min-w-4 items-center justify-center group-data-[collapsible=icon]:hidden">
      {count ? (
        <span
          className={cn(
            "tabular rounded-md bg-brand px-1.5 py-0.5 text-[0.7rem] font-semibold text-asphalt transition-opacity",
            pending && "opacity-0",
          )}
        >
          {formatNumber(locale, count)}
        </span>
      ) : null}
      <Spinner className="nav-pending absolute size-3.5" data-pending={pending} aria-hidden="true" />
    </span>
  );
}

export function AdminSidebar({
  admin,
  pendingDrivers,
}: {
  admin: { name: string; email: string; role: AdminRole };
  pendingDrivers: number;
}) {
  const dict = useDictionary();
  const locale = useLocale();
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const [signingOut, startSignOut] = useTransition();
  const dir = localeMeta[locale].dir;
  const side = dir === "rtl" ? "right" : "left";

  // "/fr/admin/drivers/123" → "/admin/drivers/123"
  const current = pathname.replace(/^\/[^/]+/, "") || "/";
  const isActive = (item: NavItem) =>
    item.exact ? current === item.href : current === item.href || current.startsWith(`${item.href}/`);

  const groupLabels: Record<NavGroup["key"], string | null> = {
    main: null,
    operations: dict.admin.nav.operations,
    business: dict.admin.nav.business,
    administration: dict.admin.nav.administration,
  };

  return (
    <Sidebar side={side} collapsible="icon" dir={dir}>
      <SidebarHeader className="px-3 pt-4 pb-2">
        <Link
          href={`/${locale}/admin`}
          className="flex items-center gap-2.5 rounded-lg p-1 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <LogoMark className="size-8" />
          <span dir="ltr" className="flex items-baseline gap-1 text-lg leading-none font-extrabold text-white group-data-[collapsible=icon]:hidden">
            doura
            <span className="rounded-md bg-brand px-1.5 py-0.5 text-[0.8em] leading-none font-black text-asphalt">go</span>
          </span>
          <span className="ms-auto rounded-full border border-white/15 px-2 py-0.5 text-[0.6rem] font-semibold tracking-wide text-white/60 uppercase group-data-[collapsible=icon]:hidden">
            {dict.admin.brand}
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {NAV.map((group) => {
          const items = group.items.filter((item) => can(admin.role, item.permission));
          if (!items.length) return null;
          const label = groupLabels[group.key];
          return (
            <SidebarGroup key={group.key}>
              {label ? <SidebarGroupLabel className="text-white/40">{label}</SidebarGroupLabel> : null}
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {items.map((item) => {
                    const active = isActive(item);
                    const title = dict.admin.nav[item.key];
                    return (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={{ children: title, side: dir === "rtl" ? "left" : "right" }}
                          className="h-9 text-white/70 hover:text-white data-[active=true]:text-white [&[data-active=true]>svg]:text-brand"
                        >
                          <Link
                            href={`/${locale}${item.href}`}
                            onClick={() => {
                              if (isMobile) setOpenMobile(false);
                            }}
                          >
                            <item.icon />
                            <span>{title}</span>
                            <NavItemEnd count={item.key === "drivers" ? pendingDrivers : undefined} />
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu dir={dir}>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="text-white/85 hover:text-white data-[state=open]:bg-sidebar-accent"
                >
                  <Avatar className="size-8 rounded-lg after:rounded-lg">
                    <AvatarFallback className="rounded-lg bg-brand text-xs font-bold text-asphalt">
                      {initials(admin.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="grid flex-1 text-start leading-tight">
                    <span className="truncate text-sm font-semibold">{admin.name}</span>
                    <span className="truncate text-xs text-white/50">{dict.admin.roles[admin.role]}</span>
                  </span>
                  <ChevronsUpDownIcon className="ms-auto size-4 text-white/50" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side={isMobile ? "bottom" : "top"} align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
                <DropdownMenuLabel className="font-normal">
                  <span className="block truncate font-medium text-foreground">{admin.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{admin.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/${locale}/admin/account`}>
                    <UserCogIcon />
                    {dict.admin.nav.account}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/${locale}`} target="_blank">
                    <ExternalLinkIcon />
                    {dict.admin.nav.viewSite}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={signingOut}
                  onSelect={(event) => {
                    event.preventDefault();
                    startSignOut(async () => {
                      await logoutAction(locale);
                    });
                  }}
                >
                  {signingOut ? <Spinner /> : <LogOutIcon />}
                  {dict.admin.nav.signOut}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
