import { FunctionalComponent } from "preact";
import SettingsIcon from "../../assets/icons/settings.svg?react";

interface AppHeaderProps {
  onImportImages: () => void;
  onShowSettings: () => void;
  onExportProject: () => void;
  onImportProject: () => void;
}

const AppHeader: FunctionalComponent<AppHeaderProps> = ({
  onImportImages,
  onShowSettings,
  onExportProject,
  onImportProject,
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
        <button
          class="btn btn-secondary"
          onClick={onImportProject}
          title="Import project file (.mtproj)"
        >
          Import Project
        </button>
      </div>

      <div class="header-center">
        <button
          class="btn btn-accent"
          onClick={onExportProject}
          title="Export current project as .mtproj file"
        >
          Export Project
        </button>
      </div>

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
