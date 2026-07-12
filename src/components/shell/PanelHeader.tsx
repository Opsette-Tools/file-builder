import type { ReactNode } from "react";

/**
 * PanelHeader — the mode icon + title row at the top of every control panel,
 * mirroring Smallpdf's colored tool tile. Shared primitive so every mode's
 * panel opens the same way. The accent tints the icon chip.
 */
export function PanelHeader({
  icon,
  title,
  accent,
}: {
  icon: ReactNode;
  title: string;
  accent: string;
}) {
  return (
    <div className="fb-panel-header">
      <span className="fb-panel-header-icon" style={{ background: accent }}>
        {icon}
      </span>
      <span className="fb-panel-header-title">{title}</span>
    </div>
  );
}
