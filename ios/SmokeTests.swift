import XCTest
import WebKit
@testable import PokeBaconStudio

final class SmokeTests: XCTestCase {
    @MainActor private func waitFor(_ script: String, in web: WKWebView) async throws {
        for _ in 0..<160 {
            if let value = try? await web.evaluateJavaScript(script), value as? Bool == true { return }
            try await Task.sleep(nanoseconds: 250_000_000)
        }
        XCTFail("Timed out waiting for: \(script)")
        throw NSError(domain: "StudioSmoke", code: 1)
    }

    @MainActor private func capture(_ name: String, window: UIWindow, web: WKWebView) async throws {
        try await Task.sleep(nanoseconds: 500_000_000)
        let image: UIImage = try await withCheckedThrowingContinuation { continuation in
            web.takeSnapshot(with: nil) { image, error in
                if let image { continuation.resume(returning: image) }
                else { continuation.resume(throwing: error ?? NSError(domain: "StudioSnapshot", code: 1)) }
            }
        }
        let rendered = UIGraphicsImageRenderer(bounds: window.bounds).image { _ in
            window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
            image.draw(in: web.convert(web.bounds, to: window))
        }
        let folder = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("Previews", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try XCTUnwrap(rendered.pngData()).write(to: folder.appendingPathComponent(name + ".png"))
        let attachment = XCTAttachment(image: rendered)
        attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
    }

    @MainActor func testOfflineEditorBootsWithPersistentStorageAndNativeBridge() async throws {
        let window = try XCTUnwrap(UIApplication.shared.windows.first(where: { $0.isKeyWindow }))
        XCTAssertGreaterThan(window.bounds.height, 600, "Use the full modern iPhone layout, not legacy compatibility dimensions")
        let editor = try XCTUnwrap(window.rootViewController as? EditorViewController)
        let web = try XCTUnwrap(editor.web)
        var ready = false
        for _ in 0..<120 {
            if let value = try? await web.evaluateJavaScript("typeof window.mapStudioBack === 'function'"), value as? Bool == true { ready = true; break }
            try await Task.sleep(nanoseconds: 250_000_000)
        }
        XCTAssertTrue(ready, "Bundled editor must boot without internet")
        let capabilities = try await web.evaluateJavaScript("JSON.stringify({secure:isSecureContext,crypto:!!crypto.subtle,wasm:typeof WebAssembly==='object',idb:!!indexedDB,bridge:typeof NativeBridge.exportBlob==='function'})")
        let text = try XCTUnwrap(capabilities as? String)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Bool])
        for key in ["secure", "crypto", "wasm", "idb", "bridge"] { XCTAssertEqual(object[key], true, key) }
        try await web.evaluateJavaScript("window.__studioStorageSmoke = false; const r=indexedDB.open('ios-smoke',1); r.onupgradeneeded=()=>r.result.createObjectStore('test'); r.onsuccess=()=>{r.result.close();window.__studioStorageSmoke=true}; r.onerror=()=>{window.__studioStorageSmoke=r.error.message}; void 0")
        var storageReady = false
        for _ in 0..<120 {
            if let value = try? await web.evaluateJavaScript("window.__studioStorageSmoke"), value as? Bool == true { storageReady = true; break }
            try await Task.sleep(nanoseconds: 250_000_000)
        }
        XCTAssertTrue(storageReady, "IndexedDB must open successfully")
        // Exercise nested navigation through the same controls used on the phone.
        try await waitFor("document.querySelector('#loading').hidden", in: web)
        try await waitFor("!document.querySelector('#toast').classList.contains('show')", in: web)
        try await capture("01-map-editor", window: window, web: web)
        try await web.evaluateJavaScript("document.querySelector('#menuButton').click(); void 0")
        try await waitFor("document.querySelector('#dialogTitle').textContent==='Projects'", in: web)
        try await capture("02-projects", window: window, web: web)
        try await web.evaluateJavaScript("document.querySelector('#helpMenu').click(); void 0")
        try await waitFor("document.querySelector('#dialogTitle').textContent!=='Projects'", in: web)
        let back = try XCTUnwrap(editor.view.subviews.compactMap { $0 as? UIButton }.first)
        back.sendActions(for: .touchUpInside)
        try await waitFor("document.querySelector('#dialogTitle').textContent==='Projects' && document.querySelector('#dialog').open", in: web)
        back.sendActions(for: .touchUpInside)
        try await waitFor("!document.querySelector('#dialog').open", in: web)
        try await web.evaluateJavaScript("document.querySelector('#workspaceButton').click(); void 0")
        try await capture("03-workspaces", window: window, web: web)
        try await web.evaluateJavaScript("document.querySelector('[data-workspace=\"sprites\"]').click(); void 0")
        try await waitFor("document.querySelector('#app').dataset.workspace==='sprites' && document.querySelector('#dialog').open", in: web)
        try await capture("04-sprites", window: window, web: web)
        try await web.evaluateJavaScript("document.querySelector('#closeDialog').click(); void 0")
        try await waitFor("document.querySelector('#app').dataset.workspace==='map'", in: web)
        // Commit actual IndexedDB data and verify it survives reloading the editor.
        try await web.evaluateJavaScript("window.__persisted=false; {const r=indexedDB.open('ios-smoke',1);r.onsuccess=()=>{const db=r.result,t=db.transaction('test','readwrite');t.objectStore('test').put('saved','checkpoint');t.oncomplete=()=>{db.close();window.__persisted=true}}}; void 0")
        try await waitFor("window.__persisted===true", in: web)
        web.reload()
        try await waitFor("typeof window.__persisted==='undefined' && typeof window.mapStudioBack==='function' && document.querySelector('#loading').hidden", in: web)
        try await web.evaluateJavaScript("window.__restored=false; {const r=indexedDB.open('ios-smoke',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('test').objectStore('test').get('checkpoint');q.onsuccess=()=>{window.__restored=q.result==='saved';db.close()}}}; void 0")
        try await waitFor("window.__restored===true", in: web)
        try await capture("05-back-to-map", window: window, web: web)
        // Exercise the real JS-to-Swift export bridge and byte storage, not a mock.
        try await web.evaluateJavaScript("window.__exportProbe='pending'; NativeBridge.exportBlob(new Blob([new Uint8Array([77,84,104,100,0,255])]),'native-smoke.mid').then(()=>window.__exportProbe='ready').catch(e=>window.__exportProbe=e.message); void 0")
        try await waitFor("window.__exportProbe==='ready'", in: web)
        for _ in 0..<100 {
            if editor.presentedViewController is UIDocumentPickerViewController { break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        let picker = try XCTUnwrap(editor.presentedViewController as? UIDocumentPickerViewController)
        let exported = try XCTUnwrap(FileManager.default.enumerator(at: FileManager.default.temporaryDirectory, includingPropertiesForKeys: nil)?.allObjects.compactMap { $0 as? URL }.first { $0.lastPathComponent == "native-smoke.mid" })
        XCTAssertEqual(try Data(contentsOf: exported), Data([77,84,104,100,0,255]))
        editor.documentPickerWasCancelled(picker)
        picker.dismiss(animated: false)
        for _ in 0..<20 {
            if editor.presentedViewController == nil { break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTAssertFalse(FileManager.default.fileExists(atPath: exported.path), "Cancelled exports must remove temporary output")
        try await web.evaluateJavaScript("window.__exportProbe='pending'; NativeBridge.exportBlob(new Blob(['retry']),'native-smoke.mid',true).then(()=>window.__exportProbe='ready').catch(e=>window.__exportProbe=e.message); void 0")
        try await waitFor("window.__exportProbe==='ready'", in: web)
        for _ in 0..<100 {
            if editor.presentedViewController is UIActivityViewController { break }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTAssertTrue(editor.presentedViewController is UIActivityViewController, "Share must open the native activity sheet after a cancelled save")
        editor.presentedViewController?.dismiss(animated: false)
    }
}
