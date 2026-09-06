//
//  SafariWebExtensionHandler.swift
//  Shared (Extension)
//
//  Created by Mars Pater on 2026-08-20.
//

import SafariServices
import os.log

/// Native Messaging Bridge for Safari Web Extension
///
/// NOTE: RightClickRestore is a standard Safari Web Extension (Manifest V3).
/// The core extension runtime (DOM unblocking, event interception, Svelte 5 popup)
/// executes inside WebKit via `src/content`, `src/page-script`, and `src/popup`.
class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        var status = "ok"

        // Safely validate input message payload without echoing unvalidated arbitrary data
        if let userInfo = request?.userInfo {
            let rawMessage: Any?
            if #available(iOS 15.0, macOS 11.0, *) {
                rawMessage = userInfo[SFExtensionMessageKey]
            } else {
                rawMessage = userInfo["message"]
            }

            if let dict = rawMessage as? [String: Any] {
                // Ensure request action is recognized or safe
                if let action = dict["action"] as? String {
                    if action.count > 64 {
                        status = "invalid_action"
                    }
                }
            }
        }

        let payload: [String: Any] = ["status": status]
        let response = NSExtensionItem()
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [SFExtensionMessageKey: payload]
        } else {
            response.userInfo = ["message": payload]
        }

        context.completeRequest(returningItems: [response], completionHandler: nil)
    }

}
