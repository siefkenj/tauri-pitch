import { Tab, TabId, TabPanel, Tabs } from "@blueprintjs/core";
import React from "react";
import { Outlet, useLocation, useNavigate, useRoutes } from "react-router";

export function NavTabStrip() {
    const TABS_PARENT_ID = React.useId();
    const navigate = useNavigate();
    const location = useLocation();
    // The location gives us the tab key.
    const selectedTabId =
        (location.pathname.startsWith("/")
            ? location.pathname.slice(1)
            : location.pathname) || "circle-chart";
    return (
        <>
            <Tabs
                vertical
                onChange={navigate}
                selectedTabId={selectedTabId}
                className="nav-tab-strip"
            >
                <Tab id="circle-chart" title="Detect Pitch" icon="pulse" />
                <Tab id="karaoke" title="Karaoke" icon="music" />
            </Tabs>
            <TabPanel
                className="nav-tab-panel"
                id={selectedTabId}
                selectedTabId={selectedTabId}
                parentId={TABS_PARENT_ID}
                panel={<Outlet />}
            />
        </>
    );
}
