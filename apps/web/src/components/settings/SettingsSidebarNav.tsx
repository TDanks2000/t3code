import { useCallback, type ComponentType } from "react";
import {
  ArchiveIcon,
  ArrowLeftIcon,
  BotIcon,
  DollarSignIcon,
  GitBranchIcon,
  KeyboardIcon,
  Link2Icon,
  Settings2Icon,
} from "lucide-react";
import { useCanGoBack, useNavigate } from "@tanstack/react-router";

import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "../ui/sidebar";
import { T3ConnectSidebarAvatar, T3ConnectSidebarSignIn } from "../clerk/T3ConnectSidebarSignIn";

export type SettingsSectionPath =
  | "/settings/general"
  | "/settings/keybindings"
  | "/settings/providers"
  | "/settings/source-control"
  | "/settings/connections"
  | "/settings/archived"
  | "/settings/usage";

export const SETTINGS_NAV_ITEMS: ReadonlyArray<{
  label: string;
  to: SettingsSectionPath;
  icon: ComponentType<{ className?: string }>;
  group: "Workspace" | "Configuration" | "Operations";
}> = [
  { label: "General", to: "/settings/general", icon: Settings2Icon, group: "Workspace" },
  { label: "Keybindings", to: "/settings/keybindings", icon: KeyboardIcon, group: "Workspace" },
  { label: "Providers", to: "/settings/providers", icon: BotIcon, group: "Configuration" },
  {
    label: "Source Control",
    to: "/settings/source-control",
    icon: GitBranchIcon,
    group: "Configuration",
  },
  { label: "Connections", to: "/settings/connections", icon: Link2Icon, group: "Configuration" },
  { label: "Usage", to: "/settings/usage", icon: DollarSignIcon, group: "Operations" },
  { label: "Archive", to: "/settings/archived", icon: ArchiveIcon, group: "Operations" },
];

const SETTINGS_NAV_GROUPS = ["Workspace", "Configuration", "Operations"] as const;

export function SettingsSidebarNav({ pathname }: { pathname: string }) {
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  const { isMobile, setOpenMobile } = useSidebar();
  const handleSectionClick = useCallback(
    (to: SettingsSectionPath) => {
      if (isMobile) {
        setOpenMobile(false);
      }
      void navigate({ to, replace: true });
    },
    [isMobile, navigate, setOpenMobile],
  );
  const handleBackClick = useCallback(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
    if (canGoBack) {
      window.history.back();
      return;
    }
    void navigate({ to: "/" });
  }, [canGoBack, isMobile, navigate, setOpenMobile]);

  return (
    <>
      <SidebarContent className="overflow-x-hidden">
        <SidebarGroup className="px-2 py-3">
          <div className="mb-3 px-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/50">
              Control room
            </div>
            <div className="mt-1 text-xs leading-4 text-muted-foreground/70">
              Tune the local agent workspace.
            </div>
          </div>

          {SETTINGS_NAV_GROUPS.map((group) => (
            <div key={group} className="mt-4 first:mt-0">
              <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/45">
                {group}
              </div>
              <SidebarMenu>
                {SETTINGS_NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.to;
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        size="sm"
                        isActive={isActive}
                        className={
                          isActive
                            ? "relative gap-2.5 overflow-hidden px-2.5 py-2 text-left text-[13px] font-semibold text-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
                            : "gap-2.5 px-2.5 py-2 text-left text-[13px] text-muted-foreground/70 hover:bg-accent/60 hover:text-foreground"
                        }
                        onClick={() => handleSectionClick(item.to)}
                      >
                        <span
                          className={
                            isActive
                              ? "flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
                              : "flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground/65"
                          }
                        >
                          <Icon className="size-3.5" />
                        </span>
                        <span className="truncate">{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </div>
          ))}
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />
      <SidebarFooter className="p-2">
        <T3ConnectSidebarSignIn />
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1">
          <SidebarMenu className="min-w-0">
            <SidebarMenuItem>
              <SidebarMenuButton
                size="sm"
                className="gap-2 px-2 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={handleBackClick}
              >
                <ArrowLeftIcon className="size-4" />
                <span>Back</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <T3ConnectSidebarAvatar />
        </div>
      </SidebarFooter>
    </>
  );
}
