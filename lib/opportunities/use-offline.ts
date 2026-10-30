"use client";

import { useEffect, useState } from "react";
import { readQueue } from "./api";

/** État de la connexion et nombre d'actions en attente d'envoi. */
export function useOffline() {
    const [online, setOnline] = useState(true);
    const [pending, setPending] = useState(0);

    useEffect(() => {
        const sync = () => {
            setOnline(navigator.onLine);
            setPending(readQueue().length);
        };
        sync();
        window.addEventListener("online", sync);
        window.addEventListener("offline", sync);
        window.addEventListener("outbox-changed", sync);
        return () => {
            window.removeEventListener("online", sync);
            window.removeEventListener("offline", sync);
            window.removeEventListener("outbox-changed", sync);
        };
    }, []);

    return { online, pending };
}