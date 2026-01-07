/**
 * Created by Ahmad Ezzat on 2026-01-07.
 */

import {loadScript} from 'lightning/platformResourceLoader';
import cometdJS from '@salesforce/resourceUrl/cometdJS';
import getContext from '@salesforce/apex/CometDController.getContext';

let scriptPromise;

function loadCometd(context) {
    if (!scriptPromise) {
        scriptPromise = loadScript(context, cometdJS);
    }
    return scriptPromise;
}

export function initCometD({
                               context,
                               channel,
                               onMessage,
                               logLevel = 'debug',
                               websocketEnabled = false
                           }) {
    if (!context) {
        return Promise.reject(new Error('CometD init requires an LWC context.'));
    }
    if (!channel) {
        return Promise.reject(new Error('CometD init requires a channel.'));
    }
    const handler = typeof onMessage === 'function' ? onMessage : () => {
    };

    return Promise.all([loadCometd(context), getContext()]).then(([_, ctx]) => {
        if (!window?.org?.cometd?.CometD) {
            throw new Error('CometD library not found on window.');
        }
        if (!ctx?.sessionId) {
            throw new Error('CometD init could not resolve session id.');
        }

        const apiVersion = ctx.apiVersion || '65.0';
        const cometd = new window.org.cometd.CometD();
        cometd.configure({
            url: `${window.location.protocol}//${window.location.hostname}/cometd/${apiVersion}/`,
            requestHeaders: {Authorization: `OAuth ${ctx.sessionId}`},
            appendMessageTypeToURL: false,
            logLevel
        });
        cometd.websocketEnabled = websocketEnabled;

        return new Promise((resolve, reject) => {
            cometd.handshake((status) => {
                if (!status?.successful) {
                    reject(status);
                    return;
                }
                const subscription = cometd.subscribe(channel, handler);
                resolve({
                    cometd,
                    subscription,
                    disconnect: () => {
                        try {
                            if (subscription) {
                                cometd.unsubscribe(subscription);
                            }
                        } catch (e) {
                            // ignore unsubscribe failures
                        }
                        try {
                            cometd.disconnect(true);
                        } catch (e) {
                            // ignore disconnect failures
                        }
                    }
                });
            });
        });
    });
}