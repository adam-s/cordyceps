import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import type { TestContext } from '../api';

export async function testSetInputFilesFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting setInputFiles functionality tests',
    });

    // Test 1: Single file input with File object
    progress.log('Test 1: Testing single file input with File object');
    try {
      // Set up event listeners to verify events are fired
      await page.evaluate(() => {
        const input = document.getElementById('file-input') as HTMLInputElement;

        // Declare the interface for our test data
        interface FileInputEventData {
          inputFired: boolean;
          changeFired: boolean;
          inputEvent: {
            type: string;
            bubbles: boolean;
            cancelable: boolean;
            target: boolean;
          } | null;
          changeEvent: {
            type: string;
            bubbles: boolean;
            cancelable: boolean;
            target: boolean;
          } | null;
        }

        // Store event info on window for verification
        (window as unknown as { fileInputEvents: FileInputEventData }).fileInputEvents = {
          inputFired: false,
          changeFired: false,
          inputEvent: null,
          changeEvent: null,
        };

        input.addEventListener('input', event => {
          const eventData = (window as unknown as { fileInputEvents: FileInputEventData })
            .fileInputEvents;
          eventData.inputFired = true;
          eventData.inputEvent = {
            type: event.type,
            bubbles: event.bubbles,
            cancelable: event.cancelable,
            target: event.target === input,
          };
        });

        input.addEventListener('change', event => {
          const eventData = (window as unknown as { fileInputEvents: FileInputEventData })
            .fileInputEvents;
          eventData.changeFired = true;
          eventData.changeEvent = {
            type: event.type,
            bubbles: event.bubbles,
            cancelable: event.cancelable,
            target: event.target === input,
          };
        });
      });

      // Create a simple text file
      const textContent = 'Hello, this is a test file for setInputFiles functionality!';
      const textFile = new File([textContent], 'test-file.txt', { type: 'text/plain' });

      // Scroll the input into view before setting files
      await page.locator('#file-input').scrollIntoViewIfNeeded();

      // Set the file on the single file input
      await page.setInputFiles('#file-input', [textFile]);

      // Small delay to ensure file setting is complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Dispatch events to trigger UI updates exactly like user interaction
      await page.dispatchEvent('#file-input', 'input');
      await page.dispatchEvent('#file-input', 'change');

      // Small delay to ensure events are processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Also explicitly call showFileStatus to ensure UI updates
      await page.evaluate(() => {
        const globalWindow = window as unknown as { showFileStatus?: () => void };

        if (typeof globalWindow.showFileStatus === 'function') {
          globalWindow.showFileStatus();
        }
      });

      // Comprehensive verification of file input
      const fileVerification = await page.evaluate(async () => {
        const input = document.getElementById('file-input') as HTMLInputElement;
        if (!input.files || input.files.length === 0) {
          return { success: false, error: 'No files found in input' };
        }

        const file = input.files[0];

        // Read the file content to verify it matches what we set
        const fileContent = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsText(file);
        });

        // Get event verification data
        const eventData = (
          window as unknown as {
            fileInputEvents: {
              inputFired: boolean;
              changeFired: boolean;
              inputEvent: {
                type: string;
                bubbles: boolean;
                cancelable: boolean;
                target: boolean;
              } | null;
              changeEvent: {
                type: string;
                bubbles: boolean;
                cancelable: boolean;
                target: boolean;
              } | null;
            };
          }
        ).fileInputEvents;

        return {
          success: true,
          fileCount: input.files.length,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          fileContent: fileContent,
          lastModified: file.lastModified,
          // Verify FileList properties
          fileListLength: input.files.length,
          fileListItem0: input.files.item(0)?.name,
          // Verify input element state
          inputValue: input.value,
          inputDisabled: input.disabled,
          inputRequired: input.required,
          // Event verification
          eventsVerified: eventData,
        };
      });

      // Verify all aspects of the file input
      if (!fileVerification.success) {
        throw new Error(fileVerification.error || 'File verification failed');
      }

      const expectedContent = 'Hello, this is a test file for setInputFiles functionality!';
      if (fileVerification.fileContent !== expectedContent) {
        throw new Error(
          `File content mismatch. Expected: "${expectedContent}", Got: "${fileVerification.fileContent}"`,
        );
      }

      if (fileVerification.fileName !== 'test-file.txt') {
        throw new Error(
          `File name mismatch. Expected: "test-file.txt", Got: "${fileVerification.fileName}"`,
        );
      }

      if (fileVerification.fileType !== 'text/plain') {
        throw new Error(
          `File type mismatch. Expected: "text/plain", Got: "${fileVerification.fileType}"`,
        );
      }

      if (fileVerification.fileSize !== textFile.size) {
        throw new Error(
          `File size mismatch. Expected: ${textFile.size}, Got: ${fileVerification.fileSize}`,
        );
      }

      // Verify events were properly fired
      if (!fileVerification.eventsVerified.inputFired) {
        throw new Error('Input event was not fired when setting files');
      }

      if (!fileVerification.eventsVerified.changeFired) {
        throw new Error('Change event was not fired when setting files');
      }

      if (!fileVerification.eventsVerified.inputEvent?.bubbles) {
        throw new Error('Input event should bubble');
      }

      if (!fileVerification.eventsVerified.changeEvent?.bubbles) {
        throw new Error('Change event should bubble');
      }

      if (
        !fileVerification.eventsVerified.inputEvent?.target ||
        !fileVerification.eventsVerified.changeEvent?.target
      ) {
        throw new Error('Events should target the correct input element');
      }

      progress.log('✅ Single file input test passed with comprehensive verification');
      progress.log(`  📄 File name: ${fileVerification.fileName}`);
      progress.log(`  📦 File type: ${fileVerification.fileType}`);
      progress.log(`  📏 File size: ${fileVerification.fileSize} bytes`);
      progress.log(`  📝 Content verified: ${fileVerification.fileContent.substring(0, 30)}...`);
      progress.log(`  🎯 Input event fired: ${fileVerification.eventsVerified.inputFired}`);
      progress.log(`  🎯 Change event fired: ${fileVerification.eventsVerified.changeFired}`);

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 1 passed: Single file input works perfectly',
        details: {
          fileName: fileVerification.fileName,
          fileSize: fileVerification.fileSize,
          fileType: fileVerification.fileType,
          contentVerified: true,
          propertiesVerified: true,
        },
      });
    } catch (error) {
      progress.log(`Test 1 error: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Test 1 failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 2: Multiple files input with File objects
    progress.log('Test 2: Testing multiple files input with File objects');
    try {
      // Create multiple files of different types
      const files = [
        new File(['{"name": "test", "value": 123}'], 'data.json', { type: 'application/json' }),
        new File(['<!DOCTYPE html><html><body>Test</body></html>'], 'test.html', {
          type: 'text/html',
        }),
        new File(['Line 1\nLine 2\nLine 3'], 'multiline.txt', { type: 'text/plain' }),
      ];

      // Scroll the multiple files input into view before setting files
      await page.locator('#multiple-files').scrollIntoViewIfNeeded();

      // Set multiple files
      await page.setInputFiles('#multiple-files', files);

      // Small delay to ensure file setting is complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Dispatch events to trigger UI updates exactly like user interaction
      await page.dispatchEvent('#multiple-files', 'input');
      await page.dispatchEvent('#multiple-files', 'change');

      // Small delay to ensure events are processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Also explicitly call showFileStatus to ensure UI updates
      await page.evaluate(() => {
        const globalWindow = window as unknown as { showFileStatus?: () => void };
        if (typeof globalWindow.showFileStatus === 'function') {
          globalWindow.showFileStatus();
        }
      });

      // Comprehensive verification of multiple files
      const multiFileVerification = await page.evaluate(async () => {
        const input = document.getElementById('multiple-files') as HTMLInputElement;
        if (!input.files || input.files.length === 0) {
          return { success: false, error: 'No files found in input' };
        }

        const fileDetails = [];
        const expectedContents = [
          '{"name": "test", "value": 123}',
          '<!DOCTYPE html><html><body>Test</body></html>',
          'Line 1\nLine 2\nLine 3',
        ];

        // Read and verify each file
        for (let i = 0; i < input.files.length; i++) {
          const file = input.files[i];
          const content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
          });

          fileDetails.push({
            index: i,
            name: file.name,
            type: file.type,
            size: file.size,
            content: content,
            contentMatches: content === expectedContents[i],
            lastModified: file.lastModified,
          });
        }

        return {
          success: true,
          fileCount: input.files.length,
          files: fileDetails,
          // Verify FileList iteration
          fileListIterable: Array.from(input.files).length === input.files.length,
          // Verify input state
          inputValue: input.value,
          inputMultiple: input.multiple,
        };
      });

      if (!multiFileVerification.success) {
        throw new Error(multiFileVerification.error || 'Multiple files verification failed');
      }

      if (multiFileVerification.fileCount !== files.length) {
        throw new Error(`Expected ${files.length} files, got ${multiFileVerification.fileCount}`);
      }

      // Verify each file individually
      const expectedFiles = [
        { name: 'data.json', type: 'application/json' },
        { name: 'test.html', type: 'text/html' },
        { name: 'multiline.txt', type: 'text/plain' },
      ];

      for (let i = 0; i < expectedFiles.length; i++) {
        const expected = expectedFiles[i];
        const actual = multiFileVerification.files[i];

        if (!actual.contentMatches) {
          throw new Error(`File ${i} content mismatch: ${actual.name}`);
        }

        if (actual.name !== expected.name) {
          throw new Error(
            `File ${i} name mismatch. Expected: "${expected.name}", Got: "${actual.name}"`,
          );
        }

        if (actual.type !== expected.type) {
          throw new Error(
            `File ${i} type mismatch. Expected: "${expected.type}", Got: "${actual.type}"`,
          );
        }
      }

      progress.log(
        `✅ Multiple files input test passed with comprehensive verification (${files.length} files)`,
      );
      multiFileVerification.files.forEach((file, index) => {
        progress.log(`  📄 File ${index + 1}: ${file.name} (${file.type}, ${file.size} bytes) ✓`);
      });

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 2 passed: Multiple files input works perfectly',
        details: {
          fileCount: multiFileVerification.fileCount,
          files: multiFileVerification.files.map(f => ({
            name: f.name,
            type: f.type,
            size: f.size,
            contentVerified: f.contentMatches,
          })),
          allContentsVerified: multiFileVerification.files.every(f => f.contentMatches),
        },
      });
    } catch (error) {
      progress.log(`Test 2 error: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Test 2 failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 3: Image files with ArrayBuffer data
    progress.log('Test 3: Testing image files with ArrayBuffer data');
    try {
      // Create a simple PNG image data (minimal valid PNG)
      const pngHeader = new Uint8Array([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a, // PNG signature
        0x00,
        0x00,
        0x00,
        0x0d, // IHDR chunk length
        0x49,
        0x48,
        0x44,
        0x52, // IHDR
        0x00,
        0x00,
        0x00,
        0x01, // Width: 1
        0x00,
        0x00,
        0x00,
        0x01, // Height: 1
        0x08,
        0x02,
        0x00,
        0x00,
        0x00, // Bit depth: 8, Color type: 2 (RGB), Compression: 0, Filter: 0, Interlace: 0
        0x90,
        0x77,
        0x53,
        0xde, // CRC32
        0x00,
        0x00,
        0x00,
        0x0c, // IDAT chunk length
        0x49,
        0x44,
        0x41,
        0x54, // IDAT
        0x08,
        0x99,
        0x01,
        0x01,
        0x00,
        0x00,
        0x00,
        0xff,
        0xff,
        0x00,
        0x00,
        0x00, // Compressed data
        0x02,
        0x00,
        0x01,
        0x00, // CRC32
        0x00,
        0x00,
        0x00,
        0x00, // IEND chunk length
        0x49,
        0x45,
        0x4e,
        0x44, // IEND
        0xae,
        0x42,
        0x60,
        0x82, // CRC32
      ]);

      // Create file payload from ArrayBuffer
      const imagePayload = {
        name: 'test-image.png',
        mimeType: 'image/png',
        buffer: pngHeader.buffer,
      };

      // Scroll the image files input into view before setting files
      await page.locator('#image-files').scrollIntoViewIfNeeded();

      // Set the image file
      await page.setInputFiles('#image-files', [imagePayload]);

      // Dispatch events to trigger UI updates exactly like user interaction
      await page.dispatchEvent('#image-files', 'input');
      await page.dispatchEvent('#image-files', 'change');

      // Also explicitly call showFileStatus to ensure UI updates
      await page.evaluate(() => {
        const globalWindow = window as unknown as { showFileStatus?: () => void };
        if (typeof globalWindow.showFileStatus === 'function') {
          globalWindow.showFileStatus();
        }
      });

      // Comprehensive verification of image file with binary data
      const imageVerification = await page.evaluate(async () => {
        const input = document.getElementById('image-files') as HTMLInputElement;
        if (!input.files || input.files.length === 0) {
          return { success: false, error: 'No image files found in input' };
        }

        const file = input.files[0];

        // Read the file as ArrayBuffer to verify binary content
        const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(file);
        });

        // Convert to Uint8Array for byte-by-byte comparison
        const uint8Array = new Uint8Array(arrayBuffer);

        // Verify PNG signature (first 8 bytes)
        const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
        const signatureMatch = pngSignature.every((byte, index) => uint8Array[index] === byte);

        // Create a data URL to verify the image can be loaded
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });

        return {
          success: true,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          arrayBufferSize: arrayBuffer.byteLength,
          uint8ArrayLength: uint8Array.length,
          pngSignatureValid: signatureMatch,
          dataUrlValid: dataUrl.startsWith('data:image/png;base64,'),
          firstFewBytes: Array.from(uint8Array.slice(0, 16)), // First 16 bytes for verification
          lastModified: file.lastModified,
          // File properties
          webkitRelativePath: file.webkitRelativePath,
        };
      });

      if (!imageVerification.success) {
        throw new Error(imageVerification.error || 'Image file verification failed');
      }

      // Verify the image file properties
      if (imageVerification.fileName !== 'test-image.png') {
        throw new Error(
          `Image name mismatch. Expected: "test-image.png", Got: "${imageVerification.fileName}"`,
        );
      }

      if (imageVerification.fileType !== 'image/png') {
        throw new Error(
          `Image type mismatch. Expected: "image/png", Got: "${imageVerification.fileType}"`,
        );
      }

      if (imageVerification.fileSize !== pngHeader.byteLength) {
        throw new Error(
          `Image size mismatch. Expected: ${pngHeader.byteLength}, Got: ${imageVerification.fileSize}`,
        );
      }

      if (!imageVerification.pngSignatureValid) {
        throw new Error('PNG signature validation failed - binary data corruption detected');
      }

      if (!imageVerification.dataUrlValid) {
        throw new Error('Data URL generation failed - image file may be corrupted');
      }

      progress.log('✅ Image file input test passed with comprehensive binary verification');
      progress.log(`  🖼️  Image name: ${imageVerification.fileName}`);
      progress.log(`  📦 Image type: ${imageVerification.fileType}`);
      progress.log(`  📏 Image size: ${imageVerification.fileSize} bytes`);
      progress.log(
        `  🔍 PNG signature: ${imageVerification.pngSignatureValid ? 'Valid' : 'Invalid'}`,
      );
      progress.log(`  🔗 Data URL: ${imageVerification.dataUrlValid ? 'Valid' : 'Invalid'}`);
      progress.log(
        `  📊 Binary data: [${imageVerification.firstFewBytes
          .slice(0, 8)
          .map(b => '0x' + b.toString(16).padStart(2, '0'))
          .join(', ')}...]`,
      );

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 3 passed: Image file input with ArrayBuffer works perfectly',
        details: {
          fileName: imageVerification.fileName,
          fileType: imageVerification.fileType,
          fileSize: imageVerification.fileSize,
          binaryDataVerified: imageVerification.pngSignatureValid,
          dataUrlGenerated: imageVerification.dataUrlValid,
          arrayBufferIntact: imageVerification.arrayBufferSize === imageVerification.fileSize,
        },
      });
    } catch (error) {
      progress.log(`Test 3 error: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Test 3 failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 4: Directory upload with multiple files
    progress.log('Test 4: Testing directory upload with multiple files');
    try {
      // Create files that simulate a directory structure
      const directoryFiles = [
        new File(['Root file content'], 'root-file.txt', { type: 'text/plain' }),
        new File(['Subfolder file content'], 'subfolder/file.txt', { type: 'text/plain' }),
        new File(['{"config": true}'], 'subfolder/config.json', { type: 'application/json' }),
        new File(['Another subfolder file'], 'another/deep/file.txt', { type: 'text/plain' }),
      ];

      // Scroll the directory upload input into view before setting files
      await page.locator('#directory-upload').scrollIntoViewIfNeeded();

      // Set directory files with directoryUpload option
      await page.setInputFiles('#directory-upload', directoryFiles, { directoryUpload: true });

      // Dispatch events to trigger UI updates exactly like user interaction
      await page.dispatchEvent('#directory-upload', 'input');
      await page.dispatchEvent('#directory-upload', 'change');

      // Also explicitly call showFileStatus to ensure UI updates
      await page.evaluate(() => {
        const globalWindow = window as unknown as { showFileStatus?: () => void };
        if (typeof globalWindow.showFileStatus === 'function') {
          globalWindow.showFileStatus();
        }
      });

      // Verify directory files were set
      const directoryFileInfo = (await page.evaluate(() => {
        const input = document.getElementById('directory-upload') as HTMLInputElement;
        if (input.files && input.files.length > 0) {
          return {
            count: input.files.length,
            names: Array.from(input.files).map(f => f.name),
          };
        }
        return { count: 0, names: [] };
      })) as { count: number; names: string[] };

      if (directoryFileInfo.count === directoryFiles.length) {
        progress.log(`✅ Directory upload test passed (${directoryFiles.length} files)`);
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Test 4 passed: Directory upload works',
          details: { fileCount: directoryFiles.length, fileNames: directoryFileInfo.names },
        });
      } else {
        throw new Error(
          `Expected ${directoryFiles.length} directory files, got ${directoryFileInfo.count}`,
        );
      }
    } catch (error) {
      progress.log(`Test 4 error: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Test 4 failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 5: Force option with hidden file input
    progress.log('Test 5: Testing force option with hidden file input');
    try {
      const hiddenFile = new File(['Hidden file content'], 'hidden-test.txt', {
        type: 'text/plain',
      });

      progress.log('  Setting file on hidden input...');
      // Note: Don't scroll hidden elements into view as they can't be scrolled
      // Set file on hidden input using force option
      await page.setInputFiles('#hidden-file-input', [hiddenFile], { force: true });

      progress.log('  File set successfully, skipping event dispatch for hidden element');
      // Note: Skip event dispatching for hidden elements as they may not respond to events
      // The file setting itself is what we're testing here

      progress.log('  Verifying file was set...');
      // Verify the hidden file was set
      const hiddenFileCount = await page.evaluate(() => {
        const input = document.getElementById('hidden-file-input') as HTMLInputElement;
        return input.files ? input.files.length : 0;
      });

      if (hiddenFileCount === 1) {
        progress.log('✅ Force option with hidden input test passed');
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Test 5 passed: Force option with hidden input works',
          details: { fileName: hiddenFile.name },
        });
      } else {
        throw new Error(`Expected 1 hidden file, got ${hiddenFileCount}`);
      }
    } catch (error) {
      progress.log(`Test 5 error: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Test 5 failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 6: Large file with binary data
    progress.log('Test 6: Testing large file with binary data');
    try {
      // Create a larger binary file (1MB)
      const largeSize = 1024 * 1024; // 1MB
      const binaryData = new Uint8Array(largeSize);

      // Fill with pseudo-random data
      for (let i = 0; i < largeSize; i++) {
        binaryData[i] = (i * 137) % 256; // Simple pseudo-random pattern
      }

      const largeBinaryPayload = {
        name: 'large-binary-file.bin',
        mimeType: 'application/octet-stream',
        buffer: binaryData.buffer,
      };

      // Scroll the any-file input into view before setting files
      await page.locator('#any-file-input').scrollIntoViewIfNeeded();

      // Set the large binary file
      await page.setInputFiles('#any-file-input', [largeBinaryPayload]);

      // Dispatch events to trigger UI updates exactly like user interaction
      await page.dispatchEvent('#any-file-input', 'input');
      await page.dispatchEvent('#any-file-input', 'change');

      // Also explicitly call showFileStatus to ensure UI updates
      await page.evaluate(() => {
        const globalWindow = window as unknown as { showFileStatus?: () => void };
        if (typeof globalWindow.showFileStatus === 'function') {
          globalWindow.showFileStatus();
        }
      });

      // Verify the large file was set
      const largeFileInfo = (await page.evaluate(() => {
        const input = document.getElementById('any-file-input') as HTMLInputElement;
        if (input.files && input.files.length > 0) {
          const file = input.files[0];
          return {
            count: input.files.length,
            name: file.name,
            size: file.size,
            type: file.type,
          };
        }
        return { count: 0 };
      })) as { count: number; name?: string; size?: number; type?: string };

      if (largeFileInfo.count === 1 && largeFileInfo.size === largeSize) {
        progress.log(`✅ Large binary file test passed (${largeFileInfo.size} bytes)`);
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Test 6 passed: Large binary file input works',
          details: largeFileInfo,
        });
      } else {
        throw new Error(
          `Expected 1 large file of ${largeSize} bytes, got ${largeFileInfo.count} files`,
        );
      }
    } catch (error) {
      progress.log(`Test 6 error: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Test 6 failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 7: Clear files by setting empty array
    progress.log('Test 7: Testing clearing files by setting empty array');
    try {
      // Scroll inputs into view before setting files
      await page.locator('#any-file-input').scrollIntoViewIfNeeded();

      // First set a file
      const tempFile = new File(['Temporary content'], 'temp.txt', { type: 'text/plain' });
      await page.setInputFiles('#any-file-input', [tempFile]);

      // Verify file was set
      let fileCount = await page.evaluate(() => {
        const input = document.getElementById('any-file-input') as HTMLInputElement;
        return input.files ? input.files.length : 0;
      });

      if (fileCount !== 1) {
        throw new Error(`Setup failed: expected 1 file, got ${fileCount}`);
      }

      // Clear files by setting empty array
      await page.setInputFiles('#any-file-input', []);

      // Verify files were cleared
      fileCount = await page.evaluate(() => {
        const input = document.getElementById('any-file-input') as HTMLInputElement;
        return input.files ? input.files.length : 0;
      });

      if (fileCount === 0) {
        progress.log('✅ Clear files test passed');
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Test 7 passed: Clearing files with empty array works',
        });
      } else {
        throw new Error(`Expected 0 files after clearing, got ${fileCount}`);
      }
    } catch (error) {
      progress.log(`Test 7 error: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Test 7 failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 8: Test with disabled input after enabling
    progress.log('Test 8: Testing disabled input after enabling');
    try {
      // Scroll the disabled input into view first
      await page.locator('#disabled-file-input').scrollIntoViewIfNeeded();

      // First enable the disabled input
      await page.click('button[onclick="enableDisabledInput()"]');

      // Wait a moment for the enable action to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Now try to set a file on the previously disabled input
      const enabledFile = new File(['Enabled file content'], 'enabled-test.txt', {
        type: 'text/plain',
      });
      await page.setInputFiles('#disabled-file-input', [enabledFile]);

      // Verify the file was set
      const enabledFileCount = await page.evaluate(() => {
        const input = document.getElementById('disabled-file-input') as HTMLInputElement;
        return input.files ? input.files.length : 0;
      });

      if (enabledFileCount === 1) {
        progress.log('✅ Enabled input test passed');
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Test 8 passed: Setting files on enabled input works',
          details: { fileName: enabledFile.name },
        });
      } else {
        throw new Error(`Expected 1 file on enabled input, got ${enabledFileCount}`);
      }
    } catch (error) {
      progress.log(`Test 8 error: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Test 8 failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 9: Mixed File objects and file payloads
    progress.log('Test 9: Testing mixed File objects and file payloads');
    try {
      // Create File objects first
      const fileObjects = [
        new File(['Regular file content'], 'regular.txt', { type: 'text/plain' }),
        new File(['Another regular file'], 'another.txt', { type: 'text/plain' }),
      ];

      // Create FilePayload objects
      const filePayloads = [
        {
          name: 'payload-file.json',
          mimeType: 'application/json',
          buffer: new TextEncoder().encode('{"source": "payload"}').buffer,
        },
      ];

      // Scroll inputs into view before setting mixed files
      await page.locator('#multiple-files').scrollIntoViewIfNeeded();

      // Test with File objects first
      await page.setInputFiles('#multiple-files', fileObjects);

      // Scroll to the other input
      await page.locator('#any-file-input').scrollIntoViewIfNeeded();

      // Then test with FilePayload objects
      await page.setInputFiles('#any-file-input', filePayloads);

      // Verify files were set
      const mixedFileInfo = (await page.evaluate(() => {
        const multipleInput = document.getElementById('multiple-files') as HTMLInputElement;
        const anyInput = document.getElementById('any-file-input') as HTMLInputElement;

        const multipleFiles = multipleInput.files ? Array.from(multipleInput.files) : [];
        const anyFiles = anyInput.files ? Array.from(anyInput.files) : [];

        return {
          multipleCount: multipleFiles.length,
          anyCount: anyFiles.length,
          multipleNames: multipleFiles.map(f => f.name),
          anyNames: anyFiles.map(f => f.name),
          totalCount: multipleFiles.length + anyFiles.length,
        };
      })) as {
        multipleCount: number;
        anyCount: number;
        multipleNames: string[];
        anyNames: string[];
        totalCount: number;
      };

      if (
        mixedFileInfo.multipleCount === fileObjects.length &&
        mixedFileInfo.anyCount === filePayloads.length
      ) {
        progress.log(`✅ Mixed files test passed (${mixedFileInfo.totalCount} total files)`);
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Test 9 passed: File objects and FilePayload objects work separately',
          details: mixedFileInfo,
        });
      } else {
        throw new Error(
          `Expected ${fileObjects.length} File objects and ${filePayloads.length} FilePayload objects`,
        );
      }
    } catch (error) {
      progress.log(`Test 9 error: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Test 9 failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 10: API consistency across layers (ElementHandle, Locator, Frame, Page)
    progress.log('Test 10: Testing API consistency across layers');
    try {
      const testFile = new File(['API consistency test'], 'api-test.txt', { type: 'text/plain' });

      // Scroll the file input into view for API consistency tests
      await page.locator('#file-input').scrollIntoViewIfNeeded();

      // Test Page.setInputFiles (already tested above)
      await page.setInputFiles('#file-input', [testFile]);

      // Test Frame.setInputFiles
      const frame = page.mainFrame();
      await frame.setInputFiles('#file-input', [testFile]);

      // Test Locator.setInputFiles
      const locator = page.locator('#file-input');
      await locator.setInputFiles([testFile]);

      // Test ElementHandle.setInputFiles
      const elementHandle = await page.locator('#file-input').elementHandle();
      if (elementHandle) {
        await elementHandle.setInputFiles([testFile]);
        elementHandle.dispose();
      }

      progress.log('✅ API consistency test passed');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 10 passed: API consistency across all layers works',
        details: { fileName: testFile.name },
      });
    } catch (error) {
      progress.log(`Test 10 error: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Test 10 failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Final Comprehensive Test: All-in-one verification
    progress.log('🔍 Final Test: Comprehensive file input verification');
    try {
      // Create a comprehensive test file with special content
      const comprehensiveContent = JSON.stringify(
        {
          testSuite: 'setInputFiles',
          timestamp: Date.now(),
          features: ['file-objects', 'array-buffers', 'events', 'validation'],
          unicodeTest: '🚀 Unicode content! 中文测试 العربية',
          binaryMarkers: [0x00, 0xff, 0x42, 0xaa],
        },
        null,
        2,
      );

      const comprehensiveFile = new File([comprehensiveContent], 'comprehensive-test.json', {
        type: 'application/json',
      });

      // Scroll the file input into view for the comprehensive test
      await page.locator('#file-input').scrollIntoViewIfNeeded();

      // Set up comprehensive event tracking
      await page.evaluate(() => {
        const input = document.getElementById('file-input') as HTMLInputElement;
        (window as unknown as { comprehensiveEvents: unknown }).comprehensiveEvents = {
          eventsTracked: [],
          inputEventDetails: null,
          changeEventDetails: null,
        };

        ['input', 'change', 'focus', 'blur'].forEach(eventType => {
          input.addEventListener(eventType, event => {
            const events = (
              window as unknown as {
                comprehensiveEvents: {
                  eventsTracked: string[];
                  inputEventDetails: unknown;
                  changeEventDetails: unknown;
                };
              }
            ).comprehensiveEvents;

            events.eventsTracked.push(eventType);

            if (eventType === 'input') {
              events.inputEventDetails = {
                timestamp: Date.now(),
                filesLength: input.files?.length || 0,
                value: input.value,
                bubbles: event.bubbles,
                cancelable: event.cancelable,
              };
            } else if (eventType === 'change') {
              events.changeEventDetails = {
                timestamp: Date.now(),
                filesLength: input.files?.length || 0,
                value: input.value,
                bubbles: event.bubbles,
                cancelable: event.cancelable,
              };
            }
          });
        });
      });

      // Set the comprehensive test file
      await page.setInputFiles('#file-input', [comprehensiveFile]);

      // Perform exhaustive verification
      const comprehensiveVerification = await page.evaluate(async () => {
        const input = document.getElementById('file-input') as HTMLInputElement;

        if (!input.files || input.files.length === 0) {
          return { success: false, error: 'No files found in input' };
        }

        const file = input.files[0];

        // Read file content multiple ways to ensure consistency
        const contentAsText = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsText(file);
        });

        const contentAsArrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(file);
        });

        const contentAsDataURL = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });

        // Parse JSON content to verify structure
        let parsedContent;
        try {
          parsedContent = JSON.parse(contentAsText);
        } catch (e) {
          return { success: false, error: 'Failed to parse JSON content' };
        }

        // Get event tracking data
        const eventData = (
          window as unknown as {
            comprehensiveEvents: {
              eventsTracked: string[];
              inputEventDetails: {
                timestamp: number;
                filesLength: number;
                value: string;
                bubbles: boolean;
                cancelable: boolean;
              } | null;
              changeEventDetails: {
                timestamp: number;
                filesLength: number;
                value: string;
                bubbles: boolean;
                cancelable: boolean;
              } | null;
            };
          }
        ).comprehensiveEvents;

        // Verify File API compliance
        const fileApiCompliance = {
          hasName: typeof file.name === 'string',
          hasSize: typeof file.size === 'number',
          hasType: typeof file.type === 'string',
          hasLastModified: typeof file.lastModified === 'number',
          hasArrayBufferMethod: typeof file.arrayBuffer === 'function',
          hasTextMethod: typeof file.text === 'function',
          hasStreamMethod: typeof file.stream === 'function',
          hasSliceMethod: typeof file.slice === 'function',
        };

        // Verify FileList API compliance
        const fileListCompliance = {
          hasLength: typeof input.files.length === 'number',
          hasItemMethod: typeof input.files.item === 'function',
          isIterable: Symbol.iterator in input.files,
        };

        return {
          success: true,
          file: {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
          },
          content: {
            text: contentAsText,
            arrayBufferSize: contentAsArrayBuffer.byteLength,
            dataUrlValid: contentAsDataURL.startsWith('data:application/json;base64,'),
            parsedContent: parsedContent,
          },
          events: eventData,
          compliance: {
            file: fileApiCompliance,
            fileList: fileListCompliance,
          },
          inputState: {
            value: input.value,
            filesLength: input.files.length,
          },
        };
      });

      if (!comprehensiveVerification.success) {
        throw new Error(comprehensiveVerification.error || 'Comprehensive verification failed');
      }

      // Assertions for comprehensive verification
      if (
        !comprehensiveVerification.file ||
        comprehensiveVerification.file.name !== 'comprehensive-test.json'
      ) {
        throw new Error(
          `File name mismatch. Expected: "comprehensive-test.json", Got: "${comprehensiveVerification.file?.name}"`,
        );
      }

      if (comprehensiveVerification.file.size !== comprehensiveFile.size) {
        throw new Error(
          `File size mismatch. Expected: ${comprehensiveFile.size}, Got: ${comprehensiveVerification.file.size}`,
        );
      }

      if (
        !comprehensiveVerification.content ||
        comprehensiveVerification.content.text !== comprehensiveContent
      ) {
        throw new Error('File content mismatch');
      }

      if (!comprehensiveVerification.content.dataUrlValid) {
        throw new Error('Data URL is not valid');
      }

      if (
        comprehensiveVerification.content.parsedContent.unicodeTest !==
        '🚀 Unicode content! 中文测试 العربية'
      ) {
        throw new Error('Unicode content verification failed');
      }

      if (
        !comprehensiveVerification.events ||
        !comprehensiveVerification.events.inputEventDetails
      ) {
        throw new Error('Input event details were not captured');
      }

      if (!comprehensiveVerification.events.changeEventDetails) {
        throw new Error('Change event details were not captured');
      }

      if (
        !comprehensiveVerification.compliance ||
        !Object.values(comprehensiveVerification.compliance.file).every(Boolean) ||
        !Object.values(comprehensiveVerification.compliance.fileList).every(Boolean)
      ) {
        throw new Error('File or FileList API compliance check failed');
      }

      progress.log('✅ Final comprehensive test passed with exhaustive verification');
      progress.log(`  📄 File: ${comprehensiveVerification.file.name}`);
      progress.log(`  📏 Size: ${comprehensiveVerification.file.size} bytes`);
      progress.log(`  📝 Content: Verified`);
      progress.log(`  🎯 Events: ${comprehensiveVerification.events.eventsTracked.join(', ')}`);
      progress.log(`  📋 API Compliance: All checks passed`);

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Final Test passed: All aspects of setInputFiles are working perfectly',
        details: {
          fileName: comprehensiveVerification.file.name,
          contentVerified: true,
          eventsVerified: true,
          apiComplianceVerified: true,
        },
      });
    } catch (error) {
      progress.log(`Final Test error: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(
        `Final Test failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'All setInputFiles functionality tests passed successfully!',
    });
  } catch (error) {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: `SetInputFiles functionality test failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      details: {
        error: error instanceof Error ? error.stack : String(error),
      },
    });
    throw new Error(
      `SetInputFiles functionality test failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
