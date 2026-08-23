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
/// This native handler handles optional native messages sent via `browser.runtime.sendNativeMessage`.
class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        let profile: UUID?
        if #available(iOS 17.0, macOS 14.0, *) {
            profile = request?.userInfo?[SFExtensionProfileKey] as? UUID
        } else {
            profile = request?.userInfo?["profile"] as? UUID
        }

        let message: Any?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

        os_log(.default, "Received native message: %@ (profile: %@)", String(describing: message), profile?.uuidString ?? "none")

        let response = NSExtensionItem()
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [ SFExtensionMessageKey: [ "status": "ok", "message": message ] ]
        } else {
            response.userInfo = [ "message": [ "status": "ok", "message": message ] ]
        }

        context.completeRequest(returningItems: [ response ], completionHandler: nil)
    }

}
