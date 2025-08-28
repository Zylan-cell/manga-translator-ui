import { FunctionalComponent } from "preact";
import { SettingsIcon, MenuIcon, PanelRightIcon } from "./Icons";

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
          class="btn btn-secondary btn-icon"
          onClick={onToggleLeftSidebar}
          title="Actions"
        >
          <MenuIcon />
        </button>
      </div>

      <div class="header-right">
        <button
          class="btn btn-secondary btn-icon"
          onClick={onShowSettings}
          title="Settings"
        >
          <SettingsIcon />
        </button>
        <button
          class="btn btn-secondary btn-icon"
          onClick={onToggleRightSidebar}
          title="Results"
        >
          <PanelRightIcon />
        </button>
      </div>
    </header>
  );
};

export default AppHeader;
