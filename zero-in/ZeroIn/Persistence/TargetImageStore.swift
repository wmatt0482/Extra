import Foundation
import UIKit

/// Target photos live as JPEGs in Documents/Targets/<uuid>.jpg. SwiftData
/// records store only the file name.
enum TargetImageStore {
    enum StoreError: Error {
        case encodingFailed
    }

    static var directory: URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return docs.appendingPathComponent("Targets", isDirectory: true)
    }

    static func url(for fileName: String) -> URL {
        // Only ever a bare file name inside our directory.
        let safeName = (fileName as NSString).lastPathComponent
        return directory.appendingPathComponent(safeName, isDirectory: false)
    }

    /// Writes the image as JPEG (quality 0.8) and returns the file name.
    static func save(_ image: UIImage, id: UUID) throws -> String {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        guard let data = image.jpegData(compressionQuality: 0.8) else { throw StoreError.encodingFailed }
        let fileName = "\(id.uuidString).jpg"
        try data.write(to: url(for: fileName), options: .atomic)
        return fileName
    }

    static func load(_ fileName: String) -> UIImage? {
        UIImage(contentsOfFile: url(for: fileName).path)
    }

    static func delete(_ fileName: String) {
        try? FileManager.default.removeItem(at: url(for: fileName))
    }
}
