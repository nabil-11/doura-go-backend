import { BanIcon, CircleCheckIcon } from "lucide-react";
import type { Metadata } from "next";

import { AccessDenied } from "@/components/admin/access-denied";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { AddMemberDialog } from "@/components/admin/team/add-member-dialog";
import { MemberActions } from "@/components/admin/team/member-actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/guards";
import { ADMIN_ROLES, can } from "@/lib/auth/roles";
import { formatRelative, initials } from "@/lib/i18n/format";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { listAdmins } from "@/lib/services/admins";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.admin.team.title };
}

export default async function TeamPage() {
  const [admin, dict, locale] = await Promise.all([requireAdmin(), getDictionary(), getLocale()]);
  if (!can(admin.role, "team:view")) return <AccessDenied dict={dict} />;

  const members = await listAdmins();
  const canManage = can(admin.role, "team:manage");
  const t = dict.admin.team;
  const now = Date.now();

  return (
    <div className="space-y-6">
      <PageHeader title={t.title} description={t.subtitle} actions={canManage ? <AddMemberDialog /> : null} />

      <Card className="gap-0 overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="ps-4">{t.table.member}</TableHead>
              <TableHead>{t.table.role}</TableHead>
              <TableHead className="hidden sm:table-cell">{t.table.status}</TableHead>
              <TableHead className="hidden md:table-cell">{t.table.lastLogin}</TableHead>
              {canManage ? (
                <TableHead className="pe-4">
                  <span className="sr-only">{dict.common.actions}</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const isSelf = member.id === admin.id;
              return (
                <TableRow key={member.id} className={member.isActive ? undefined : "opacity-60"}>
                  <TableCell className="ps-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-9">
                        <AvatarFallback className="bg-asphalt text-xs font-semibold text-brand">
                          {initials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 font-medium">
                          <span className="truncate">{member.name}</span>
                          {isSelf ? (
                            <Badge variant="secondary" className="text-[0.65rem]">
                              {t.you}
                            </Badge>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-muted-foreground" dir="ltr">
                          {member.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{dict.admin.roles[member.role]}</p>
                    <p className="hidden text-xs text-muted-foreground lg:block">{dict.admin.roleDescriptions[member.role]}</p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {member.isActive ? (
                      <StatusBadge tone="good" icon={CircleCheckIcon}>
                        {t.statusActive}
                      </StatusBadge>
                    ) : (
                      <StatusBadge tone="neutral" icon={BanIcon}>
                        {t.statusDisabled}
                      </StatusBadge>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {member.lastLoginAt ? formatRelative(locale, member.lastLoginAt, now) : t.never}
                  </TableCell>
                  {canManage ? (
                    <TableCell className="pe-4 text-end">
                      {isSelf ? null : (
                        <MemberActions
                          member={{ id: member.id, name: member.name, role: member.role, isActive: member.isActive }}
                        />
                      )}
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ADMIN_ROLES.map((role) => (
          <div key={role} className="rounded-xl border border-dashed p-4">
            <p className="text-sm font-semibold">{dict.admin.roles[role]}</p>
            <p className="mt-1 text-xs text-muted-foreground">{dict.admin.roleDescriptions[role]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
