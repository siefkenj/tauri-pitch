import React from "react";
import ReactDOM from "react-dom/client";
import { BlueprintProvider } from "@blueprintjs/core";
import App from "./App";
import { Provider } from "react-redux";
import { store } from "./state/store";
import { HashRouter } from "react-router";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <BlueprintProvider>
            <HashRouter>
                <Provider store={store}>
                    <App />
                </Provider>
            </HashRouter>
        </BlueprintProvider>
    </React.StrictMode>
);
