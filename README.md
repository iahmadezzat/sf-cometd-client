# CometD for Experience Cloud LWC

## Overview
Lightning Web Components (LWCs) running in **Experience Cloud** do not support the Salesforce EMP API (`lightning/empApi`). This prevents subscribing to **Platform Events** from portals and partner sites.

This module provides a **CometD-based replacement** for EMP API that works reliably in Experience Cloud by connecting directly to Salesforce’s Bayeux endpoint.

**Scope:** Platform Events only (`/event/*`)

---

## Why This Exists (Pain Point)
The following EMP API import does not work reliably in Experience Cloud:

```js
    import { subscribe } from 'lightning/empApi';
```

As a result:
- Platform Events cannot be consumed in LWCs
- Real-time UI refresh is blocked
- No supported fallback exists for sites

---

## TL;DR – Quick Usage Example

Use this when you just want to subscribe to a Platform Event from an LWC in Experience Cloud.

```js
    import { LightningElement } from 'lwc';
    import { initCometd } from 'c/cometD';

    export default class QuickExample extends LightningElement {

        client;
        unsubscribe;
        channel = '/event/ChannelName__e';

        connectedCallback() {
            initCometd({
                channel: this.channel,
                onMessage: (message) => {
                    const payload = message?.data?.payload || {};
                    console.log('Payload: ', payload);
                    // Refresh UI or data here
                }
            })
            .then(client => {
                this.client = client;
                this.unsubscribe = client.unsubscribe;
            });
        }

        disconnectedCallback() {
            if (this.unsubscribe) this.unsubscribe();
            if (this.client?.disconnect) this.client.disconnect();
        }
    }
```

---

## Solution Summary
Salesforce’s EMP API is built on top of **CometD**.  
This solution reimplements the required behavior using the **CometD JavaScript client** loaded as a static resource.

High-level flow:

    LWC
      ↓
    CometD JS Client
      ↓
    /cometd/{apiVersion}
      ↓
    Salesforce Platform Event Bus

---

## Supported and Unsupported Scenarios

### Supported
- Experience Cloud LWCs
- Authenticated portal or community users
- Platform Events (`/event/*`)
- Multiple LWCs sharing a single CometD connection

### Not Supported
- Guest users (no session context)
- Change Data Capture (`/data/*`)
- EMP API fallback

---

## Architecture Overview

### Runtime Flow
1. LWC initializes the CometD client
2. JavaScript module requests auth context from Apex
3. CometD performs handshake with Salesforce Bayeux endpoint
4. Client subscribes to a Platform Event channel
5. Incoming events invoke LWC callbacks

### Components
- **LWC** – UI and event handling
- **c/cometD** – Client lifecycle and subscriptions
- **Apex Controller** – Provides authenticated context
- **Static Resource** – CometD UMD bundle

---

## Files Included

    force-app/main/default/
    ├── staticresources/
    │   └── cometdJS.js
    ├── classes/
    │   └── CometDController.cls
    └── lwc/
        └── cometD/
            └── cometD.js

---

## Static Resource Requirements
- Must be the **UMD bundle**
- Global reference must exist:

      window.org.cometd.CometD


---

## Apex Controller Contract

### Purpose
Provides the **running authenticated user context** required to authorize CometD connections.

### Responsibilities
- Return:
  - sessionId
  - apiVersion
- Enforce:
  - Authenticated users only
  - No guest access

### Security Requirements
- Never log the sessionId
- Never persist the sessionId client-side
- Do not expose the method to guest users

---

## LWC Usage Example

```js
    import { LightningElement } from 'lwc';
    import { initCometd } from 'c/cometD';

    export default class Example extends LightningElement {

        channel = '/event/Refresh__e';

        cometdClient;
        unsubscribe;
        initialized = false;

        connectedCallback() {
            if (this.initialized) return;
            this.initialized = true;

            initCometd({
                channel: this.channel,
                onMessage: (message) => {
                    const payload = message?.data?.payload || {};
                    console.log('[CometD] Event:', payload);
                    // Debounce or batch refresh logic here
                },
                onStatusChange: (status) => {
                    console.log('[CometD] Status:', status);
                }
            })
            .then(client => {
                this.cometdClient = client;
                this.unsubscribe = client.unsubscribe;
            })
            .catch(error => {
                console.error('[CometD] Init failed', error);
            });
        }

        disconnectedCallback() {
            if (this.unsubscribe) this.unsubscribe();
            if (this.cometdClient?.disconnect) this.cometdClient.disconnect();
        }
    }
```

---

## Recommended Usage Patterns

### One Connection per Page
- Use a shared CometD client per browser tab
- Allow multiple channel subscriptions on the same client

### Unsubscribe vs Disconnect
- **unsubscribe()**  
  Use when the component is destroyed but the client is shared
- **disconnect()**  
  Use only when the component owns the client and no other consumers exist

---

## Connection and Retry Strategy

### Endpoint
    /cometd/{apiVersion}

### Transport
- WebSocket (preferred)
- Long-polling fallback

---

## Performance Considerations
- Platform Events may arrive in bursts
- Avoid refreshing UI on every event
- Recommended:
  - Debounce refresh logic (250–500 ms)
  - Batch multiple events into one update
- Keep message handlers lightweight

---

## Security Considerations (Critical)

### Session Exposure Risk
This implementation relies on the browser holding a Salesforce session token.

Mandatory rules:
- Never log sessionId
- Never store sessionId
- Never expose sessionId outside the page
- Deny Guest access at Apex level

### XSS Mitigation
- Avoid injecting untrusted HTML or JavaScript
- Treat this as privileged client-side infrastructure

If your security posture disallows client-side session usage, a server-mediated relay must be used instead (with higher latency).

---

## Troubleshooting

### CometD global is undefined
- Static resource is not UMD
- Static resource name mismatch

### Handshake fails
- Guest user context
- Missing Apex class access
- Session expired
- CSP or proxy interference

### Stops receiving events
- Session idle timeout
- Network disruption
- Missing reconnect logic

---

## Design Assumptions
- EMP API is unavailable in Experience Cloud
- Platform Events only
- Authenticated users only
- Client-side CometD is acceptable within the security model

---

## Final Notes
This implementation mirrors EMP API behavior while remaining compatible with **Experience Cloud LWCs**.
