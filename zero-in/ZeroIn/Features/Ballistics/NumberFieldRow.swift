import SwiftUI
import UIKit

/// A labeled numeric text field with a trailing unit, sized for a Form row.
struct NumberFieldRow: View {
    let title: String
    let unit: String
    @Binding var value: Double

    var body: some View {
        HStack {
            Text(title)
            Spacer(minLength: 8)
            TextField(title, value: $value,
                      format: .number.grouping(.never).precision(.fractionLength(0...2)))
                .keyboardType(.numbersAndPunctuation)
                .multilineTextAlignment(.trailing)
                .frame(minWidth: 70, maxWidth: 110)
            Text(unit)
                .foregroundStyle(.secondary)
                .frame(minWidth: 40, alignment: .leading)
        }
        .frame(minHeight: 44)
    }
}

/// Dismisses the keyboard (used by the keyboard toolbar's Done button).
func dismissKeyboard() {
    UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder),
                                    to: nil, from: nil, for: nil)
}
