import { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import { FolderIcon, FileIcon, SettingsIcon } from "./Icons";
import "./LeftMenuBar.css";

interface LeftMenuBarProps {
  onImportImages: () => void;
  onImportFolder: () => void;
  onImportProject: () => void;
  onExportProject: () => void;
  onExportImages: () => void; // NEW
  onShowSettings: () => void;
}

interface MenuState {
  activeMenu: string | null;
}

const LeftMenuBar: FunctionalComponent<LeftMenuBarProps> = ({
  onImportImages,
  onImportFolder,
  onImportProject,
  onExportProject,
  onExportImages,
  onShowSettings,
}) => {
  const [menuState, setMenuState] = useState<MenuState>({ activeMenu: null });

  const toggleMenu = (menu: string) => {
    setMenuState((prev) => ({
      activeMenu: prev.activeMenu === menu ? null : menu,
    }));
  };

  const closeMenu = () => {
    setMenuState({ activeMenu: null });
  };

  const handleMenuAction = (action: () => void) => {
    action();
    closeMenu();
  };

  return (
    <div class="left-menu-bar">
      <div class="menu-item">
        <button
          class={`menu-button ${
            menuState.activeMenu === "file" ? "active" : ""
          }`}
          onClick={() => toggleMenu("file")}
        >
          File
        </button>
        {menuState.activeMenu === "file" && (
          <div class="menu-dropdown">
            <button
              class="menu-dropdown-item"
              onClick={() => handleMenuAction(onImportImages)}
            >
              <FileIcon class="icon" /> Import Images
            </button>
            <button
              class="menu-dropdown-item"
              onClick={() => handleMenuAction(onImportFolder)}
            >
              <FolderIcon class="icon" /> Import Folder
            </button>
            <div class="menu-separator" />
            <button
              class="menu-dropdown-item"
              onClick={() => handleMenuAction(onImportProject)}
            >
              Import Project
            </button>
            <button
              class="menu-dropdown-item"
              onClick={() => handleMenuAction(onExportProject)}
            >
              Export Project
            </button>
            <button
              class="menu-dropdown-item"
              onClick={() => handleMenuAction(onExportImages)}
            >
              Export Images
            </button>
          </div>
        )}
      </div>

      <div class="menu-item">
        <button
          class={`menu-button ${
            menuState.activeMenu === "tools" ? "active" : ""
          }`}
          onClick={() => toggleMenu("tools")}
        >
          Tools
        </button>
        {menuState.activeMenu === "tools" && (
          <div class="menu-dropdown">
            <button
              class="menu-dropdown-item"
              onClick={() => handleMenuAction(onShowSettings)}
            >
              <SettingsIcon class="icon" /> Settings
              <span class="menu-shortcut">Ctrl+,</span>
            </button>
          </div>
        )}
      </div>

      {menuState.activeMenu && <div class="menu-overlay" onClick={closeMenu} />}
    </div>
  );
};

export default LeftMenuBar;
