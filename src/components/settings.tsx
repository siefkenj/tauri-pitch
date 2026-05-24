import { Button, Card, H3, Switch } from "@blueprintjs/core";
import { useAppDispatch, useAppSelector } from "../state/hooks";
import {
    _coreReducerActions,
    appRuntimeSelector,
    hostingAddressSelector,
} from "../state/redux-slices/core";
import React from "react";
import { appDataDir, join } from "@tauri-apps/api/path";
import QRCode from "react-qr-code";
import { invoke } from "@tauri-apps/api/core";

/**
 * Show all the settings for the app.
 */
export function Settings() {
    const hostingAddress = useAppSelector(hostingAddressSelector);
    const appRuntime = useAppSelector(appRuntimeSelector);
    const [dataDir, setDataDir] = React.useState<string | null>(null);
    const useLargeFont = useAppSelector((state) => state.core.useLargeFont);
    const dispatch = useAppDispatch();

    const [ytdlpVersion, setYtdlpVersion] = React.useState<string | null>(null);
    const [ytdlpUpdating, setYtdlpUpdating] = React.useState(false);
    const [ytdlpUpdateError, setYtdlpUpdateError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (appRuntime !== "tauri") {
            return;
        }
        invoke<string>("get_ytdlp_version")
            .then((v) => setYtdlpVersion(v))
            .catch(() => setYtdlpVersion("unknown"));
    }, [appRuntime]);

    const handleUpdateYtdlp = async () => {
        setYtdlpUpdating(true);
        setYtdlpUpdateError(null);
        try {
            await invoke("update_ytdlp");
            const newVersion = await invoke<string>("get_ytdlp_version");
            setYtdlpVersion(newVersion);
        } catch (err) {
            setYtdlpUpdateError(String(err));
        } finally {
            setYtdlpUpdating(false);
        }
    };

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
                <p>
                    <Switch
                        checked={useLargeFont}
                        onChange={() => {
                            dispatch(
                                _coreReducerActions.setUseLargeFont(
                                    !useLargeFont
                                )
                            );
                        }}
                        label="Use larger font"
                    />
                </p>
            </Card>
            <Card>
                <H3>Server</H3>
                <p>The server address is </p>
                <p>
                    <b style={{ fontSize: "300%" }}>
                        <code>{hostingAddress}</code>
                    </b>
                </p>
                <div className="centered-qr-code">
                    {hostingAddress && <QRCode value={hostingAddress} />}
                </div>
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
            <Card>
                <H3>yt-dlp</H3>
                {appRuntime === "tauri" ? (
                    <>
                        <p>
                            Current version:{" "}
                            <b>
                                <code>
                                    {ytdlpVersion ?? "loading…"}
                                </code>
                            </b>
                        </p>
                        <Button
                            intent="primary"
                            loading={ytdlpUpdating}
                            onClick={handleUpdateYtdlp}
                        >
                            Update yt-dlp
                        </Button>
                        {ytdlpUpdateError && (
                            <p style={{ color: "red" }}>{ytdlpUpdateError}</p>
                        )}
                    </>
                ) : (
                    <p>yt-dlp can only be updated from the master instance.</p>
                )}
            </Card>
        </div>
    );
}
