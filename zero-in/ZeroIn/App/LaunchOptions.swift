import Foundation

/// The four top-level tabs. Raw values double as the `-uiTab` launch argument.
enum AppTab: String, CaseIterable {
    case range, library, ballistics, settings
}

/// Process launch arguments used by the CI screenshot job (and handy from the
/// Xcode scheme editor): `-uiTab ballistics` opens that tab, `-seedDemo` inserts
/// a demo profile with two sessions when the store is empty.
enum LaunchOptions {
    static var arguments: [String] { ProcessInfo.processInfo.arguments }

    static func value(for flag: String) -> String? {
        guard let i = arguments.firstIndex(of: flag), i + 1 < arguments.count else { return nil }
        return arguments[i + 1]
    }

    static var initialTab: AppTab? { value(for: "-uiTab").flatMap(AppTab.init(rawValue:)) }

    static var seedDemo: Bool { arguments.contains("-seedDemo") }
}
