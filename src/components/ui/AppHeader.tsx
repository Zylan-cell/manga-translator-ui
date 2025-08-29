import { FunctionalComponent } from "preact";
import SettingsIcon from "../../assets/icons/settings.svg?react";

interface AppHeaderProps {
  onImportImages: () => void;
  onShowSettings: () => void;
}

const AppHeader: FunctionalComponent<AppHeaderProps> = ({
  onImportImages,
  onShowSettings,
}) => {
  return (
    <header class="app-header">
      <div class="header-left">
        <button
          class="btn btn-primary"
          onClick={onImportImages}
          title="Import images from folder"
        >
          Import Images
        </button>
      </div>

      <div class="header-center" />

      <div class="header-right">
        <button
          class="btn btn-secondary btn-icon"
          onClick={onShowSettings}
          title="Settings"
        >
          <SettingsIcon class="icon" />
        </button>
      </div>
    </header>
  );
};

export default AppHeader;
