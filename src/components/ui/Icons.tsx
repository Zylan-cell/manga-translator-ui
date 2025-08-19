import { FunctionalComponent } from "preact";

export const FullscreenEnterIcon: FunctionalComponent = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    width="16"
    height="16"
    class="icon"
    stroke="currentColor"
  >
    {" "}
    <g
      fill="none"
      stroke-width="1.3"
      stroke-linecap="round"
      stroke-miterlimit="3"
    >
      {" "}
      <path d="M5.333 14H3a1 1 0 0 1-1-1v-2.333M10.667 14H13a1 1 0 0 0 1-1v-2.333M5.333 2H3a1 1 0 0 0-1 1v2.333" />{" "}
      <path d="M10.667 2H13a1 1 0 0 1 1 1v2.333" />{" "}
    </g>{" "}
  </svg>
);
export const FullscreenExitIcon: FunctionalComponent = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    {" "}
    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />{" "}
  </svg>
);
export const EditIcon: FunctionalComponent = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon"
  >
    {" "}
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>{" "}
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>{" "}
  </svg>
);
export const AddIcon: FunctionalComponent = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon"
  >
    {" "}
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>{" "}
    <line x1="12" y1="8" x2="12" y2="16"></line>{" "}
    <line x1="8" y1="12" x2="16" y2="12"></line>{" "}
  </svg>
);
export const DeleteIcon: FunctionalComponent = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon"
  >
    {" "}
    <polyline points="3 6 5 6 21 6"></polyline>{" "}
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>{" "}
  </svg>
);
export const DetectIcon: FunctionalComponent = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon"
  >
    {" "}
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>{" "}
    <circle cx="12" cy="12" r="3"></circle>{" "}
  </svg>
);
export const RecognizeIcon: FunctionalComponent = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon"
  >
    {" "}
    <polyline points="4 7 4 4 20 4 20 7"></polyline>{" "}
    <line x1="9" y1="20" x2="15" y2="20"></line>{" "}
    <line x1="12" y1="4" x2="12" y2="20"></line>{" "}
  </svg>
);
export const TranslateIcon: FunctionalComponent = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon"
  >
    {" "}
    <path d="M5 12h14"></path> <path d="M12 5l7 7-7 7"></path>{" "}
  </svg>
);
export const SettingsIcon: FunctionalComponent = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    class="icon"
    aria-hidden="true"
  >
    {" "}
    <path d="M 9.6660156 2 L 9.1757812 4.5234375 C 8.3516137 4.8342536 7.5947862 5.2699307 6.9316406 5.8144531 L 4.5078125 4.9785156 L 2.171875 9.0214844 L 4.1132812 10.708984 C 4.0386488 11.16721 4 11.591845 4 12 C 4 12.408768 4.0398071 12.832626 4.1132812 13.291016 L 4.1132812 13.292969 L 2.171875 14.980469 L 4.5078125 19.021484 L 6.9296875 18.1875 C 7.5928951 18.732319 8.3514346 19.165567 9.1757812 19.476562 L 9.6660156 22 L 14.333984 22 L 14.824219 19.476562 C 15.648925 19.165543 16.404903 18.73057 17.068359 18.185547 L 19.492188 19.021484 L 21.826172 14.980469 L 19.886719 13.291016 C 19.961351 12.83279 20 12.408155 20 12 C 20 11.592457 19.96113 11.168374 19.886719 10.710938 L 19.886719 10.708984 L 21.828125 9.0195312 L 19.492188 4.9785156 L 17.070312 5.8125 C 16.407106 5.2676813 15.648565 4.8344327 14.824219 4.5234375 L 14.333984 2 L 9.6660156 2 z M 12 8 C 9.8034768 8 8 9.8034768 8 12 C 8 14.196523 9.8034768 16 12 16 C 14.196523 16 16 14.196523 16 12 C 16 9.8034768 14.196523 8 12 8 z M 12 10 C 13.111477 10 14 10.888523 14 12 C 14 13.111477 13.111477 14 12 14 C 10.888523 14 10 13.111477 10 12 C 10 10.888523 10.888523 10 12 10 z"></path>{" "}
  </svg>
);
export const MenuIcon: FunctionalComponent = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    {" "}
    <line x1="3" y1="12" x2="21" y2="12"></line>{" "}
    <line x1="3" y1="6" x2="21" y2="6"></line>{" "}
    <line x1="3" y1="18" x2="21" y2="18"></line>{" "}
  </svg>
);
export const PanelRightIcon: FunctionalComponent = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    {" "}
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>{" "}
    <line x1="15" y1="3" x2="15" y2="21"></line>{" "}
  </svg>
);
