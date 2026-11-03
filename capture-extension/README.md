# KartLab Movement Capture (Chrome / Edge)

Record your exact W/A/S/D/Spacebar inputs while playing the real Smash Karts,
and optionally capture a gameplay video. All files remain **on your computer**.
The extension has **zero permissions** and only loads on `smashkarts.io`.

## Install locally

1. Extract the KartLab Capture ZIP to a folder. Keep `manifest.json` and
   `capture.js` together in that folder.
2. Open `chrome://extensions` in Chrome (or `edge://extensions` in Edge).
3. Switch **Developer mode** on.
4. Click **Load unpacked** and select the extracted `capture-extension` folder.
5. Open or reload `https://smashkarts.io/`.

## Capture a test

1. Look for the **KARTLAB CAPTURE** panel at the bottom left.
2. Keep **Include gameplay video** checked for the most useful results.
3. Click **Start**. Chrome asks you which surface to share. Choose **Chrome
   Tab** and the **Smash Karts** tab; avoid sharing your entire screen.
4. Return focus to the game and perform the test. The panel shows live keys.
5. Press **F9** to stop, or click Stop. Captures stop automatically at 3 minutes.
6. Click **INPUT JSON** to save the exact input event timestamps, and **VIDEO**
   to save the WebM clip. Upload both files to the KartLab project chat.

If screen capture is unavailable or denied, input recording still works.
The exported JSON and video have a shared filename prefix. No upload or
third-party analytics code is present.

## Recommended benchmark sequence

- Reset position; hold W only for 3 seconds; release W and hold A for 4 seconds.
- Reset position; hold W only for 3 seconds; release W and hold D for 4 seconds.
- Reset position; hold W+A for 5 seconds; then W+D for 5 seconds.
- From rest, hold S+D for 3 seconds, then release S while continuing D.

Leave a short neutral pause between tests, and avoid walls/ramps whenever
possible. Input timestamps and moving image features allow us to compare
turn periods, coasting response, and reversal delay with KartLab, but not
to recover absolute world-space speed or hidden engine forces reliably.

## Privacy and troubleshooting

- The only keys recorded are W/A/S/D, arrow equivalents, and Space; no chat,
  passwords, or arbitrary typed text are logged.
- No service worker, network requests, or browser-wide host permissions.
- Captured video can still contain anything visible in the shared tab.
- If the capture panel is missing, refresh the official game after loading
  the extension. If key indicators stay dark, click the Smash Karts canvas.
- If Chrome refuses screen sharing, uncheck the video box to record just keys.
- To remove the tool, go to `chrome://extensions` and click Remove.
