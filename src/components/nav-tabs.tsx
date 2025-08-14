import { Tab, TabId, TabPanel, Tabs } from "@blueprintjs/core";
import classNames from "classnames";
import React from "react";
import { Outlet, useLocation, useNavigate, useRoutes } from "react-router";

export function NavTabStrip() {
    const TABS_PARENT_ID = React.useId();
    const navigate = useNavigate();
    const location = useLocation();
    const [smallScreen, setSmallScreen] = React.useState(false);
    // The location gives us the tab key.
    const selectedTabId =
        (location.pathname.startsWith("/")
            ? location.pathname.slice(1)
            : location.pathname) || "circle-chart";

    React.useEffect(() => {
        // Update the smallScreen state based on window width
        const handleResize = () => {
            setSmallScreen(window.innerWidth < 700); // Adjust the breakpoint as needed
        };
        handleResize(); // Set initial state
        window.addEventListener("resize", handleResize);
        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    return (
        <>
            <Tabs
                vertical
                onChange={navigate}
                selectedTabId={selectedTabId}
                className={classNames("nav-tab-strip", {
                    "small-screen": smallScreen,
                })}
            >
                <Tab
                    id="circle-chart"
                    title={!smallScreen && "Detect Pitch"}
                    aria-description="Detect Pitch"
                    icon="pulse"
                />
                <Tab
                    id="karaoke"
                    title={!smallScreen && "Karaoke"}
                    aria-description="Karaoke"
                    icon="music"
                />
                <Tab
                    id="settings"
                    title={!smallScreen && "Settings"}
                    aria-description="Settings"
                    icon="cog"
                />
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
