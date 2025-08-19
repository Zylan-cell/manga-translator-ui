import { render } from "preact";
import App from "./App";

// Styles
import "./styles/global.css";
import "./styles/buttons.css";
import "./styles/cards.css";
import "./styles/layout.css";
import "./styles/modal.css";
import "./styles/panels.css";
import "./styles/responsive.css";
import "./styles/results.css";
import "./styles/sidebars.css";
import "./components/ui/FloatingWindow.css";
import "./components/ui/Settings.css";

render(<App />, document.getElementById("root")!);
