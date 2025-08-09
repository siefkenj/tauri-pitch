import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

import { Button } from "@blueprintjs/core";
import React from "react";
import { getWebSocketURL } from "./utils";
import { invoke } from "@tauri-apps/api/core";

export function SocketTest() {
    const [doc, setDoc] = React.useState<Y.Doc | null>(null);
    const [provider, setProvider] = React.useState<WebsocketProvider | null>(
        null
    );

    React.useEffect(() => {
    }, []);

    return (
        <Button
            onClick={async () => {
                invoke("fetch_youtube", {
                    youtubeHash: "OEc9U6Prxos"
                });
            }}
        >
            Grab Youtube
        </Button>
    );
}
