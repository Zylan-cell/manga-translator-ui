import { FunctionalComponent } from "preact";
import SettingsIcon from "../../assets/icons/settings.svg?react";
import MenuIcon from "../../assets/icons/menu.svg?react";
import PanelRightIcon from "../../assets/icons/panel-right.svg?react";

interface AppHeaderProps {
  onToggleLeftSidebar: () => void;
  onToggleRightSidebar: () => void;
  onShowSettings: () => void;
}

const AppHeader: FunctionalComponent<AppHeaderProps> = ({
  onToggleLeftSidebar,
  onToggleRightSidebar,
  onShowSettings,
}) => {
  return (
    <header class="app-header">
      <div class="header-left">
        <button
          class="btn btn-secondary btn-icon mobile-only"
          onClick={onToggleLeftSidebar}
          title="Actions"
        >
          <MenuIcon class="icon" />
        </button>
      </div>

      <div class="header-center">
        <button
          class="btn btn-secondary btn-icon"
          onClick={onShowSettings}
          title="Settings"
        >
          <SettingsIcon class="icon" />
        </button>
      </div>

      <div class="header-right">
        <button
          class="btn btn-secondary btn-icon mobile-only"
          onClick={onToggleRightSidebar}
          title="Results"
        >
          <PanelRightIcon class="icon" />
        </button>
      </div>
    </header>
  );
};

export default AppHeader;
