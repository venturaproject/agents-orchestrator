"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Globe2,
  LogOut,
  Moon,
  Palette,
  Sun,
} from "lucide-react";
import type { Locale, MessageKey } from "@/lib/translations";

type Theme = "dark" | "light";

type AccountMenuProps = {
  email: string;
  locale: Locale;
  theme: Theme;
  trigger: "header" | "sidebar";
  t: (key: MessageKey) => string;
  onThemeChange: (theme: Theme) => void;
  onLocaleChange: (locale: Locale) => void;
  onLogout: () => void;
};

export function AccountMenu({
  email,
  locale,
  theme,
  trigger,
  t,
  onThemeChange,
  onLocaleChange,
  onLogout,
}: AccountMenuProps) {
  const initials = (email.slice(0, 2) || "AV").toUpperCase();

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        {trigger === "header" ? (
          <button
            type="button"
            className="top-avatar account-avatar-trigger"
            aria-label={email}
          >
            {initials}
          </button>
        ) : (
          <button type="button" className="profile account-trigger">
            <span className="profile-avatar">{initials}</span>
            <span className="account-trigger-copy">
              {email}
              <small>{t("personalWorkspace")}</small>
            </span>
            <ChevronDown className="account-trigger-chevron" size={15} aria-hidden="true" />
          </button>
        )}
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="account-dropdown"
          aria-label={t("personalWorkspace")}
          side={trigger === "header" ? "bottom" : "top"}
          align={trigger === "header" ? "end" : "start"}
          sideOffset={8}
          collisionPadding={12}
        >
          <DropdownMenu.Label className="account-dropdown-user">
            <span className="account-dropdown-email">{email}</span>
            <span className="account-dropdown-workspace">{t("personalWorkspace")}</span>
          </DropdownMenu.Label>

          <DropdownMenu.Separator className="account-dropdown-separator" />

          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className="account-dropdown-item">
              <Palette size={16} aria-hidden="true" />
              <span>{t("appearance")}</span>
              <ChevronRight className="account-item-chevron" size={14} aria-hidden="true" />
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                className="account-dropdown account-subdropdown"
                aria-label={t("appearance")}
                sideOffset={6}
                alignOffset={-5}
                collisionPadding={12}
              >
                <DropdownMenu.Item className="account-dropdown-item" onSelect={() => onThemeChange("light")}>
                  <Sun size={16} aria-hidden="true" />
                  <span>{t("light")}</span>
                  {theme === "light" && <Check className="account-item-indicator" size={14} aria-hidden="true" />}
                </DropdownMenu.Item>
                <DropdownMenu.Item className="account-dropdown-item" onSelect={() => onThemeChange("dark")}>
                  <Moon size={16} aria-hidden="true" />
                  <span>{t("dark")}</span>
                  {theme === "dark" && <Check className="account-item-indicator" size={14} aria-hidden="true" />}
                </DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>

          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className="account-dropdown-item">
              <Globe2 size={16} aria-hidden="true" />
              <span>{t("language")}</span>
              <ChevronRight className="account-item-chevron" size={14} aria-hidden="true" />
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                className="account-dropdown account-subdropdown"
                aria-label={t("language")}
                sideOffset={6}
                alignOffset={-5}
                collisionPadding={12}
              >
                <DropdownMenu.Item className="account-dropdown-item" onSelect={() => onLocaleChange("en")}>
                  <Globe2 size={16} aria-hidden="true" />
                  <span>English</span>
                  {locale === "en" && <Check className="account-item-indicator" size={14} aria-hidden="true" />}
                </DropdownMenu.Item>
                <DropdownMenu.Item className="account-dropdown-item" onSelect={() => onLocaleChange("es")}>
                  <Globe2 size={16} aria-hidden="true" />
                  <span>Español</span>
                  {locale === "es" && <Check className="account-item-indicator" size={14} aria-hidden="true" />}
                </DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>

          <DropdownMenu.Separator className="account-dropdown-separator" />

          <DropdownMenu.Item
            className="account-dropdown-item account-logout"
            onSelect={onLogout}
          >
            <LogOut size={16} aria-hidden="true" />
            <span>{t("logout")}</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
