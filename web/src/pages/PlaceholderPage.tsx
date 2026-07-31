import { Icon } from "@/components/Icon";

type Props = {
  title: string;
  subtitle: string;
  icon: string;
};

export function PlaceholderPage({ title, subtitle, icon }: Props) {
  return (
    <div className="placeholder">
      <div className="placeholder-card">
        <div className="empty-ico accent">
          <Icon name={icon} size={28} />
        </div>
        <div className="empty-title lg">{title}</div>
        <div className="empty-copy">{subtitle}</div>
        <div className="placeholder-badge">Phase 4</div>
      </div>
    </div>
  );
}
