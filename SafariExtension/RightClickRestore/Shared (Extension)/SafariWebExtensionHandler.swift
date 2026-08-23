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

        let message: Any?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

        // Return clean acknowledgement without logging sensitive payload content to system logs
        let response = NSExtensionItem()
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [ SFExtensionMessageKey: [ "status": "ok", "message": message ] ]
        } else {
            response.userInfo = [ "message": [ "status": "ok", "message": message ] ]
        }

        context.completeRequest(returningItems: [ response ], completionHandler: nil)
    }

}
