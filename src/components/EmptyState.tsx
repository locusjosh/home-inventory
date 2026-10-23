import type { ReactNode } from "react";
import { Icon, type IconName } from "./ui/Icon";

type Props = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: IconName;
};

/** ContentUnavailableView-style empty state. */
export function EmptyState({ title, description, action, icon = "shippingbox" }: Props) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="text-label-2" aria-hidden>
        <Icon name={icon} size={48} strokeWidth={1.5} />
      </span>
      <h3 className="mt-4 text-title3 text-label">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-xs text-subhead text-label-2">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
