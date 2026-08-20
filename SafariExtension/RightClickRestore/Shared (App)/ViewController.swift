//
//  ViewController.swift
//  Shared (App)
//
//  Created by Mars Pater on 2026-08-20.
//

import Cocoa
import SafariServices

let extensionBundleIdentifier = "com.antigravity.RightClickRestore.Extension"

class ViewController: NSViewController {

    private var statusDot: NSView!
    private var statusTitleLabel: NSTextField!
    private var statusDescLabel: NSTextField!
    private var openPrefsButton: NSButton!
    private var refreshButton: NSButton!

    override func loadView() {
        let visualEffectView = NSVisualEffectView(frame: NSRect(x: 0, y: 0, width: 460, height: 480))
        visualEffectView.material = .hudWindow
        visualEffectView.blendingMode = .behindWindow
        visualEffectView.state = .active
        visualEffectView.wantsLayer = true
        self.view = visualEffectView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
    }

    override func viewWillAppear() {
        super.viewWillAppear()
        if let window = self.view.window {
            window.title = "Right Click Restorer"
            window.titlebarAppearsTransparent = true
            window.titleVisibility = .hidden
            window.styleMask.insert(.fullSizeContentView)
            window.isMovableByWindowBackground = true
            window.setContentSize(NSSize(width: 460, height: 480))
            window.minSize = NSSize(width: 420, height: 460)
            window.maxSize = NSSize(width: 500, height: 540)
            window.center()
        }
        checkExtensionStatus()
    }

    private func setupUI() {
        let container = NSStackView()
        container.orientation = .vertical
        container.alignment = .centerX
        container.spacing = 14
        container.edgeInsets = NSEdgeInsets(top: 28, left: 24, bottom: 24, right: 24)
        container.translatesAutoresizingMaskIntoConstraints = false
        self.view.addSubview(container)

        NSLayoutConstraint.activate([
            container.topAnchor.constraint(equalTo: self.view.topAnchor),
            container.bottomAnchor.constraint(equalTo: self.view.bottomAnchor),
            container.leadingAnchor.constraint(equalTo: self.view.leadingAnchor),
            container.trailingAnchor.constraint(equalTo: self.view.trailingAnchor)
        ])

        // 1. App Icon — use a shadow wrapper so shadow renders outside clipped icon
        let iconShadowWrapper = NSView()
        iconShadowWrapper.wantsLayer = true
        iconShadowWrapper.layer?.shadowColor = NSColor.black.cgColor
        iconShadowWrapper.layer?.shadowOpacity = 0.35
        iconShadowWrapper.layer?.shadowOffset = CGSize(width: 0, height: -4)
        iconShadowWrapper.layer?.shadowRadius = 12
        iconShadowWrapper.translatesAutoresizingMaskIntoConstraints = false

        let iconImageView = NSImageView()
        iconImageView.imageScaling = .scaleProportionallyUpOrDown
        iconImageView.image = NSApp.applicationIconImage
        iconImageView.translatesAutoresizingMaskIntoConstraints = false
        iconImageView.wantsLayer = true
        iconImageView.layer?.cornerRadius = 16
        iconImageView.layer?.masksToBounds = true

        iconShadowWrapper.addSubview(iconImageView)
        NSLayoutConstraint.activate([
            iconShadowWrapper.widthAnchor.constraint(equalToConstant: 72),
            iconShadowWrapper.heightAnchor.constraint(equalToConstant: 72),
            iconImageView.topAnchor.constraint(equalTo: iconShadowWrapper.topAnchor),
            iconImageView.bottomAnchor.constraint(equalTo: iconShadowWrapper.bottomAnchor),
            iconImageView.leadingAnchor.constraint(equalTo: iconShadowWrapper.leadingAnchor),
            iconImageView.trailingAnchor.constraint(equalTo: iconShadowWrapper.trailingAnchor)
        ])
        container.addArrangedSubview(iconShadowWrapper)

        // 2. Title & Version
        let titleRow = NSStackView()
        titleRow.orientation = .horizontal
        titleRow.alignment = .centerY
        titleRow.spacing = 8

        let titleLabel = NSTextField(labelWithString: "Right Click Restorer")
        titleLabel.font = NSFont.systemFont(ofSize: 20, weight: .bold)
        titleLabel.textColor = .labelColor
        titleRow.addArrangedSubview(titleLabel)

        let versionPill = NSTextField(labelWithString: " macOS 27 ")
        versionPill.font = NSFont.systemFont(ofSize: 10, weight: .semibold)
        versionPill.textColor = NSColor.systemTeal
        versionPill.wantsLayer = true
        versionPill.layer?.backgroundColor = NSColor.systemTeal.withAlphaComponent(0.15).cgColor
        versionPill.layer?.borderColor = NSColor.systemTeal.withAlphaComponent(0.35).cgColor
        versionPill.layer?.borderWidth = 1
        versionPill.layer?.cornerRadius = 6
        versionPill.layer?.masksToBounds = true
        titleRow.addArrangedSubview(versionPill)
        container.addArrangedSubview(titleRow)

        let subtitleLabel = NSTextField(labelWithString: "Apple Liquid Glass • Advanced Context Menu Engine")
        subtitleLabel.font = NSFont.systemFont(ofSize: 12, weight: .regular)
        subtitleLabel.textColor = .secondaryLabelColor
        container.addArrangedSubview(subtitleLabel)

        // 3. Status Glass Card
        let statusCard = NSView()
        statusCard.wantsLayer = true
        statusCard.layer?.backgroundColor = NSColor.white.withAlphaComponent(0.06).cgColor
        statusCard.layer?.borderColor = NSColor.white.withAlphaComponent(0.18).cgColor
        statusCard.layer?.borderWidth = 1
        statusCard.layer?.cornerRadius = 14
        statusCard.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            statusCard.widthAnchor.constraint(equalTo: container.widthAnchor, constant: -16),
            statusCard.heightAnchor.constraint(equalToConstant: 72)
        ])

        let statusStack = NSStackView()
        statusStack.orientation = .horizontal
        statusStack.alignment = .centerY
        statusStack.spacing = 14
        statusStack.translatesAutoresizingMaskIntoConstraints = false
        statusCard.addSubview(statusStack)

        NSLayoutConstraint.activate([
            statusStack.leadingAnchor.constraint(equalTo: statusCard.leadingAnchor, constant: 14),
            statusStack.trailingAnchor.constraint(equalTo: statusCard.trailingAnchor, constant: -14),
            statusStack.centerYAnchor.constraint(equalTo: statusCard.centerYAnchor)
        ])

        // Status Beacon Dot
        statusDot = NSView()
        statusDot.wantsLayer = true
        statusDot.layer?.cornerRadius = 7
        statusDot.layer?.backgroundColor = NSColor.systemOrange.cgColor
        statusDot.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            statusDot.widthAnchor.constraint(equalToConstant: 14),
            statusDot.heightAnchor.constraint(equalToConstant: 14)
        ])
        statusStack.addArrangedSubview(statusDot)

        let statusTextStack = NSStackView()
        statusTextStack.orientation = .vertical
        statusTextStack.alignment = .leading
        statusTextStack.spacing = 2

        statusTitleLabel = NSTextField(labelWithString: "Checking Safari Extension…")
        statusTitleLabel.font = NSFont.systemFont(ofSize: 13.5, weight: .semibold)
        statusTitleLabel.textColor = .labelColor
        statusTextStack.addArrangedSubview(statusTitleLabel)

        statusDescLabel = NSTextField(labelWithString: "Connecting to macOS Safari Extension Manager.")
        statusDescLabel.font = NSFont.systemFont(ofSize: 11, weight: .regular)
        statusDescLabel.textColor = .secondaryLabelColor
        statusTextStack.addArrangedSubview(statusDescLabel)

        statusStack.addArrangedSubview(statusTextStack)

        // Refresh status button
        refreshButton = NSButton()
        refreshButton.title = "↻"
        refreshButton.font = NSFont.systemFont(ofSize: 15, weight: .bold)
        refreshButton.bezelStyle = .circular
        refreshButton.target = self
        refreshButton.action = #selector(handleRefresh)
        statusStack.addArrangedSubview(refreshButton)

        container.addArrangedSubview(statusCard)

        // 4. Primary Action Button
        openPrefsButton = NSButton(title: "Open Safari Settings…", target: self, action: #selector(handleOpenPreferences))
        openPrefsButton.bezelStyle = .rounded
        openPrefsButton.keyEquivalent = "\r"
        openPrefsButton.font = NSFont.systemFont(ofSize: 13, weight: .semibold)
        openPrefsButton.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            openPrefsButton.widthAnchor.constraint(equalTo: container.widthAnchor, constant: -16),
            openPrefsButton.heightAnchor.constraint(equalToConstant: 32)
        ])
        container.addArrangedSubview(openPrefsButton)

        // 5. Checklist Guide Card
        let guideCard = NSView()
        guideCard.wantsLayer = true
        guideCard.layer?.backgroundColor = NSColor.white.withAlphaComponent(0.04).cgColor
        guideCard.layer?.borderColor = NSColor.white.withAlphaComponent(0.12).cgColor
        guideCard.layer?.borderWidth = 1
        guideCard.layer?.cornerRadius = 12
        guideCard.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            guideCard.widthAnchor.constraint(equalTo: container.widthAnchor, constant: -16)
        ])

        let guideStack = NSStackView()
        guideStack.orientation = .vertical
        guideStack.alignment = .leading
        guideStack.spacing = 8
        guideStack.edgeInsets = NSEdgeInsets(top: 10, left: 12, bottom: 10, right: 12)
        guideStack.translatesAutoresizingMaskIntoConstraints = false
        guideCard.addSubview(guideStack)

        NSLayoutConstraint.activate([
            guideStack.topAnchor.constraint(equalTo: guideCard.topAnchor),
            guideStack.bottomAnchor.constraint(equalTo: guideCard.bottomAnchor),
            guideStack.leadingAnchor.constraint(equalTo: guideCard.leadingAnchor),
            guideStack.trailingAnchor.constraint(equalTo: guideCard.trailingAnchor)
        ])

        let guideHeader = NSTextField(labelWithString: "Quick Setup Guide:")
        guideHeader.font = NSFont.systemFont(ofSize: 11.5, weight: .bold)
        guideHeader.textColor = .secondaryLabelColor
        guideStack.addArrangedSubview(guideHeader)

        let step1 = NSTextField(labelWithString: "1. Safari → Settings → Advanced → \"Show features for web developers\".")
        step1.font = NSFont.systemFont(ofSize: 11, weight: .regular)
        step1.textColor = .labelColor
        guideStack.addArrangedSubview(step1)

        let step2 = NSTextField(labelWithString: "2. Safari Menu → Develop → \"Allow Unsigned Extensions\".")
        step2.font = NSFont.systemFont(ofSize: 11, weight: .regular)
        step2.textColor = .labelColor
        guideStack.addArrangedSubview(step2)

        let step3 = NSTextField(labelWithString: "3. Safari → Extensions → Enable Right Click Restorer & choose \"Always Allow\".")
        step3.font = NSFont.systemFont(ofSize: 11, weight: .regular)
        step3.textColor = .labelColor
        guideStack.addArrangedSubview(step3)

        container.addArrangedSubview(guideCard)

        // 6. Tip Banner
        let tipLabel = NSTextField(labelWithString: "💡 Hold Shift while right-clicking anywhere to force native context menu.")
        tipLabel.font = NSFont.systemFont(ofSize: 11, weight: .medium)
        tipLabel.textColor = .secondaryLabelColor
        tipLabel.alignment = .center
        container.addArrangedSubview(tipLabel)
    }

    func checkExtensionStatus() {
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { [weak self] (state, error) in
            DispatchQueue.main.async {
                guard let self = self else { return }
                if let state = state, error == nil {
                    if state.isEnabled {
                        self.statusDot.layer?.backgroundColor = NSColor.systemGreen.cgColor
                        self.statusDot.layer?.shadowColor = NSColor.systemGreen.cgColor
                        self.statusDot.layer?.shadowOpacity = 0.7
                        self.statusDot.layer?.shadowRadius = 8
                        self.statusTitleLabel.stringValue = "Extension is Active in Safari"
                        self.statusDescLabel.stringValue = "Right-click and selection protections are active."
                    } else {
                        self.statusDot.layer?.backgroundColor = NSColor.systemGray.cgColor
                        self.statusDot.layer?.shadowOpacity = 0
                        self.statusTitleLabel.stringValue = "Extension is Disabled in Safari"
                        self.statusDescLabel.stringValue = "Click \"Open Safari Settings…\" to turn it on."
                    }
                } else {
                    self.statusDot.layer?.backgroundColor = NSColor.systemOrange.cgColor
                    self.statusTitleLabel.stringValue = "Awaiting Safari Permission"
                    self.statusDescLabel.stringValue = "Enable \"Allow Unsigned Extensions\" in Safari's Develop menu."
                }
            }
        }
    }

    @objc private func handleOpenPreferences() {
        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { error in
            if error != nil {
                if let url = URL(string: "x-apple.systempreferences:com.apple.Safari.Extensions") {
                    NSWorkspace.shared.open(url)
                }
            }
        }
    }

    @objc private func handleRefresh() {
        checkExtensionStatus()
    }
}
