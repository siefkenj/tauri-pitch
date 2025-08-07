import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

import { Button } from "@blueprintjs/core";
import React from "react";
import { getWebSocketURL } from "./utils";

export function SocketTest() {
    const [doc, setDoc] = React.useState<Y.Doc | null>(null);
    const [provider, setProvider] = React.useState<WebsocketProvider | null>(
        null
    );

    React.useEffect(() => {
        const newDoc = new Y.Doc();
        const wsAddress = getWebSocketURL();
        console.log("Websocket address:", wsAddress);
        const newProvider = new WebsocketProvider(
            wsAddress,
            "tauri-pitch",
            newDoc,
            { disableBc: true }
        );

        setDoc(newDoc);
        setProvider(newProvider);

        const yArray = newDoc.getArray<number>("my-array");
        const callback: Parameters<(typeof yArray)["observe"]>[0] = (
            event,
            transaction
        ) => {
            console.log("Y Array updated:", event.target.toArray());
        };
        yArray.observe(callback);

        return () => {
            newProvider.destroy();
            newDoc.destroy();
            yArray.unobserve(callback);
        };
    }, []);

    return (
        <Button
            onClick={async () => {
                console.log("Testing socket connection");
                if (!doc || !provider) {
                    console.error("Doc or provider not initialized");
                    return;
                }
                const yArray = doc.getArray<number>("my-array");
                console.log("yArray.length before push:", yArray.length);
                yArray.push([Math.random() * 100]);
                console.log("New value added to yArray");
                console.log("yArray after push:", yArray.toArray());
            }}
        >
            Test Socket
        </Button>
    );
}
