import { Card, H3 } from "@blueprintjs/core";
import { useAppSelector } from "../state/hooks";
import {
    appRuntimeSelector,
    hostingAddressSelector,
} from "../state/redux-slices/core";
import React from "react";
import { appDataDir, join } from "@tauri-apps/api/path";

/**
 * Show all the settings for the app.
 */
export function Settings() {
    const hostingAddress = useAppSelector(hostingAddressSelector);
    const appRuntime = useAppSelector(appRuntimeSelector);
    const [dataDir, setDataDir] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (appRuntime !== "tauri") {
            return;
        }
        const fetchDataDir = async () => {
            const dir = await appDataDir();
            setDataDir(await join(dir, "youtube_downloads"));
        };
        fetchDataDir();
    }, [appRuntime]);

    return (
        <div className="settings-container">
            <Card>
                <H3>Runtime</H3>
                <p>
                    This is a{" "}
                    <b>
                        <code>{appRuntime}</code>
                    </b>{" "}
                    instance. That means{" "}
                    {appRuntime === "tauri"
                        ? "you have full permissions"
                        : "some features may be limited"}
                    .
                </p>
            </Card>
            <Card>
                <H3>Server</H3>
                <p>The server address is </p>
                <p>
                    <b>
                        <code>{hostingAddress}</code>
                    </b>
                </p>
                <p>
                    Connect to this address from other devices on your local
                    network to interact with the Karaoke Queue and to submit
                    songs.
                </p>
            </Card>
            <Card>
                <H3>Storage</H3>
                {appRuntime === "tauri" ? (
                    <>
                        <p>Your songs are stored in</p>
                        <p>
                            <b>
                                <code>{dataDir}</code>
                            </b>
                        </p>
                    </>
                ) : (
                    <p>
                        Songs are stored on the server. Check the server's
                        settings for the location.
                    </p>
                )}
            </Card>
        </div>
    );
}
